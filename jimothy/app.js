// Jimothy 마작 웹앱. 서버가 보내는 상태(SSE)를 그리고, 버튼/패 탭을 API로 보낸다.
const WIND = ['東', '南', '西', '北'];
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kindOf = (id) => id >> 2;

let session = null;
try { session = JSON.parse(localStorage.getItem('jimothy') || 'null'); } catch { session = null; }
let S = null;            // 서버에서 받은 최신 상태
let es = null;
let offline = false;
let lastHTML = '';
const ui = { selected: null, riichi: false, busy: false, seen: -1, rules: 0, rulesTab: 0, wasMyTurn: false, skew: 0, manual: 0, settings: 0, help: 0 };

// ---------- 통신 ----------
async function api(path, body = {}) {
  const r = await fetch('/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(session || {}), ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || '오류가 났어요');
  return j;
}

function saveSession(s) {
  session = s;
  if (s) localStorage.setItem('jimothy', JSON.stringify(s)); else localStorage.removeItem('jimothy');
}

function connect() {
  if (es) es.close();
  if (!session) return;
  es = new EventSource(`/api/events?code=${session.code}&token=${session.token}`);
  es.addEventListener('state', (e) => {
    S = JSON.parse(e.data);
    ui.skew = S.serverTime - Date.now();
    ui.busy = false;
    offline = false;
    onState();
  });
  es.onerror = () => {
    offline = true;
    renderBanner();
    if (es.readyState === 2) { // 서버가 거절함 (방이 사라졌거나 토큰이 틀림)
      saveSession(null); S = null;
      toast('방을 찾을 수 없어요. 처음 화면으로 돌아갑니다');
      render();
    }
  };
}

function toast(text, big = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (big ? ' big' : '');
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), big ? 2600 : 1800);
}

function renderBanner() {
  let b = $('#banner');
  if (offline) {
    if (!b) { b = document.createElement('div'); b.id = 'banner'; b.className = 'banner'; document.body.appendChild(b); }
    b.textContent = '연결이 끊겼어요. 다시 연결하는 중…';
  } else if (b) b.remove();
}

function onState() {
  renderBanner();
  const snap = snapshotHands();
  const anims = [];
  // 새 이벤트 알림
  const evs = S.events || [];
  let tilePlayed = false;
  if (ui.seen < 0) ui.seen = evs.length ? evs[evs.length - 1].id : 0;
  for (const e of evs) {
    if (e.id <= ui.seen) continue;
    ui.seen = e.id;
    if (e.t === 'discard') { tilePlayed = true; anims.push(e); }
    if (e.t === 'call') Sfx.voice(e.word, e.seat);
    if (e.t === 'riichi') Sfx.voice(e.double ? 'dbriichi' : 'riichi', e.seat);
    if (e.t === 'riichi' || e.t === 'call' || e.t === 'hand' || e.t === 'join' || e.t === 'leave' || e.t === 'draw') toast(e.text, e.t === 'riichi');
    if (e.t === 'win') {
      toast(e.text, true);
      (e.winners || []).forEach((w, k) => setTimeout(() => Sfx.voice({ ron: 'ron', chankan: 'ron', public: 'jimothy' }[w.how] || 'tsumo', w.seat), k * 900));
    }
  }
  if (tilePlayed) Sfx.tile();
  // 유국이면 내 텐파이 / 노텐만 말한다
  const R = S.result;
  if (R && S.match && R.kind === 'draw' && R.draw.reason === '유국' && ui.drawVoiced !== S.match.handCount) {
    ui.drawVoiced = S.match.handCount;
    setTimeout(() => Sfx.voice(R.draw.tenpai[S.you] ? 'tenpai' : 'noten', S.you), 900);
  }
  // 내 차례 진동
  const h = S.hand;
  const mine = !!(h && S.room.phase === 'playing' && h.waiting.includes(S.you) && h.legal.length);
  if (mine && !ui.wasMyTurn && navigator.vibrate && Settings.vibrate) navigator.vibrate(35);
  ui.wasMyTurn = mine;
  if (!mine) { ui.selected = null; ui.riichi = false; }
  render();
  anims.forEach((e) => flyDiscard(e, snap));
  Guide.hints(S);
}

// ---------- 화면 ----------
function render() {
  const app = $('#app');
  if (!session || !S) { app.innerHTML = homeHTML(); lastHTML = ''; bindHome(); renderModals(); return; }
  const html = S.room.phase === 'lobby' ? lobbyHTML() : gameHTML();
  if (html !== lastHTML) { app.innerHTML = html; lastHTML = html; }
  renderModals();
}

