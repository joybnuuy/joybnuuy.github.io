// github.io 정적 배포용 통신: Firebase Realtime Database + 브라우저 호스트
//
// rooms/{코드}/
//   meta      { hostUid, createdAt, updatedAt }   지금 게임을 돌리는 사람(호스트)
//   state     문자열(JSON). RoomCore 전체 상태. 호스트만 쓴다
//   inbox     다른 사람이 보내는 요청 (join, act, start, next, settings, restart, leave)
//   presence  { uid: { at } }  접속 중인 사람. 끊기면 자동으로 지워진다
//
// 호스트가 접속을 잃으면, 접속 중인 사람 중 자리 번호가 가장 작은 사람이 상태를 이어받아 호스트가 된다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, push, remove, onValue, onChildAdded, onDisconnect, runTransaction, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { RoomCore } from './engine/roomcore.js';
import { FIREBASE_CONFIG } from './firebase-config.js';

const fbApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(fbApp);
const db = getDatabase(fbApp);
let uid = null;
const authReady = new Promise((resolve) => onAuthStateChanged(auth, (u) => { if (u) { uid = u.uid; resolve(u.uid); } }));
signInAnonymously(auth).catch((e) => { console.error('익명 로그인 실패', e); toast('서버에 연결하지 못했어요'); });

const R = (code, path = '') => ref(db, `rooms/${code}${path ? '/' + path : ''}`);
const CLAIM_WAIT = 4000; // 호스트가 사라진 뒤 이어받기까지 기다리는 시간

let cur = null; // 지금 들어가 있는 방의 통신 상태

function cleanName(x) {
  const s = String(x ?? '').replace(/[\u0000-\u001f<>&"']/g, '').trim().slice(0, 10);
  return s || '손님';
}
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c = '';
  for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)];
  return c;
}
const plain = (x) => JSON.parse(JSON.stringify(x ?? {})); // RTDB는 undefined를 못 받는다

// ---------- 방 만들기·들어가기 ----------
async function create(name) {
  await authReady;
  for (let i = 0; i < 20; i++) {
    const code = newCode();
    const now = Date.now();
    const res = await runTransaction(R(code, 'meta'), (m) => (m ? undefined : { hostUid: uid, createdAt: now, updatedAt: now }));
    if (!res.committed) continue;
    const core = new RoomCore(code);
    core.addPlayer(name, uid);
    await set(R(code, 'state'), JSON.stringify(core.toJSON()));
    return { code, token: uid };
  }
  throw new Error('방을 만들지 못했어요. 다시 해 보세요');
}

async function join(code, name) {
  await authReady;
  if (!/^[A-Z]{4}$/.test(code)) throw new Error('방 코드는 영문 4자예요');
  const st = await get(R(code, 'state'));
  if (!st.exists()) throw new Error('방을 찾을 수 없어요');
  const core = RoomCore.fromJSON(JSON.parse(st.val()));
  if (core.seatOf(uid) >= 0) return { code, token: uid }; // 이미 앉아 있음 (다시 들어오기)
  if (!core.slots.some((s) => !s || !s.human)) throw new Error('방이 가득 찼어요');
  await push(R(code, 'inbox'), { type: 'join', uid, name, at: Date.now() });
  return { code, token: uid };
}

// ---------- 앱이 부르는 API (서버판 api()와 같은 모양) ----------
async function api(path, body = {}) {
  if (path === 'create') return create(cleanName(body.name));
  if (path === 'join') return join(String(body.code || '').toUpperCase(), cleanName(body.name));
  if (!cur) throw new Error('방에 들어와 있지 않아요');
  const msg = plain({ ...body, type: path, uid, at: Date.now() });
  delete msg.code; delete msg.token;
  if (cur.isHost) {
    hostHandle(msg, true);
  } else {
    await push(R(cur.code, 'inbox'), msg);
  }
  if (path === 'leave') await disconnect(true);
  return { ok: true };
}

// ---------- 방 구독 ----------
async function connect(session) {
  if (!session) return;
  await authReady;
  if (cur && cur.code === session.code) return;
  if (cur) await disconnect(false);
  const code = session.code;
  cur = { code, unsubs: [], isHost: false, core: null, latest: null, hostUid: null, presence: {}, claimTimer: null, writeQueued: false, inboxUnsub: null };
  const c = cur;
  // 접속 표시: 끊기면 자동으로 지워진다
  c.unsubs.push(onValue(ref(db, '.info/connected'), (snap) => {
    const on = snap.val() === true;
    netOffline(!on);
    if (!on) return;
    const pres = R(code, `presence/${uid}`);
    onDisconnect(pres).remove().then(() => set(pres, { at: serverTimestamp() }));
  }));
  c.unsubs.push(onValue(R(code, 'state'), (snap) => {
    if (c !== cur) return;
    if (!snap.exists()) { netGone(); return; }
    c.latest = snap.val();
    if (c.isHost) return; // 호스트는 자기 상태로 그린다
    showFrom(RoomCore.fromJSON(JSON.parse(c.latest)));
  }));
  c.unsubs.push(onValue(R(code, 'meta/hostUid'), (snap) => { if (c !== cur) return; c.hostUid = snap.val(); evaluate(); }));
  c.unsubs.push(onValue(R(code, 'presence'), (snap) => {
    if (c !== cur) return;
    c.presence = snap.val() || {};
    if (c.isHost) syncConnected();
    evaluate();
  }));
}

