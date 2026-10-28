// Jimothy 마작 봇. view(관측 가능한 정보)와 합법 행동 목록만 보고 하나를 고른다.
// level 0: 시뮬레이터 AI와 같은 동작 (리치·울기 판단만, 수비 없음)
// level 1: 상대가 리치했는데 내 손이 매우 멀면(3샨텐 이상) 안전패를 먼저 버린다. 6순 안에 끝나는 게임이라 더 일찍 접으면 오히려 손해다
import { DRAGONS, counts, doraOf, isYao, kindOf } from './tiles.js';
import { shanten } from './shanten.js';
                                        

export class Bot {
  seat        ;
  level        ;
  constructor(seat        , level = 1) {
    this.seat = seat;
    this.level = level;
  }

  decide(v     , legal          )         {
    if (legal.length === 1) return legal[0];
    const tsumo = legal.find((a) => a.t === 'tsumo');
    if (tsumo) return tsumo;
    const ron = legal.find((a) => a.t === 'ron');
    if (ron) return ron;
    const discards = legal.filter((a)                                         => a.t === 'discard');
    const calls = legal.filter((a) => a.t === 'pon' || a.t === 'kan' || a.t === 'chi');
    if (v.phase === 'turn' || v.phase === 'pub-post') return this.decideTurn(v, legal, discards);
    return this.decideCall(v, legal, calls);
  }

  // ---------- 공통 계산 ----------
          unseen(v     )           {
    const ids = new Set        (v.hand);
    for (const p of v.players) {
      for (const m of p.melds) for (const t of m.tiles) ids.add(t);
      for (const r of p.river) ids.add(r.tile);
    }
    for (const t of v.pub) ids.add(t);
    for (const t of v.frontInd) ids.add(t);
    for (const t of v.riichiInd) ids.add(t);
    const seen = counts([...ids]);
    return seen.map((n) => Math.max(0, 4 - n));
  }

          plan(v     , extraMeldTiles           = [])                  {
    const melds = v.me.melds;
    const kinds           = extraMeldTiles.map(kindOf);
    for (const m of melds) for (const t of m.tiles) kinds.push(kindOf(t));
    if (melds.some((m     ) => m.src === 'discard') || extraMeldTiles.length) {
      if (kinds.length && kinds.every((k) => !isYao(k))) return 'tanyao';
    }
    return null;
  }

          sh(c          , nm        , plan                 )         {
    if (plan === 'tanyao') return shanten(c.map((x, k) => (isYao(k) ? 0 : x)), nm);
    return shanten(c, nm);
  }

          ukeire(c          , nm        , plan                 , un          , s        )         {
    let u = 0;
    for (let t = 0; t < 34; t++) {
      if (un[t] <= 0 || c[t] >= 4) continue;
      c[t]++;
      if (this.sh(c, nm, plan) < s) u += un[t];
      c[t]--;
    }
    return u;
  }

          danger(v     , kind        )         {
    const riichis = v.players.map((p     , i        ) => ({ p, i })).filter((x     ) => x.p.riichi && x.i !== v.seat);
    if (!riichis.length) return 0;
    let worst = 0;
    for (const { p } of riichis) {
      let d        ;
      if (p.river.some((r     ) => kindOf(r.tile) === kind)) d = 0;
      else if (kind >= 27) d = 2;
      else if (kind % 9 === 0 || kind % 9 === 8) d = 3;
      else if (kind % 9 === 1 || kind % 9 === 7) d = 4;
      else d = 5;
      worst = Math.max(worst, d);
    }
    return worst;
  }