function homeHTML() {
  const q = new URLSearchParams(location.search).get('room') || '';
  const name = localStorage.getItem('jimothy-name') || '';
  return `<div class="screen">
    <div class="logo">${[33, 32, 31].map((k) => tileHTML(k * 4)).join('')}</div>
    <h1>Jimothy 마작<small>몸통 2개 + 머리 1개, 6순 안에 끝나는 빠른 리치마작</small></h1>
    <div class="card">
      <label>이름</label><input id="name" maxlength="10" placeholder="이름 (10자까지)" value="${esc(name)}" autocomplete="off">
      <button class="btn primary mt" id="create" style="width:100%">방 만들기</button>
    </div>
    <div class="card">
      <label>친구가 알려준 방 코드</label>
      <div class="row"><input id="code" maxlength="4" placeholder="ABCD" value="${esc(q.toUpperCase())}" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase;letter-spacing:4px;font-weight:700">
      <button class="btn fit" id="join">참가</button></div>
    </div>
    <div class="row"><button class="btn" data-g="manual">처음 해요</button><button class="btn ghost" id="rules">규칙 보기</button><button class="btn ghost fit" data-g="settings">설정</button></div>
    <div class="muted" style="text-align:center">빈자리는 봇이 채워요. 혼자서도 할 수 있어요.</div>
    <div class="muted" style="text-align:center;font-size:11px">음성: <a href="https://github.com/Acedio/animalese.js" style="color:#a9c4b6">animalese.js</a> (Josh Simmons, CC BY 4.0)</div>
  </div>`;
}

function bindHome() {
  const name = () => ($('#name').value || '').trim() || '손님';
  const go = async (path, body) => {
    try {
      localStorage.setItem('jimothy-name', name());
      const j = await api(path, body);
      saveSession({ code: j.code, token: j.token });
      history.replaceState(null, '', location.pathname);
      connect();
    } catch (e) { toast(e.message); }
  };
  $('#create').onclick = () => go('create', { name: name() });
  $('#join').onclick = () => go('join', { name: name(), code: ($('#code').value || '').trim().toUpperCase() });
  $('#rules').onclick = () => { ui.rules = 1; renderModals(); };
}

function lobbyHTML() {
  const r = S.room;
  const isHost = r.host === S.you;
  const link = `${location.origin}${location.pathname}?room=${r.code}`;
  const seats = r.seats.map((s, i) => s
    ? `<div class="seat"><span class="wind">${WIND[i]}</span><b>${esc(s.name)}</b>${i === r.host ? '<span class="badge">방장</span>' : ''}${!s.connected ? '<span class="badge off">접속 끊김</span>' : ''}${i === S.you ? '<span class="badge bot">나</span>' : ''}</div>`
    : `<div class="seat empty"><span class="wind">${WIND[i]}</span>빈자리 (시작하면 봇이 앉아요)</div>`).join('');
  return `<div class="screen">
    <h1>대기실<small>친구에게 코드나 링크를 보내세요</small></h1>
    <div class="card"><div class="code">${r.code}</div>
      <div class="row mt"><button class="btn small" id="share">링크 공유</button><button class="btn small ghost" id="copy">복사</button></div></div>
    <div class="card"><b>참가자</b>${seats}</div>
    <div class="card">
      <div class="row"><div><label>봇 실력</label><select id="lv" ${isHost ? '' : 'disabled'}><option value="0" ${r.botLevel === 0 ? 'selected' : ''}>공격형</option><option value="1" ${r.botLevel === 1 ? 'selected' : ''}>보통</option></select></div>
      <div><label>대국 길이</label><select id="hn" ${isHost ? '' : 'disabled'}><option value="4" ${r.hands === 4 ? 'selected' : ''}>동장전</option><option value="8" ${r.hands !== 4 ? 'selected' : ''}>반장전</option></select></div>
      <div><label>한 수 제한 시간</label><select id="ts" ${isHost ? '' : 'disabled'}>${[20, 40, 60, 90].map((n) => `<option value="${n}" ${r.turnSec === n ? 'selected' : ''}>${n}초</option>`).join('')}</select></div></div>
      <div class="muted mt">봇 실력: 공격형은 수비 없이 치고, 보통은 상대 리치에 손이 멀면 접어요. 시간이 지나면 봇이 대신 둬요. ${r.hands === 4 ? '동장전(동1~동4국)을' : '반장전(동4+남4국)을'} 해요. 끝났을 때 3만 점 이상이 없으면 한 장 더 해요.</div></div>
    ${isHost ? '<button class="btn primary" id="start">시작하기</button>' : '<div class="muted" style="text-align:center">방장이 시작하기를 기다리는 중…</div>'}
    <button class="btn ghost" id="leave">나가기</button>
    <div class="row"><button class="btn ghost" data-g="manual">처음 해요</button><button class="btn ghost" id="rules">규칙 보기</button><button class="btn ghost fit" data-g="settings">설정</button></div>
  </div>`;
}