function showFrom(core) {
  const seat = core.seatOf(uid);
  if (seat >= 0) netState(core.stateFor(seat));
}

async function disconnect(releaseHost) {
  const c = cur;
  if (!c) return;
  cur = null;
  if (c.claimTimer) clearTimeout(c.claimTimer);
  for (const u of c.unsubs) u();
  if (c.inboxUnsub) c.inboxUnsub();
  if (c.core) c.core.dispose();
  try {
    await remove(R(c.code, `presence/${uid}`));
    if (c.isHost && releaseHost) await set(R(c.code, 'meta/hostUid'), null);
  } catch { /* 무시 */ }
}

// ---------- 호스트 정하기·넘기기 ----------
function evaluate() {
  const c = cur;
  if (!c || !c.latest) return;
  if (c.hostUid === uid && !c.isHost) becomeHost();
  else if (c.hostUid !== uid && c.isHost) stopHost();
  const alive = c.hostUid && c.presence[c.hostUid];
  if (alive || c.hostUid === uid) { if (c.claimTimer) { clearTimeout(c.claimTimer); c.claimTimer = null; } return; }
  if (!c.claimTimer) c.claimTimer = setTimeout(() => { c.claimTimer = null; claim(); }, CLAIM_WAIT);
}

async function claim() {
  const c = cur;
  if (!c || c.isHost || (c.hostUid && c.presence[c.hostUid])) return;
  // 접속 중인 사람 중 자리 번호가 가장 작은 사람이 이어받는다
  const core = RoomCore.fromJSON(JSON.parse(c.latest));
  const first = [0, 1, 2, 3].find((s) => core.slots[s]?.human && c.presence[core.slots[s].id]);
  if (first === undefined || core.slots[first].id !== uid) return;
  await runTransaction(R(c.code, 'meta/hostUid'), (h) => (h && h !== uid && c.presence[h] ? undefined : uid));
}

function becomeHost() {
  const c = cur;
  c.isHost = true;
  c.core = RoomCore.fromJSON(JSON.parse(c.latest), { onChange: () => hostChanged(c) });
  syncConnected();
  c.core.resume();
  c.inboxUnsub = onChildAdded(R(c.code, 'inbox'), (snap) => {
    if (c !== cur || !c.isHost) return;
    hostHandle(snap.val() || {}, false);
    remove(snap.ref);
  });
  hostChanged(c);
}

function stopHost() {
  const c = cur;
  c.isHost = false;
  if (c.inboxUnsub) { c.inboxUnsub(); c.inboxUnsub = null; }
  if (c.core) { c.core.dispose(); c.core = null; }
}

function syncConnected() {
  const c = cur;
  if (!c || !c.core) return;
  c.core.slots.forEach((s, i) => { if (s && s.human) c.core.setConnected(i, !!c.presence[s.id] || s.id === uid); });
}

// 상태가 바뀌면 저장하고(한 번에 모아서) 내 화면도 바로 그린다
function hostChanged(c) {
  if (c !== cur || !c.isHost || !c.core) return;
  showFrom(c.core);
  if (c.writeQueued) return;
  c.writeQueued = true;
  queueMicrotask(() => {
    c.writeQueued = false;
    if (c !== cur || !c.isHost || !c.core) return;
    const json = JSON.stringify(c.core.toJSON());
    c.latest = json;
    update(R(c.code), { state: json, 'meta/updatedAt': Date.now() }).catch((e) => console.error('저장 실패', e));
  });
}

// 호스트가 요청을 처리 (서버판 server.ts의 API 처리와 같은 규칙)
function hostHandle(msg, local) {
  const c = cur;
  const core = c.core;
  const seat = core.seatOf(msg.uid);
  try {
    switch (msg.type) {
      case 'join':
        if (seat < 0) core.addPlayer(cleanName(msg.name), msg.uid);
        break;
      case 'start':
        if (seat !== core.host) throw new Error('방장만 시작할 수 있어요');
        core.start({ botLevel: msg.botLevel, turnSec: msg.turnSec, hands: msg.hands });
        break;
      case 'act':
        if (seat < 0) return;
        core.act(seat, msg.action);
        break;
      case 'next':
        if (seat >= 0) core.ready(seat);
        break;
      case 'restart':
        if (seat !== core.host) throw new Error('방장만 다시 시작할 수 있어요');
        core.restart();
        break;
      case 'leave':
        if (seat >= 0) core.leave(seat);
        break;
      case 'settings':
        if (seat === core.host && core.phase === 'lobby') {
          if (msg.botLevel !== undefined) core.botLevel = msg.botLevel === 0 ? 0 : 1;
          if (msg.turnSec !== undefined) core.turnSec = Math.max(10, Math.min(120, Number(msg.turnSec) || 40));
          if (msg.hands !== undefined) core.hands = msg.hands === 4 ? 4 : 8;
        }
        break;
      default:
        return;
    }
  } catch (e) {
    if (local) throw e;
    console.warn('요청 처리 실패', msg.type, e.message);
  }
  hostChanged(c);
}

window.NET = { api, connect, disconnect };
window.api = api;
window.connect = () => connect(session);
appStart();
