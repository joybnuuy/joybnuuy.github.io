// 방 하나의 상태와 진행: 좌석(사람/봇), 대국, 봇 구동, 시점별 상태 만들기.
// 통신과 무관하다. Node 서버(room.ts)와 브라우저 호스트(net.js, Firebase)가 함께 쓴다.
import { Hand } from './game.js';
                                                               
import { Match } from './match.js';
import { Bot } from './bot.js';

                                                                     

                       
               
                 
                                                                     
                 
                                                   
                     
 

                           
                                                  
                                                 
 

const BOT_NAMES = ['봇 가온', '봇 나래', '봇 다솜', '봇 라온'];
                                           
const randomSeed = ()         => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] || 1;

export class RoomCore {
  code        ;
  slots                  = [null, null, null, null];
  host = 0;                    // 방장 자리 (시작·설정 권한)
  phase            = 'lobby';
  botLevel = 1;
  turnSec = 40;
  hands = 8;                   // 4 = 동장전, 8 = 반장전
  match               = null;
  hand              = null;
  bots        = [];
  bundle      = null;          // 끝난 판 결과 (모든 손패 공개)
  events        = [];
  evId = 0;
  lastTouch = Date.now();
  handCount = 0;
  deadlines                         = {};
  nextDeadline = 0;
            fast         ;
            onChange            ;
            timers = new Map               ();
            scheduledPhase          = null;
            nextTimer               = null;

  constructor(code        , opts           = {}) {
    this.code = code;
    this.fast = !!opts.fast;
    this.onChange = opts.onChange ?? (() => {});
  }

  // ---------- 저장·되살리기 (호스트가 바뀔 때 이어받기용) ----------
  toJSON()      {
    return {
      v: 1, code: this.code, slots: this.slots, host: this.host, phase: this.phase, botLevel: this.botLevel, turnSec: this.turnSec,
      hands: this.hands, match: this.match, hand: this.hand, bundle: this.bundle, events: this.events, evId: this.evId,
      lastTouch: this.lastTouch, handCount: this.handCount, deadlines: this.deadlines, nextDeadline: this.nextDeadline,
    };
  }

  static fromJSON(d     , opts           = {})           {
    const r = new this(d.code, opts);
    Object.assign(r, {
      slots: d.slots, host: d.host, phase: d.phase, botLevel: d.botLevel, turnSec: d.turnSec, hands: d.hands,
      bundle: d.bundle ?? null, events: d.events ?? [], evId: d.evId ?? 0, lastTouch: d.lastTouch ?? Date.now(),
      handCount: d.handCount ?? 0, deadlines: d.deadlines ?? {}, nextDeadline: d.nextDeadline ?? 0,
    });
    r.match = d.match ? Match.revive(d.match) : null;
    r.hand = d.hand ? Hand.revive(d.hand) : null;
    r.bots = [0, 1, 2, 3].map((s) => new Bot(s, r.botLevel));
    return r;
  }

  // 되살린 뒤 호스트가 진행을 이어간다 (타이머 다시 걸기)
  resume()       {
    this.scheduledPhase = null;
    this.clearTimers();
    if (this.phase === 'playing') this.schedule();
    else if (this.phase === 'between') {
      const left = Math.max(1000, this.nextDeadline - Date.now());
      this.nextTimer = setTimeout(() => this.advance(), left);
      this.checkReady();
      this.broadcast();
    } else this.broadcast();
  }

  // ---------- 좌석 ----------
  humans()           {
    return [0, 1, 2, 3].filter((s) => this.slots[s]?.human);
  }