function lobbyBind() {
  const set = () => api('settings', { botLevel: Number($('#lv').value), turnSec: Number($('#ts').value), hands: Number($('#hn').value) }).catch((e) => toast(e.message));
  if ($('#lv')) { $('#lv').onchange = set; $('#ts').onchange = set; $('#hn').onchange = set; }
  if ($('#start')) $('#start').onclick = () => api('start', { botLevel: Number($('#lv').value), turnSec: Number($('#ts').value), hands: Number($('#hn').value) }).catch((e) => toast(e.message));
  $('#rules').onclick = () => { ui.rules = 1; renderModals(); };
  const link = `${location.origin}${location.pathname}?room=${S.room.code}`;
  $('#share').onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Jimothy 마작', text: `Jimothy 마작 방 ${S.room.code}`, url: link }); return; } catch { /* 취소 */ } }
    copyLink(link);
  };
  $('#copy').onclick = () => copyLink(link);
}

function copyLink(link) {
  if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => toast('링크를 복사했어요'), () => toast(link));
  else toast(link);
}

async function leave() {
  if (!confirm('방에서 나갈까요? 대국 중이면 봇이 대신 이어서 둬요.')) return;
  try { await api('leave'); } catch { /* 이미 나간 상태 */ }
  if (es) es.close();
  saveSession(null); S = null; ui.seen = -1;
  render();
}

// ----- 대국 -----
// 도라 표시패의 '다음 패'가 도라다. 도라와 적도라 패는 반짝이고, 리치도라는 리치한 사람의 패만 반짝인다
let curDora = null;
const doraKindOf = (k) => (k < 27 ? Math.floor(k / 9) * 9 + ((k % 9) + 1) % 9 : k < 31 ? 27 + ((k - 27 + 1) % 4) : 31 + ((k - 31 + 1) % 3));
function setDora(front, ura, riichi) {
  curDora = { front: new Set(front.map((t) => doraKindOf(t >> 2))), ura: new Set(ura.map((t) => doraKindOf(t >> 2))), riichi };
}
// owner(좌석)를 주면 그 사람 기준으로 도라 반짝임을 붙인다
function tileHTML(id, cls = '', attrs = '', owner) {
  if (owner !== undefined && curDora && id >= 0) {
    const k = id >> 2;
    if (Tiles.isRed(id) || curDora.front.has(k) || (curDora.riichi[owner] && curDora.ura.has(k))) cls += ' dora';
  }
  if (Settings.labels === 'all' || (Settings.labels === 'hand' && /\bmine\b/.test(cls))) cls += ' lbl';
  return Tiles.html(id, cls, attrs);
}

function riverHTML(p, cls, lastTile) {
  // 리치 선언패는 눕혀서 놓는다. 그 패를 누가 울었으면 그다음에 버린 패(울리지 않은 것)를 눕힌다
  let mark = p.river.findIndex((r) => r.riichi);
  while (mark >= 0 && mark < p.river.length && p.river[mark].called) mark++;
  return `<div class="rv">${p.river.map((r, i) => tileHTML(r.tile, `${cls}${i === mark ? ' lying' : ''}${r.called ? ' dim' : ''}${r.tile === lastTile ? ' last' : ''}`, '', p.seat)).join('')}</div>`;
}

// 울어서 만든 몸통 하나. 버림패로 운 패는 눕혀서(버린 사람 쪽에), 공개패로 운 패는 반투명으로 세워서 보인다
function meldHTML(m, owner, h, cls) {
  const up = (id, extra = '') => tileHTML(id, cls + extra, '', owner);
  const cell = (id) => tileHTML(id, `${cls} lying`, '', owner);
  const sorted = (a) => a.slice().sort((x, y) => x - y);
  if (m.src === 'closed') { // 안깡: 양 끝은 뒷면
    const t = sorted(m.tiles);
    return [up(-1), up(t[1]), up(t[2]), up(-1)].join('');
  }
  if (m.src === 'public') {
    const pubId = m.pub !== undefined && h.pub ? h.pub[m.pub] : -1;
    if (m.typ === 'K' && m.added === undefined) { // 공개패로 깡: 안깡처럼 두고, 가운데 한 장이 공개패(반투명)
      const others = sorted(m.tiles.filter((t) => t !== pubId));
      return [up(-1), up(others[0]), up(pubId, ' ghost'), up(-1)].join('');
    }
    return sorted(m.tiles).map((t) => up(t, t === pubId ? ' ghost' : '')).join('');
  }
  // 버림패로 울기
  const claimed = m.added !== undefined ? m.tiles[2] : m.tiles[m.tiles.length - 1];
  const others = sorted(m.tiles.filter((t) => t !== claimed && t !== m.added));
  const rel = m.typ === 'S' ? 3 : (m.from - owner + 4) % 4; // 3 왼쪽(상가), 2 맞은편, 1 오른쪽(하가)
  const side = m.added !== undefined ? `<div class="stk">${cell(m.added)}${cell(claimed)}</div>` : cell(claimed);
  const out = others.map((t) => up(t));
  out.splice(rel === 3 ? 0 : rel === 2 ? 1 : out.length, 0, side);
  return out.join('');
}