  // ---------- 내 차례 ----------
          decideTurn(v     , legal          , discards                                     )         {
    const nm = v.me.melds.length;
    const plan = this.plan(v);
    const un = this.unseen(v);
    const c = counts(v.hand);

    // 깡: 손이 나빠지지 않을 때만
    const base = this.bestShAfterDiscard(c, nm, plan);
    for (const a of legal) {
      if (a.t === 'ankan') {
        const c2 = c.slice(); c2[a.kind] -= 4;
        if (this.sh(c2, nm + 1, plan) <= base) return a;
      }
      if (a.t === 'kakan') {
        const c2 = c.slice(); c2[a.kind]--;
        if (this.sh(c2, nm, plan) <= base) return a;
      }
    }

    const fold = this.level >= 1 && v.players.some((p     , i        ) => p.riichi && i !== v.seat) && base >= 3 && !v.me.riichi;
    const tiles = new Map                                             ();
    for (const a of discards) {
      const k = kindOf(a.tile);
      if (!tiles.has(k)) tiles.set(k, []);
      tiles.get(k) .push(a);
    }
    let best                                                                 = null;
    for (const [k, list] of tiles) {
      c[k]--;
      const s = this.sh(c, nm, plan);
      const u = s <= 3 ? this.ukeire(c, nm, plan, un, s) : 0;
      c[k]++;
      // riichi 가능하면 리치로 버린다. 적도라는 가능하면 남긴다
      const rl = list.filter((a) => a.riichi);
      const pool = rl.length ? rl : list;
      const a = pool.sort((x, y) => (this.red(x.tile) ? 1 : 0) - (this.red(y.tile) ? 1 : 0))[0];
      const key = fold ? [this.danger(v, k), s, -u] : [s, -u, isYao(k) ? 0 : 1, rl.length ? 0 : 1];
      if (!best || this.less(key, best.key)) best = { key, a };
    }
    return best ? best.a : discards[0];
  }

          red(id        )          {
    return (id & 3) === 0 && [4, 13, 22].includes(id >> 2);
  }

          less(a          , b          )          {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] < b[i];
    }
    return false;
  }

          bestShAfterDiscard(c          , nm        , plan                 )         {
    let b = 9;
    for (let k = 0; k < 34; k++) {
      if (!c[k]) continue;
      c[k]--;
      b = Math.min(b, this.sh(c, nm, plan));
      c[k]++;
    }
    return b;
  }

  // ---------- 울기 판단 ----------
          decideCall(v     , legal          , calls          )         {
    const pass = legal.find((a) => a.t === 'pass')          ;
    if (!calls.length) return pass;
    const nm = v.me.melds.length;
    const c = counts(v.hand);
    const planNow = this.plan(v);
    const s0 = this.sh(c, nm, planNow);
    const isPub = v.phase === 'pub-resp';
    const tenpaiNow = shanten(c, nm) === 0;
    let best                                               = null;
    for (const a of calls                                                   ) {
      const tile = isPub ? v.pub[a.pub ] : v.lastDiscard.tile;
      const k = kindOf(tile);
      const mt = [...a.tiles, tile];
      const dragonOrWind = (a.t !== 'chi') && (DRAGONS.includes(k) || k === 27 + v.roundWind || k === v.seatWind);
      let ok = false;
      let plan                  = planNow;
      if (isPub) {
        ok = true; // 공개패로 울어도 멘젠이 유지되므로 손만 좋아지면 운다
        if (planNow === 'tanyao' && mt.some((t) => isYao(kindOf(t)))) ok = false;
      } else if (dragonOrWind) ok = true;
      else if (v.me.melds.some((m     ) => m.typ !== 'S' && (DRAGONS.includes(m.t) || m.t === 27 + v.roundWind || m.t === v.seatWind))) ok = true;
      else if (mt.every((t) => !isYao(kindOf(t))) && v.me.melds.every((m     ) => m.tiles.every((t        ) => !isYao(kindOf(t))))) {
        const yc = c.reduce((acc, x, kk) => acc + (isYao(kk) ? x : 0), 0);
        if (yc <= 2) { ok = true; plan = 'tanyao'; }
      }
      if (!ok && v.rnd === 6 && v.frontInd.some((i        ) => v.hand.some((t        ) => kindOf(t) === doraOf(kindOf(i))))) ok = true;
      const c2 = c.slice();
      for (const t of a.tiles) c2[kindOf(t)]--;
      // 마지막 공개패 페이즈에는 텐파이를 만들려고 역과 상관없이 울 수 있다
      const lastPhase = isPub && v.lastPub;
      const nm2 = nm + 1;
      let s1        ;
      if (a.t === 'kan') s1 = this.sh(c2, nm2, plan);
      else s1 = this.bestShAfterDiscard(c2, nm2, plan);
      const makesTenpai = lastPhase && !tenpaiNow && this.bestShAfterDiscard(c2, nm2, null) === 0;
      if (!ok && !makesTenpai) continue;
      if (s1 < s0 || makesTenpai) {
        const pri = a.t === 'chi' ? 1 : 0;
        const sBest = makesTenpai ? -1 : s1;
        if (!best || sBest < best.s || (sBest === best.s && pri < best.pri)) best = { s: sBest, a, pri };
      }
    }
    return best ? best.a : pass;
  }
}