  // 사람 한 명을 앉힌다. 진행 중이면 봇 자리를 이어받는다
  addPlayer(name        , id        )         {
    let seat = this.slots.findIndex((x) => x === null);
    if (seat < 0) seat = this.slots.findIndex((x) => x && !x.human);
    if (seat < 0) return -1;
    this.slots[seat] = { name, human: true, id, ready: false, autoStreak: 0, connected: true };
    if (!this.slots[this.host]?.human) this.host = seat;
    if (this.phase !== 'lobby') {
      this.bots[seat] = new Bot(seat, this.botLevel);
      this.resetSeatTimer(seat);
      this.pushEvent({ t: 'join', seat, text: `${name} 님이 ${BOT_NAMES[seat]} 자리에 들어왔어요` });
      this.schedule();
    } else this.broadcast();
    this.touch();
    return seat;
  }

  seatOf(id        )         {
    return this.slots.findIndex((x) => x && x.human && x.id === id);
  }

  leave(seat        )       {
    const s = this.slots[seat];
    if (!s) return;
    if (this.phase === 'lobby') {
      this.slots[seat] = null;
      if (this.host === seat) {
        const h = this.humans().find((x) => x !== seat);
        this.host = h ?? 0;
      }
    } else {
      this.slots[seat] = this.botSlot(seat);
      this.bots[seat] = new Bot(seat, this.botLevel);
      if (this.host === seat) {
        const h = this.humans().find((x) => x !== seat);
        if (h !== undefined) this.host = h;
      }
      this.resetSeatTimer(seat);
      this.pushEvent({ t: 'leave', seat, text: `${s.name} 님이 나가서 봇이 이어서 합니다` });
    }
    this.touch();
    this.schedule();
  }

  // 접속 상태가 바뀌었을 때 (끊긴 사람은 시간 초과를 짧게)
  setConnected(seat        , on         )       {
    const s = this.slots[seat];
    if (!s || !s.human || s.connected === on) return;
    s.connected = on;
    if (on) s.autoStreak = 0; // 다시 들어오면 직접 두기로 돌아온다
    this.resetSeatTimer(seat);
    this.schedule();
  }

  // '자동'으로 두던 사람이 직접 두기로 돌아온다
  resumeManual(seat        )       {
    const s = this.slots[seat];
    if (!s || !s.human || s.autoStreak === 0) return;
    s.autoStreak = 0;
    this.resetSeatTimer(seat);
    this.schedule();
  }

            botSlot(seat        )       {
    return { name: BOT_NAMES[seat], human: false, id: '', ready: true, autoStreak: 0, connected: true };
  }

            resetSeatTimer(seat        )       {
    const t = this.timers.get(seat);
    if (t) clearTimeout(t);
    this.timers.delete(seat);
  }

  isConnected(seat        )          {
    const s = this.slots[seat];
    return !!s && s.human && s.connected;
  }

  nameOf(seat        )         {
    return this.slots[seat]?.name ?? BOT_NAMES[seat];
  }

  touch()       { this.lastTouch = Date.now(); }

  // 타이머를 모두 정리 (종료·테스트·호스트를 넘길 때)
  dispose()       {
    this.clearTimers();
    if (this.nextTimer) clearTimeout(this.nextTimer);
    this.nextTimer = null;
  }

  // ---------- 진행 ----------
  start(opts                                                         )       {
    if (this.phase !== 'lobby' && this.phase !== 'finished') throw new Error('이미 시작했어요');
    this.botLevel = opts.botLevel === 0 ? 0 : 1;
    this.turnSec = Math.max(10, Math.min(120, Math.round(opts.turnSec ?? this.turnSec)));
    this.hands = (opts.hands ?? this.hands) === 4 ? 4 : 8;
    for (let s = 0; s < 4; s++) {
      if (!this.slots[s]) this.slots[s] = this.botSlot(s);
      this.bots[s] = new Bot(s, this.botLevel);
    }
    // 마지막 국이 끝났을 때 3만 점 이상이 없으면 한 장(4국) 더 연장한다
    this.match = new Match({ seed: randomSeed(), hands: this.hands, maxHands: this.hands + 4 });
    this.events = [];
    this.startHand();
  }