function meldsHTML(p, cls, h, owner) {
  if (!p.melds.length) return '';
  return `<div class="melds">${p.melds.map((m) => `<div class="meld">${meldHTML(m, owner, h, cls)}</div>`).join('')}</div>`;
}

function gameHTML() {
  const h = S.hand, m = S.match, me = S.you, L = h.legal;
  setDora(h.frontInd, h.riichiInd, h.players.map((p) => p.riichi));
  const lastEv = [...S.events].reverse().find((e) => e.t === 'discard');
  const lastTile = lastEv ? lastEv.tile : -1;
  const opp = [(me + 3) % 4, (me + 2) % 4, (me + 1) % 4].map((s) => {
    const p = h.players[s];
    const turn = h.turnSeat === s;
    const glow = h.glowSeat === s;
    const drawn = turn && h.phase === 'turn' && !h.afterCall;
    const backs = Array.from({ length: Math.max(0, p.handCount - (drawn ? 1 : 0)) }, () => tileHTML(-1, 'xxs')).join('');
    return `<div class="opp ${glow ? 'turn' : ''}" data-seat="${s}">
      <div class="top"><span class="wind ${s === h.dealer ? 'dealer' : ''}">${WIND[p.seatWind]}</span><span class="score">${h.scores[s].toLocaleString()}</span></div>
      <div class="top nm"><span class="name">${p.human ? '' : '🤖 '}${esc(p.name)}</span>${p.riichi ? `${p.double ? '<span class="tag">더블</span>' : ''}<span class="stick" title="리치"></span>` : ''}${p.auto ? '<span class="tag auto">자동</span>' : ''}</div>
      <div class="ohand">${backs}${drawn ? `<span class="ogap"></span>${tileHTML(-1, 'xxs draw')}` : ''}</div>
      <div class="rvbox" data-river="${s}"><span class="rlab">강</span>${riverHTML(p, 'xs', lastTile)}</div>
      ${p.melds.length ? `<div class="mbox"><span class="rlab">울기</span>${meldsHTML(p, 'xs', h, s)}</div>` : ''}</div>`;
  }).join('');

  const pubSlots = Array.from({ length: 6 }, (_, i) => {
    if (i < h.pub.length) {
      const cur = i === h.pubIdx || (h.pubIdx < 0 && i === h.pub.length - 1 && (h.phase === 'pub-post' || h.phase === 'turn' && false));
      return `<div class="slot ${cur ? 'cur' : ''} ${h.usedPub.includes(i) ? 'used' : ''}">${tileHTML(h.pub[i], 'sm')}</div>`;
    }
    return `<div class="slot">${i + 1}</div>`;
  }).join('');
  const dora = `${h.frontInd.map((t) => tileHTML(t, 'sm')).join('')}${Array.from({ length: h.frontHidden }, () => tileHTML(-1, 'sm')).join('')}`;
  const ura = `${h.riichiInd.map((t) => tileHTML(t, 'sm')).join('')}${Array.from({ length: h.riichiHidden }, () => tileHTML(-1, 'sm')).join('')}`;

  const myP = h.players[me];
  const myTurn = h.waiting.includes(me) && L.length > 0;
  const waitNames = h.waiting.filter((s) => s !== me).map((s) => h.players[s].name);
  let status;
  if (S.room.phase !== 'playing') status = '';
  else if (myTurn && h.phase === 'turn' && myP.riichi && L.every((a) => a.t === 'discard')) status = '<b>리치 중</b> · 자동으로 버립니다';
  else if (myTurn && h.phase === 'turn') status = h.afterCall ? '<b>울고 난 뒤</b> 버릴 패를 고르세요' : '<b>내 차례</b> · 버릴 패를 누르세요 (한 번 더 누르면 버려요)';
  else if (myTurn && h.phase === 'pub-post') status = '<b>버릴 패</b>를 고르세요 (모두 함께 공개돼요)';
  else if (myTurn) status = '<b>응답하세요</b> · 론/울기/패스';
  else if (h.phase === 'turn') status = `${esc(h.players[h.turnSeat].name)} 차례`;
  else if (h.phase.endsWith('resp') || h.phase === 'pub-post') status = waitNames.length ? `${waitNames.map(esc).join(', ')} 기다리는 중…` : '진행 중…';
  else status = '';
  if (myTurn && h.deadline) status += ` <span class="timer" id="timer"></span>`;

  return `<div class="game"><div class="hdr"><b>${esc(m.title)}</b><span>리치봉 ${h.sticks}</span><span class="sp"></span><span>패 ${h.wallLeft}</span><button class="icon" id="mute">${Sfx.isMuted() ? '🔇' : '🔊'}</button><button class="icon" id="help">도움말</button><button class="icon" id="leave">나가기</button></div>
    <div class="opps">${opp}</div>
    <div class="mid ${h.pubPhase ? 'glow' : ''}">
      <div class="lab">순 ${h.rnd}/6</div><div class="dots">${Array.from({ length: 6 }, (_, i) => `<i class="${i < h.rnd ? 'on' : ''}"></i>`).join('')}</div>
      <div class="lab">도라 표시패</div><div class="tiles">${dora}</div>
      <div class="lab">리치도라 표시패</div><div class="tiles">${ura}</div>
      <div class="lab">공개패</div><div class="pubs">${pubSlots}</div>
    </div>
    <div class="me"><div class="myrow" data-river="${me}"><span class="rlab">내 강</span>${riverHTML(myP, 'sm', lastTile)}</div></div>
    <div class="bottom"><div class="status">${status}</div>
    <div class="actions">${actionsHTML(h)}</div>
    <div class="hand ${h.glowSeat === me ? 'turn' : ''}" style="--hw:${handTileWidth(h, myP)}px"><div class="hmain">${handHTML(h)}</div>${myP.melds.length ? `<div class="hmelds">${meldsHTML(myP, 'hm', h, me)}</div>` : ''}</div></div></div>`;
}