            startHand()       {
    this.hand = this.match .newHand();
    this.handCount++;
    this.phase = 'playing';
    this.bundle = null;
    for (const s of this.slots) if (s) s.ready = !s.human;
    this.scheduledPhase = null;
    this.pushEvent({ t: 'hand', text: `${this.handTitle()} 시작` });
    this.schedule();
  }

  handTitle()         {
    const m = this.match ;
    const wind = ['동', '남', '서'][Math.min(2, Math.floor(m.handNo / 4))];
    return `${wind}${(m.handNo % 4) + 1}국${m.honba ? ` ${m.honba}본장` : ''}`;
  }

  act(seat        , a        )       {
    if (this.phase !== 'playing' || !this.hand) throw new Error('지금은 행동할 수 없어요');
    const s = this.slots[seat];
    if (s) s.autoStreak = 0;
    this.applyAction(seat, a);
  }

            applyAction(seat        , a        )       {
    const h = this.hand ;
    const before = this.snapshotCounts(h);
    h.act(seat, a);
    this.diffEvents(h, before, seat, a);
    this.touch();
    if (h.over) { this.onHandOver(); return; }
    this.schedule();
  }

            snapshotCounts(h      ) {
    return {
      river: h.players.map((p) => p.river.length),
      melds: h.players.map((p) => p.melds.length),
      riichi: h.players.map((p) => p.riichi),
      pub: h.pub.length,
      draw: h.players.map((p) => p.lastDraw),
    };
  }

            diffEvents(h      , b                                        , seat        , a        )       {
    for (const p of h.players) {
      if (p.river.length > b.river[p.seat]) {
        const r = p.river[p.river.length - 1];
        this.pushEvent({ t: 'discard', seat: p.seat, tile: r.tile, riichi: r.riichi, pub: r.noCall, tsumogiri: b.draw[p.seat] === r.tile });
      }
      if (p.riichi && !b.riichi[p.seat]) this.pushEvent({ t: 'riichi', seat: p.seat, double: p.double, text: `${this.nameOf(p.seat)} 리치!` });
      if (p.melds.length > b.melds[p.seat]) {
        const m = p.melds[p.melds.length - 1];
        const word = m.typ === 'S' ? '치' : m.typ === 'T' ? '퐁' : m.src === 'closed' ? '안깡' : '깡';
        this.pushEvent({ t: 'call', seat: p.seat, word: m.typ === 'S' ? 'chi' : m.typ === 'T' ? 'pon' : 'kan', text: `${this.nameOf(p.seat)} ${word}${m.src === 'public' ? ' (공개패)' : ''}`, pub: m.src === 'public' });
      }
    }
    if (h.pub.length > b.pub) this.pushEvent({ t: 'pub', tile: h.pub[h.pub.length - 1], text: `공개패 ${h.pub.length}번째` });
    if (a.t === 'kakan') this.pushEvent({ t: 'call', seat, word: 'kan', text: `${this.nameOf(seat)} 가깡` });
  }

  pushEvent(e     )       {
    this.events.push({ id: ++this.evId, ...e });
    if (this.events.length > 60) this.events.splice(0, this.events.length - 60);
  }