// 버릴 수 있는 패(합법 행동) 계산
function discardMap(h) {
  const mp = new Map();
  for (const a of h.legal) {
    if (a.t !== 'discard') continue;
    const e = mp.get(a.tile) || {};
    if (a.riichi) e.riichi = true; else e.normal = true;
    mp.set(a.tile, e);
  }
  return mp;
}

function handHTML(h) {
  const dm = discardMap(h);
  const mine = h.hand.slice();
  const draw = h.lastDraw >= 0 && mine.includes(h.lastDraw) && (h.phase === 'turn' || h.phase === 'pub-post') ? h.lastDraw : -1;
  const rest = mine.filter((x) => x !== draw).sort((a, b) => (a >> 2) - (b >> 2) || a - b);
  const html = (id) => {
    const e = dm.get(id);
    const ok = e && (ui.riichi ? e.riichi : e.normal || e.riichi);
    return tileHTML(id, `mine ${ok ? '' : 'off'} ${ui.selected === id ? 'sel' : ''}`, `data-hand="${id}"`, S.you);
  };
  return rest.map(html).join('') + (draw >= 0 ? `<span class="gap"></span>${html(draw)}` : '');
}

function actionsHTML(h) {
  const L = h.legal;
  const out = [];
  const target = (a) => (a.pub !== undefined ? h.pub[a.pub] : h.lastDiscard ? h.lastDiscard.tile : -2);
  L.forEach((a, i) => {
    if (a.t === 'tsumo') out.push(`<button class="act win" data-i="${i}">쯔모!</button>`);
    else if (a.t === 'ron') out.push(`<button class="act win" data-i="${i}">론!${a.pub !== undefined ? tileHTML(h.pub[a.pub]) : ''}</button>`);
    else if (a.t === 'pon' || a.t === 'chi' || a.t === 'kan') {
      const label = { pon: '퐁', chi: '치', kan: '깡' }[a.t];
      const tg = target(a);
      out.push(`<button class="act ${a.t === 'kan' ? 'kan' : ''}" data-i="${i}">${label}${a.tiles.slice().sort((x, y) => x - y).map((t) => tileHTML(t)).join('')}${tg >= 0 ? tileHTML(tg, 'last') : ''}</button>`);
    } else if (a.t === 'ankan') out.push(`<button class="act kan" data-i="${i}">안깡 ${Tiles.kindName(a.kind)}</button>`);
    else if (a.t === 'kakan') out.push(`<button class="act kan" data-i="${i}">가깡 ${Tiles.kindName(a.kind)}</button>`);
  });
  if (L.some((a) => a.t === 'discard' && a.riichi)) out.push(`<button class="act riichi ${ui.riichi ? 'on' : ''}" id="riichi">리치${ui.riichi ? ' (패 선택)' : ''}</button>`);
  const pass = L.findIndex((a) => a.t === 'pass');
  if (pass >= 0) out.push(`<button class="act pass" data-i="${pass}">패스</button>`);
  return out.join('');
}