            onHandOver()       {
    const h = this.hand ;
    const m = this.match ;
    const r = h.result ;
    m.finishHand(h);
    this.clearTimers();
    this.bundle = {
      kind: r.kind,
      winners: r.winners.map((w) => ({
        seat: w.seat, how: w.how, winTile: w.winTile, total: w.total,
        yaku: w.ev.yaku, han: w.ev.han, ym: w.ev.ym, dora: w.ev.dora, coin: w.ev.coin, pts: w.ev.pts, base: w.ev.base, coinParts: w.ev.coinParts,
      })),
      from: r.from,
      draw: r.draw,
      deltas: r.deltas,
      scoresAfter: m.scores.slice(),
      dealerContinues: r.dealerContinues,
      players: h.players.map((p) => ({ seat: p.seat, hand: p.hand.slice(), melds: p.melds, riichi: p.riichi })),
      frontInd: h.frontInd.slice(),
      riichiInd: h.riichiInd.slice(),
      pub: h.pub.slice(),
      title: this.handTitle(),
    };
    if (r.kind === 'win') this.pushEvent({ t: 'win', winners: r.winners.map((w) => ({ seat: w.seat, how: w.how })), text: `${this.nameOf(r.winners[0].seat)} ${r.winners[0].how === 'ron' || r.winners[0].how === 'chankan' ? '론' : r.winners[0].how === 'public' ? '지모시' : '쯔모'}!` });
    else this.pushEvent({ t: 'draw', text: r.draw .reason === '유국' ? '유국' : `도중유국: ${r.draw .reason}` });
    if (m.finished) {
      this.phase = 'finished';
      this.bundle.final = { ranking: m.ranking(), scores: m.scores.slice() };
    } else {
      this.phase = 'between';
      this.nextDeadline = Date.now() + 25000;
      this.nextTimer = setTimeout(() => this.advance(), 25000);
    }
    this.broadcast();
    if (this.phase === 'between') this.checkReady();
  }

  ready(seat        )       {
    if (this.phase !== 'between') return;
    const s = this.slots[seat];
    if (s) s.ready = true;
    this.checkReady();
    this.broadcast();
  }

            checkReady()       {
    if (this.phase !== 'between') return;
    const hs = this.humans().filter((s) => this.isConnected(s));
    if (hs.length === 0 || hs.every((s) => this.slots[s] .ready)) this.advance();
  }

            advance()       {
    if (this.phase !== 'between') return;
    if (this.nextTimer) { clearTimeout(this.nextTimer); this.nextTimer = null; }
    this.startHand();
    this.broadcast();
  }

  restart()       {
    if (this.phase !== 'finished') return;
    this.phase = 'lobby';
    this.match = null; this.hand = null; this.bundle = null;
    for (let s = 0; s < 4; s++) {
      const sl = this.slots[s];
      if (sl && !sl.human) this.slots[s] = null;
    }
    this.broadcast();
  }

  // ---------- 봇·시간 초과 구동 ----------
            clearTimers()       {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.deadlines = {};
  }

  schedule()       {
    if (this.phase !== 'playing' || !this.hand) { this.broadcast(); return; }
    const h = this.hand;
    if (this.scheduledPhase !== h.phase) {
      this.clearTimers();
      this.scheduledPhase = h.phase;
    }
    const isTurn = h.phase.t === 'turn';
    for (const seat of h.waiting()) {
      if (this.timers.has(seat)) continue;
      const slot = this.slots[seat] ;
      let delay        ;
      // 리치한 사람은 버리는 것밖에 할 수 없으면 사람·봇 모두 0.5초 뒤 자동으로 버린다
      const acts = h.legal(seat);
      const riichiAuto = isTurn && h.players[seat].riichi && acts.length > 0 && acts.every((a) => a.t === 'discard');
      if (riichiAuto) delay = this.fast ? 0 : 500;
      else if (!slot.human) delay = this.fast ? 0 : 1700 + Math.random() * 600; // 봇은 약 2초 생각한다
      else {
        const afk = slot.autoStreak >= 2 || !this.isConnected(seat);
        delay = afk ? 1200 : this.turnSec * 1000;
        this.deadlines[seat] = Date.now() + delay;
      }
      const phaseRef = h.phase;
      this.timers.set(seat, setTimeout(() => {
        this.timers.delete(seat);
        if (this.phase !== 'playing' || this.hand !== h || h.phase !== phaseRef) return;
        if (!h.waiting().includes(seat)) return;
        try {
          const choice = riichiAuto ? h.legal(seat).find((a) => a.t === 'discard')  : this.bots[seat].decide(h.view(seat), h.legal(seat));
          if (slot.human && !riichiAuto) slot.autoStreak++;
          this.applyAction(seat, choice);
        } catch (e) {
          console.error('자동 행동 실패', e);
        }
      }, delay));
    }
    this.broadcast();
  }