function sendAction(a) {
  if (ui.busy) return;
  if (a.t === 'discard') { const el = document.querySelector(`.hand [data-hand="${a.tile}"]`); ui.sentRect = el ? { id: a.tile, r: el.getBoundingClientRect() } : null; }
  ui.busy = true; ui.selected = null; ui.riichi = false;
  api('act', { action: a }).catch((e) => { ui.busy = false; if (!/불법 행동|행동할 수 없어요/.test(e.message)) toast(e.message); render(); });
}

// ---------- 모달 ----------
function resultHTML() {
  const R = S.result, m = S.match, me = S.you;
  const names = S.room.seats.map((s, i) => (s ? s.name : '봇'));
  setDora(R.frontInd, R.riichiInd, R.players.map((p) => p.riichi));
  // 화료한 손은 8장을 모두 보여 준다: 손패(7장) + 화료한 패 + 울어서 만든 몸통. 론·공개패 화료는 화료패가 손패 밖에 있다
  const hand = (p, w) => {
    const win = w ? w.winTile : -1;
    const tiles = p.hand.filter((t) => t !== win).sort((a, b) => (a >> 2) - (b >> 2) || a - b);
    return `<div class="handrow">${tiles.map((t) => tileHTML(t, '', '', p.seat)).join('')}${win >= 0 ? `<span class="sp"></span>${tileHTML(win, 'last', '', p.seat)}` : ''}${p.melds.length ? `<span class="sp"></span>${meldsHTML(p, 'sm', { pub: R.pub }, p.seat)}` : ''}</div>`;
  };
  const how = { tsumo: '쯔모', rinshan: '영상개화', ron: '론', chankan: '창깡', public: '지모시', '8종8패': '8종 8패' };
  let body = '';
  if (R.kind === 'win') {
    body = R.winners.map((w) => {
      const p = R.players[w.seat];
      const yaku = [...w.ym.map((y) => [y, '13판']), ...w.yaku.filter(([, hn]) => hn > 0 || true).map(([n, hn]) => [n, `${hn}판`])];
      return `<div class="win-card"><div class="big">${esc(names[w.seat])} ${how[w.how] || w.how}</div>
        <div class="muted" style="color:#6b777a">${w.how === 'ron' || w.how === 'chankan' ? `${esc(names[R.from])} 방총 · ` : ''}판 ${w.han + w.dora + 13 * w.ym.length} (도라 ${w.dora}) · 동전역 ${w.coin} · <b>${w.total.toLocaleString()}점</b></div>
        ${hand(p, w)}
        <div class="yaku">${yaku.map(([n, v]) => `<span>${esc(n)}</span><span>${v}</span>`).join('')}${w.dora ? `<span>도라</span><span>${w.dora}판</span>` : ''}</div>
        <div class="coin">판수 점수 ${w.base.toLocaleString()} + 동전역 ${w.coin.toLocaleString()}<br>동전역: ${w.coinParts.map(([n, v]) => `${esc(n)} ${v}`).join(' · ')}</div></div>`;
    }).join('');
  } else {
    const tp = R.draw.tenpai;
    body = `<div class="win-card"><div class="big" style="color:#5a6a70">${R.draw.reason === '유국' ? '유국' : '도중유국 · ' + esc(R.draw.reason)}</div>
      ${R.draw.reason === '유국' ? R.players.map((p) => `<div style="margin-top:8px"><b>${esc(names[p.seat])}</b> ${tp[p.seat] ? '<span class="pos">텐파이</span>' : '<span class="muted">노텐</span>'}${hand(p)}</div>`).join('') : ''}</div>`;
  }
  const dora = `<div class="muted" style="color:#6b777a">도라 표시패 <span class="handrow" style="display:inline-flex;vertical-align:middle">${R.frontInd.map((t) => tileHTML(t)).join('')}</span> 리치도라 표시패 <span class="handrow" style="display:inline-flex;vertical-align:middle">${R.riichiInd.map((t) => tileHTML(t)).join('')}</span></div>`;
  const rows = [0, 1, 2, 3].map((s) => `<tr><td>${s === me ? '<b>나</b> ' : ''}${esc(names[s])}</td><td class="${R.deltas[s] > 0 ? 'pos' : R.deltas[s] < 0 ? 'neg' : ''}">${R.deltas[s] > 0 ? '+' : ''}${R.deltas[s]}</td><td>${R.scoresAfter[s].toLocaleString()}</td></tr>`).join('');
  let foot;
  if (S.room.phase === 'finished') {
    const rk = R.final.ranking;
    foot = `<h2 style="margin-top:14px">최종 순위</h2><table class="scores">${rk.map((s, i) => `<tr><td>${i + 1}위</td><td>${esc(names[s])}</td><td>${R.final.scores[s].toLocaleString()}</td></tr>`).join('')}</table>
      ${S.room.host === me ? '<button class="btn primary" id="restart">다시 하기 (대기실로)</button>' : '<div class="muted" style="text-align:center">방장이 다시 시작할 수 있어요</div>'}
      <button class="btn ghost" id="leave2">나가기</button>`;
  } else {
    const ready = S.room.seats.filter((s) => s && s.human);
    foot = `<button class="btn primary" id="next">다음 판</button>
      <div class="muted" style="text-align:center;margin-top:6px;color:#6b777a">${ready.map((s) => `${esc(s.name)} ${s.ready ? '✓' : '…'}`).join(' · ')} <span id="ntimer"></span></div>`;
  }
  return `<div class="sheet"><h2>${esc(R.title)} 결과</h2>${body}${dora}<table class="scores"><tr><td colspan="3" class="muted" style="color:#6b777a">점수 변동 (리치봉·본장 포함)</td></tr>${rows}</table>${foot}</div>`;
}

// 모달은 내용이 바뀔 때만 다시 그린다 (읽는 중에 스크롤과 펼친 항목이 초기화되지 않게)
let lastModal = '';
function modalHTML() {
  let html = '';
  if (ui.manual) html = Guide.manualHTML();
  else if (ui.settings) html = Guide.settingsHTML();
  else if (ui.help) html = Guide.helpHTML();
  else if (ui.rules) html = Rules.html();
  else if (S && session && (S.room.phase === 'between' || S.room.phase === 'finished') && S.result) html = resultHTML();
  return html ? `<div class="modal">${html}</div>` : '';
}
function renderModals() {
  const html = modalHTML();
  if (html === lastModal) return;
  lastModal = html;
  $('#modal-root').innerHTML = html;
}
// 펼침 상태가 바뀌면 지금 화면을 기준으로 다시 맞춰 둔다 (다음 상태 갱신 때 다시 그리지 않도록)
function syncModalCache() { lastModal = modalHTML(); }

// ---------- 이벤트 ----------
document.addEventListener('pointerdown', () => Sfx.unlock(), { once: true });
const onTap = (e) => {
  const t = e.target;
  const q = (sel) => t.closest(sel);
  let el;
  if ((el = q('[data-g]')) && Guide.onClick(el)) return;
  if (q('#help')) { ui.help = 1; renderModals(); return; }
  if ((el = q('button[data-r]')) && Rules.onClick(el)) return;
  if (q('#mute')) { Sfx.setMuted(!Sfx.isMuted()); render(); return; }
  if (q('#rules') && S && session && S.room.phase !== 'lobby') { ui.rules = 1; renderModals(); return; }
  if (q('#leave') || q('#leave2')) { leave(); return; }
  if (q('#next')) { api('next').catch((er) => toast(er.message)); const b = $('#next'); if (b) { b.disabled = true; b.textContent = '다른 사람을 기다리는 중…'; } return; }
  if (q('#restart')) { api('restart').catch((er) => toast(er.message)); return; }
  if (!S || !S.hand) return;
  if (q('#riichi')) { ui.riichi = !ui.riichi; ui.selected = null; render(); return; }
  if ((el = q('[data-i]'))) { sendAction(S.hand.legal[Number(el.dataset.i)]); return; }
  if ((el = q('[data-hand]'))) {
    const id = Number(el.dataset.hand);
    const e2 = discardMap(S.hand).get(id);
    if (!e2 || !S.hand.waiting.includes(S.you)) return;
    const wantRiichi = ui.riichi;
    if (wantRiichi && !e2.riichi) return;
    if (ui.selected === id || Settings.tapMode === 'single') sendAction({ t: 'discard', tile: id, ...(wantRiichi ? { riichi: true } : {}) });
    else { ui.selected = id; render(); }
  }
};
document.addEventListener('click', (e) => { if (!e.target.closest('[data-i],[data-hand],#riichi')) onTap(e); });
document.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-i],[data-hand],#riichi')) onTap(e); });

// 일시 상태 (남은 시간)
setInterval(() => {
  if (!S) return;
  const now = Date.now() + ui.skew;
  const t = $('#timer');
  if (t && S.hand && S.hand.deadline) t.textContent = `${Math.max(0, Math.ceil((S.hand.deadline - now) / 1000))}초`;
  const n = $('#ntimer');
  if (n && S.nextDeadline) n.textContent = `(${Math.max(0, Math.ceil((S.nextDeadline - now) / 1000))}초 뒤 자동 시작)`;
}, 500);