  broadcast()       { this.onChange(); }

  // ---------- 시점별 상태 (상대 손패는 숨긴다) ----------
  stateFor(seat        )      {
    const me = this.slots[seat];
    const base      = {
      room: {
        code: this.code,
        phase: this.phase,
        host: this.host,
        botLevel: this.botLevel,
        turnSec: this.turnSec,
        hands: this.hands,
        seats: this.slots.map((s, i) => (s ? { seat: i, name: s.name, human: s.human, connected: s.human ? s.connected : true, ready: s.ready } : null)),
      },
      you: seat,
      youName: me?.name,
      events: this.events.slice(-25),
      serverTime: Date.now(),
    };
    if (this.phase === 'lobby') return base;
    const m = this.match ;
    base.match = { handNo: m.handNo, dealer: m.dealer, honba: m.honba, sticks: m.sticks, scores: m.scores.slice(), title: this.handTitle(), total: m.total, handCount: this.handCount };
    if (this.hand) base.hand = this.handView(seat);
    if (this.bundle) base.result = this.bundle;
    if (this.phase === 'between') base.nextDeadline = this.nextDeadline;
    return base;
  }

            handView(seat        )      {
    const h = this.hand ;
    const over = h.over;
    const waiting = h.waiting();
    const mine = h.players[seat];
    return {
      dealer: h.dealer,
      roundWind: h.roundWind,
      rnd: h.rnd,
      discards: h.discards,
      wallLeft: h.wall.length,
      honba: h.honba,
      sticks: h.sticks,
      scores: h.scores.slice(),
      frontInd: h.frontInd.slice(),
      riichiInd: h.riichiInd.slice(),
      frontHidden: 3 - h.frontInd.length,
      riichiHidden: 3 - h.riichiInd.length,
      pub: h.pub.slice(),
      usedPub: mine.usedPub.slice(),
      phase: h.phase.t,
      turnSeat: h.phase.t === 'turn' ? h.phase.seat : -1,
      // 반짝이는 자리: 차례인 사람. 치·퐁·깡·론을 정하는 동안에도 버린 사람에게 남겨 둔다. 공개패 페이즈는 자리 대신 공개패 쪽을 켠다
      glowSeat: h.phase.t === 'turn' ? h.phase.seat : h.phase.t === 'discard-resp' ? h.phase.from : h.phase.t === 'chankan-resp' ? h.phase.seat : -1,
      pubPhase: h.phase.t === 'pub-resp' || h.phase.t === 'pub-post',
      afterCall: h.phase.t === 'turn' ? h.phase.afterCall : false,
      forbid: h.phase.t === 'turn' ? h.phase.forbid : [],
      lastDiscard: h.phase.t === 'discard-resp' ? { from: h.phase.from, tile: h.phase.tile } : null,
      pubIdx: h.phase.t === 'pub-resp' ? h.phase.idx : -1,
      lastPub: h.phase.t === 'pub-resp' ? h.phase.last : false,
      waiting,
      deadline: this.deadlines[seat] ?? 0,
      hand: mine.hand.slice(),
      lastDraw: mine.lastDraw,
      legal: over ? [] : h.legal(seat),
      players: h.players.map((p) => ({
        seat: p.seat,
        name: this.nameOf(p.seat),
        human: !!this.slots[p.seat]?.human,
        melds: p.melds,
        river: p.river,
        riichi: p.riichi,
        double: p.double,
        handCount: p.hand.length,
        seatWind: h.seatWindKind(p.seat) - 27,
        auto: !!this.slots[p.seat]?.human && (this.slots[p.seat] .autoStreak >= 2),
      })),
    };
  }
}