// 로비는 render 뒤에 이벤트를 달아야 한다
const _render = render;
render = function () { _render(); if (session && S && S.room.phase === 'lobby') lobbyBind(); };

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});


// ---------- 손패 크기와 버림 애니메이션 ----------
// 내 패(왼쪽)와 공개된 패(오른쪽)가 한 줄에 들어가도록 패 너비를 정한다
function handTileWidth(h, myP) {
  const W = Math.min(520, document.documentElement.clientWidth || 390);
  const n = h.hand.length;
  const meldTiles = myP.melds.reduce((a, m) => a + (m.typ === 'K' ? 4 : 3) + (m.src === 'discard' ? 0.45 : 0), 0);
  const units = n + 0.8 * meldTiles + (meldTiles ? 0.6 : 0) + 0.3;
  const w = (W - 40 - (n + meldTiles) * 2) / units;
  return Math.round(Math.max(24, Math.min(46, w)) * 10) / 10;
}

// 상태가 바뀌기 직전에 상대 손패(뒷면)와 내 손패의 위치를 기억한다
function snapshotHands() {
  const o = { opp: {}, mine: {} };
  document.querySelectorAll('.opp[data-seat]').forEach((el) => {
    const s = Number(el.dataset.seat);
    o.opp[s] = {
      hand: [...el.querySelectorAll('.ohand .tile:not(.draw)')].map((t) => t.getBoundingClientRect()),
      draw: (el.querySelector('.ohand .tile.draw') || { getBoundingClientRect: () => null }).getBoundingClientRect(),
      card: el.getBoundingClientRect(),
    };
  });
  document.querySelectorAll('.hand [data-hand]').forEach((t) => { o.mine[t.dataset.hand] = t.getBoundingClientRect(); });
  return o;
}

// 버린 패가 손에서 강으로 날아가는 모습. 상대는 어느 패를 버렸는지 모르므로 쯔모기리가 아니면 손패 중 임의의 자리에서 나간다
function flyDiscard(e, snap) {
  if (Settings.calm) return;
  if (!S || !S.hand) return;
  const target = document.querySelector(`[data-river="${e.seat}"] .tile[data-id="${e.tile}"]`);
  if (!target) return;
  let src = null;
  if (e.seat === S.you) {
    src = (ui.sentRect && ui.sentRect.id === e.tile ? ui.sentRect.r : null) || snap.mine[e.tile] || null;
  } else {
    const o = snap.opp[e.seat];
    if (o) src = e.tsumogiri && o.draw ? o.draw : o.hand.length ? o.hand[Math.floor(Math.random() * o.hand.length)] : o.card;
  }
  const t = target.getBoundingClientRect();
  if (!src || !t.width) return;
  const fly = document.createElement('div');
  fly.innerHTML = tileHTML(e.tile, 'xs', '', e.seat);
  const tileEl = fly.firstElementChild;
  tileEl.style.setProperty('--tw', `${t.width}px`);
  Object.assign(fly.style, { position: 'fixed', left: `${t.left}px`, top: `${t.top}px`, margin: 0, zIndex: 25, pointerEvents: 'none', transformOrigin: 'top left' });
  tileEl.style.margin = '0';
  document.body.appendChild(fly);
  target.style.visibility = 'hidden';
  const sc = src.width / t.width;
  const anim = fly.animate([
    { transform: `translate(${src.left - t.left}px, ${src.top - t.top}px) scale(${sc}) rotate(${(Math.random() - .5) * 20}deg)`, opacity: .9 },
    { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
  ], { duration: 360, easing: 'cubic-bezier(.2,.8,.3,1)' });
  const done = () => { fly.remove(); target.style.visibility = ''; };
  anim.onfinish = done;
  anim.oncancel = done;
  setTimeout(done, 700);
}


// ---------- 시작 · 통신 연결점 ----------
// 정적 배포(github.io)에서는 net.js(Firebase)가 api·connect를 바꿔 끼우고 appStart()를 부른다
function appStart() {
  render();
  if (session) connect();
  // ?manual 로 열면 입문 설명부터
  if (new URLSearchParams(location.search).has('manual')) Guide.openManual();
}
// net.js가 새 상태를 넘길 때
function netState(s) {
  S = s;
  ui.skew = S.serverTime - Date.now();
  ui.busy = false;
  offline = false;
  onState();
}
function netOffline(v) { offline = v; renderBanner(); }
function netGone() {
  saveSession(null); S = null; ui.seen = -1;
  toast('방을 찾을 수 없어요. 처음 화면으로 돌아갑니다');
  render();
}
if (!window.JIMOTHY_STATIC) appStart();
