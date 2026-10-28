// 한 판(국) 진행 상태기계. 규칙서 기준.
// 사용: const g = new Hand({...}); while (!g.over) { for (const seat of g.waiting()) g.act(seat, choose(g.legal(seat))) }
import { DRAGONS, counts, doraOf, isRed, isYao, kindOf, shuffledWall } from './tiles.js';
                                                                  
import { evaluate } from './eval.js';
import { isComplete, shanten, waitsOf } from './shanten.js';

                    
                  
                                                    
                                
                                
                 
                              
                                                                

                       
                       
                                                              
                  
                                       
                                                               
                                                       
                                                  
 

                                                                                              

                         
               
                 
                
                     
                  
                  
                   
                                                  
                    
                       
                         
                                                             
 

                                                                                                                           

                             
                       
                    
                                                     
                                               
                                                                        
                           
                                                       
                                          
 

                           
                    
                 
                                                
                   
                
                 
                                
 

                                   
                   
                                                                                       
                                                                                                                 
                                                                                                                               
                                                                                                             
                                                                
                  

export const akey = (a        )         => {
  const x = a       ;
  return [a.t, x.tile ?? '', x.kind ?? '', x.pub ?? '', x.riichi ? 'r' : '', (x.tiles ?? []).slice().sort((p        , q        ) => p - q).join(',')].join('|');
};
const ceil100 = (x        )         => Math.ceil(x / 100) * 100;

export class Hand {
  rng              ;
  dealer        ;
  roundWind        ;
  honba        ;
  sticks        ;                  // 공탁 리치봉 (이전 국 + 이번 국)
  scores          ;
  wall          ;
  players          ;
  frontInd           = [];
  riichiInd           = [];
  frontPool           = [];
  riichiPool           = [];
  pub           = [];
  kans = 0;
  rnd = 1;
  discards = 0;
  roundEnd = false;
  noCalls = true;
  abort                = null;
  firstDiscs           = [];
  heavenSeat = -1;
  phase        = { t: 'over' };
  result                    = null;
  log        = [];
  requireRiichiPoints         ;
  stats                         = {};

  constructor(o          ) {
    this.rng = o.rng;
    this.dealer = o.dealer;
    this.roundWind = o.roundWind;
    this.honba = o.honba;
    this.sticks = o.sticks;
    this.scores = o.scores.slice();
    this.requireRiichiPoints = o.requireRiichiPoints ?? true;
    this.wall = shuffledWall(o.rng);
    this.players = [0, 1, 2, 3].map((seat) => ({
      seat, hand: [], melds: [], river: [], riichi: false, double: false, ippatsu: false,
      first: true, usedPub: [], tempFuriten: false, riichiFuriten: false, lastDraw: -1,
    }));
    for (const p of this.players) for (let i = 0; i < 7; i++) p.hand.push(this.wall.pop() );
    this.frontInd = [this.wall.pop() ];
    this.riichiInd = [this.wall.pop() ];
    this.frontPool = [this.wall.pop() , this.wall.pop() ];
    this.riichiPool = [this.wall.pop() , this.wall.pop() ];
    this.beginTurn(this.dealer);
  }

  get over()          { return this.phase.t === 'over'; }

  // JSON으로 저장했다 되살리기 (난수 함수와 진행 기록은 저장하지 않는다. 패산은 이미 섞여 있다)
  toJSON()      {
    const { rng: _r, log: _l, ...rest } = this       ;
    return rest;
  }
  static revive(data     )       {
    return Object.assign(Object.create(Hand.prototype), data, { rng: Math.random, log: [] });
  }
          bump(k        )       { this.stats[k] = (this.stats[k] ?? 0) + 1; }

  // ---------- 공통 계산 ----------
  seatWindKind(seat        )         { return 27 + ((seat - this.dealer + 4) % 4); }
          menzen(p        )          { return p.melds.every((m) => m.src !== 'discard'); }
          conc(p        , extra           = [])           { return counts([...p.hand, ...extra]); }
          meldIns(p        )           { return p.melds.map((m) => ({ typ: m.typ, t: m.t, src: m.src })); }

          doraCount(p        , allTiles          )         {
    const inds = p.riichi ? [...this.frontInd, ...this.riichiInd] : this.frontInd;
    let n = 0;
    for (const id of allTiles) {
      if (isRed(id)) n++;
      for (const ind of inds) if (kindOf(id) === doraOf(kindOf(ind))) n++;
    }
    return n;
  }

          pubAvail(p        , exclude        )           {
    const a = new Array        (34).fill(0);
    this.pub.forEach((t, i) => { if (i !== exclude && !p.usedPub.includes(i)) a[kindOf(t)]++; });
    return a;
  }

  // 화료 가능하면 판정 결과, 아니면 null. tile이 null이면 쯔모(손에 이미 들어 있음)
  evalWin(seat        , how     , tile               , pubIdx = -1)                    {
    const p = this.players[seat];
    const nm = p.melds.length;
    const winId = tile ?? p.lastDraw;
    if (winId < 0) return null;
    const c = tile === null ? this.conc(p) : this.conc(p, [tile]);
    if (!isComplete(c, nm)) return null;
    const all = [...p.hand, ...(tile === null ? [] : [tile]), ...p.melds.flatMap((m) => m.tiles)];
    const ctx          = {
      concealed: c, melds: this.meldIns(p), winKind: kindOf(winId), how,
      riichi: p.riichi, double: p.double, ippatsu: p.ippatsu,
      seatWind: this.seatWindKind(seat), roundWind: 27 + this.roundWind,
      dora: this.doraCount(p, all), pubAvail: this.pubAvail(p, pubIdx),
      finalRound: this.rnd === 6,
      heaven: how === 'tsumo' && this.heavenSeat === seat ? (seat === this.dealer ? 'tenhou' : 'chiho') : null,
    };
    return evaluate(ctx);
  }

          waitKinds(p        )           { return waitsOf(this.conc(p), p.melds.length); }

  isFuriten(p        )          {
    if (p.tempFuriten || p.riichiFuriten) return true;
    const w = this.waitKinds(p);
    return p.river.some((r) => w.includes(kindOf(r.tile)));
  }

  isTenpai(p        )          { return shanten(this.conc(p), p.melds.length) === 0; }

  // ---------- 진행 ----------
          draw()         {
    const t = this.wall.pop();
    if (t === undefined) throw new Error('패가 모자랍니다');
    return t;
  }

          beginTurn(seat        )       {
    const p = this.players[seat];
    const t = this.draw();
    p.hand.push(t);
    p.lastDraw = t;
    this.log.push({ t: 'draw', seat });
    if (this.rnd === 1 && p.first && p.melds.length === 0 && this.noCalls) {
      this.heavenSeat = seat;
      const kinds = new Set(p.hand.filter((x) => isYao(kindOf(x))).map(kindOf));
      if (kinds.size === 8 && p.hand.length === 8 && p.hand.every((x) => isYao(kindOf(x)))) {
        // 8종 8패 강제화료 (자요구 형태이면 자요구 천화·지화로 판정)
        const ev = this.evalWin(seat, 'tsumo', null);
        if (ev) { this.settleWin([{ seat, how: 'tsumo', winTile: t, ev, total: 0 }], -1); return; }
        const dora = this.doraCount(p, p.hand);
        const hv = 9 + dora;
        const pts = Math.min(30000, 2000 * hv + 1100);
        const e8             = { yaku: [['8종8패', 8], ['멘젠쯔모', 1]], han: 9, ym: [], dora, coin: 1100, pts, base: pts - 1100, coinParts: [['8종8패 기본', 800], ['멘젠', 300]] };
        this.settleWin([{ seat, how: '8종8패', winTile: t, ev: e8, total: 0, label: '8종8패' }], -1);
        return;
      }
    } else {
      this.heavenSeat = -1;
    }
    this.phase = { t: 'turn', seat, rinshan: false, afterCall: false, forbid: [] };
  }

  waiting()           {
    const ph = this.phase;
    switch (ph.t) {
      case 'turn': return [ph.seat];
      case 'discard-resp': case 'chankan-resp': case 'pub-resp':
        return ph.need.filter((s) => ph.resp[s] === undefined);
      case 'pub-post': return ph.need.filter((s) => ph.resp[s] === undefined);
      default: return [];
    }
  }

  legal(seat        )           {
    const ph = this.phase;
    const p = this.players[seat];
    if (ph.t === 'turn' && ph.seat === seat) return this.turnActions(p, ph);
    if ((ph.t === 'discard-resp' || ph.t === 'chankan-resp' || ph.t === 'pub-resp') && ph.need.includes(seat)) {
      return ph.resp[seat] === undefined ? ph.opts[seat] : [];
    }
    if (ph.t === 'pub-post' && ph.need.includes(seat) && ph.resp[seat] === undefined) {
      const out           = [];
      if (ph.kan.includes(seat) && this.evalWin(seat, 'rinshan', null)) out.push({ t: 'tsumo' });
      for (const id of new Set(p.hand)) {
        out.push({ t: 'discard', tile: id });
        if (this.canRiichiWith(p, id)) out.push({ t: 'discard', tile: id, riichi: true });
      }
      return out;
    }
    return [];
  }

          canRiichiWith(p        , id        )          {
    if (p.riichi || !this.menzen(p)) return false;
    if (this.requireRiichiPoints && this.scores[p.seat] < 1000) return false;
    const c = this.conc(p);
    c[kindOf(id)]--;
    return shanten(c, p.melds.length) === 0;
  }

          turnActions(p        , ph                               )           {
    const out           = [];
    if (ph.afterCall) {
      for (const id of new Set(p.hand)) if (!ph.forbid.includes(kindOf(id))) out.push({ t: 'discard', tile: id });
      return out;
    }
    const nm = p.melds.length;
    if (this.evalWin(p.seat, ph.rinshan ? 'rinshan' : 'tsumo', null)) out.push({ t: 'tsumo' });
    if (p.riichi) {
      out.push({ t: 'discard', tile: p.lastDraw });
      // 리치 후 안깡: 쯔모한 패로만, 대기가 바뀌지 않을 때
      const k = kindOf(p.lastDraw);
      if (nm < 2 && p.hand.filter((x) => kindOf(x) === k).length === 4) {
        const before = this.conc(p); before[k]--;
        const wb = waitsOf(before, nm).join(',');
        const after = this.conc(p); after[k] -= 4;
        if (wb === waitsOf(after, nm + 1).join(',') && wb !== '') out.push({ t: 'ankan', kind: k });
      }
      return out;
    }
    for (const id of new Set(p.hand)) {
      out.push({ t: 'discard', tile: id });
      if (this.canRiichiWith(p, id)) out.push({ t: 'discard', tile: id, riichi: true });
    }
    if (nm < 2) {
      const c = this.conc(p);
      for (let k = 0; k < 34; k++) if (c[k] === 4) out.push({ t: 'ankan', kind: k });
    }
    for (const m of p.melds) {
      if (m.typ === 'T' && p.hand.some((x) => kindOf(x) === m.t)) out.push({ t: 'kakan', kind: m.t });
    }
    return out;
  }

  act(seat        , a        )       {
    const ph = this.phase;
    const legal = this.legal(seat);
    const k = akey(a);
    if (!legal.some((x) => akey(x) === k)) throw new Error(`불법 행동 seat=${seat} ${JSON.stringify(a)} phase=${ph.t}`);
    if (ph.t === 'turn') return this.actTurn(seat, a, ph);
    if (ph.t === 'discard-resp' || ph.t === 'chankan-resp' || ph.t === 'pub-resp') {
      ph.resp[seat] = a;
      if (ph.need.every((s) => ph.resp[s] !== undefined)) {
        if (ph.t === 'discard-resp') this.resolveDiscard(ph);
        else if (ph.t === 'chankan-resp') this.resolveChankan(ph);
        else this.resolvePub(ph);
      }
      return;
    }
    if (ph.t === 'pub-post') {
      ph.resp[seat] = a;
      if (ph.need.every((s) => ph.resp[s] !== undefined)) this.resolvePubPost(ph);
    }
  }

  // ---------- 본인 차례 ----------
          actTurn(seat        , a        , ph                               )       {
    const p = this.players[seat];
    if (a.t === 'tsumo') {
      const how      = ph.rinshan ? 'rinshan' : 'tsumo';
      const ev = this.evalWin(seat, how, null) ;
      this.settleWin([{ seat, how, winTile: p.lastDraw, ev, total: 0 }], -1);
      return;
    }
    if (a.t === 'discard') { this.doDiscard(p, a.tile, !!a.riichi, false); this.openDiscardResp(seat, a.tile, ph.rinshan || false); return; }
    if (a.t === 'ankan') {
      const ids = p.hand.filter((x) => kindOf(x) === a.kind);
      p.hand = p.hand.filter((x) => kindOf(x) !== a.kind);
      p.melds.push({ typ: 'K', t: a.kind, tiles: ids, src: 'closed', from: -1 });
      this.afterKanDeclared(seat);
      return;
    }
    if (a.t === 'kakan') {
      const id = p.hand.find((x) => kindOf(x) === a.kind) ;
      const need           = [];
      const opts                           = {};
      for (let k = 1; k <= 3; k++) {
        const q = this.players[(seat + k) % 4];
        if (this.canRonTile(q, id, 'chankan')) { need.push(q.seat); opts[q.seat] = [{ t: 'ron' }, { t: 'pass' }]; }
      }
      this.bump('깡');
      if (need.length === 0) { this.finishKakan(seat, id); return; }
      this.phase = { t: 'chankan-resp', seat, tile: id, kind: a.kind, need, opts, resp: {} };
    }
  }

          finishKakan(seat        , id        )       {
    const p = this.players[seat];
    p.hand.splice(p.hand.indexOf(id), 1);
    const m = p.melds.find((x) => x.typ === 'T' && x.t === kindOf(id)) ;
    m.typ = 'K';
    m.tiles.push(id);
    m.added = id;
    this.kanCommon(seat, true);
  }

          afterKanDeclared(seat        )       {
    this.bump('깡');
    this.kanCommon(seat, true);
  }

  // 깡 선언 후 공통 처리: 도라 추가, 영상패
          kanCommon(seat        , rinshanDraw         )       {
    this.noCalls = false;
    this.heavenSeat = -1;
    for (const q of this.players) q.ippatsu = false;
    this.kans++;
    if (this.kans <= 2) {
      this.frontInd.push(this.frontPool.pop() );
      this.riichiInd.push(this.riichiPool.pop() );
    } else {
      this.roundEnd = true;
      this.bump('3번째깡_순종료');
    }
    if (this.kans >= 4 && !this.abort) this.abort = '사깡산라';
    if (rinshanDraw) {
      const p = this.players[seat];
      const t = this.draw();
      p.hand.push(t);
      p.lastDraw = t;
      this.phase = { t: 'turn', seat, rinshan: true, afterCall: false, forbid: [] };
    }
  }

  // ---------- 버림 ----------
          doDiscard(p        , id        , riichi         , viaPub         )       {
    const i = p.hand.indexOf(id);
    if (i < 0) throw new Error('손에 없는 패');
    p.hand.splice(i, 1);
    p.river.push({ tile: id, noCall: viaPub, riichi, called: false });
    if (p.riichi) p.ippatsu = false;
    else if (riichi) {
      p.riichi = true;
      p.ippatsu = true;
      p.double = this.rnd === 1 && this.noCalls && p.first;
      this.bump('리치 선언');
      if (this.players.every((q) => q.riichi) && !this.abort) this.abort = '사가리치';
    }
    if (this.rnd === 1 && this.noCalls && p.first && !viaPub) {
      this.firstDiscs.push(kindOf(id));
      if (this.firstDiscs.length === 4 && new Set(this.firstDiscs).size === 1 && this.firstDiscs[0] >= 27 && this.firstDiscs[0] < 31 && !this.abort) this.abort = '사풍연타';
    }
    p.first = false;
    p.tempFuriten = false;
    this.heavenSeat = -1;
    if (!viaPub) this.discards++;
    p.lastDraw = -1;
  }

  // 리치 선언패가 론당하지 않으면 리치봉 확정
          payRiichi(p        )       {
    const last = p.river[p.river.length - 1];
    if (last && last.riichi && !(last       ).paid) {
      (last       ).paid = true;
      this.scores[p.seat] -= 1000;
      this.sticks++;
    }
  }

          canRonTile(q        , id        , how                   )                    {
    if (this.isFuriten(q)) return null;
    return this.evalWin(q.seat, how, id);
  }

          kuikae(kind        , typ                 , start        )           {
    const f = [kind];
    if (typ === 'S') {
      if (kind === start && start % 9 + 3 <= 8) f.push(start + 3);
      if (kind === start + 2 && start % 9 - 1 >= 0) f.push(start - 1);
    }
    return f;
  }

  // 울기 후보 (치·퐁·깡)
          callOptions(q        , id        , allowChi         , pub                    , checkKuikae         )           {
    if (q.riichi || q.melds.length >= 2) return [];
    const k = kindOf(id);
    const out           = [];
    const same = q.hand.filter((x) => kindOf(x) === k);
    const hasDiscard = (rm          , forbid          )          => q.hand.some((x) => !rm.includes(x) && !(checkKuikae && forbid.includes(kindOf(x))));
    const mk = (t                       , tiles          )         => (pub === undefined ? { t, tiles } : { t, tiles, pub });
    if (same.length >= 2) {
      for (let i = 0; i < same.length; i++) for (let j = i + 1; j < same.length; j++) {
        if (hasDiscard([same[i], same[j]], [k])) out.push(mk('pon', [same[i], same[j]]));
      }
    }
    if (same.length >= 3) out.push(mk('kan', same.slice(0, 3)));
    if (allowChi && k < 27) {
      for (const a of [k - 2, k - 1, k]) {
        if (a < 0 || Math.floor(a / 9) !== Math.floor(k / 9) || a % 9 > 6) continue;
        const need = [a, a + 1, a + 2].filter((y) => y !== k);
        const c0 = q.hand.filter((x) => kindOf(x) === need[0]);
        const c1 = q.hand.filter((x) => kindOf(x) === need[1]);
        for (const x0 of c0) for (const x1 of c1) {
          if (hasDiscard([x0, x1], this.kuikae(k, 'S', a))) out.push(mk('chi', [x0, x1]));
        }
      }
    }
    return out;
  }

          openDiscardResp(from        , id        , _rinshan         )       {
    const need           = [];
    const opts                           = {};
    for (let k = 1; k <= 3; k++) {
      const q = this.players[(from + k) % 4];
      const o           = [];
      if (this.canRonTile(q, id, 'ron')) o.push({ t: 'ron' });
      o.push(...this.callOptions(q, id, k === 1, undefined, true));
      if (o.length) { o.push({ t: 'pass' }); need.push(q.seat); opts[q.seat] = o; }
    }
    if (need.length === 0) { this.payRiichi(this.players[from]); this.afterDiscard(from); return; }
    this.phase = { t: 'discard-resp', from, tile: id, need, opts, resp: {} };
  }

          markPasses(need          , resp      , opts                          )       {
    for (const s of need) {
      const q = this.players[s];
      if (opts[s].some((x) => x.t === 'ron') && resp[s].t !== 'ron') {
        q.tempFuriten = true;
        if (q.riichi) q.riichiFuriten = true;
      }
    }
  }

          resolveDiscard(ph                                       )       {
    const from = ph.from;
    this.markPasses(ph.need, ph.resp, ph.opts);
    const ron = ph.need.filter((s) => ph.resp[s].t === 'ron');
    if (ron.length) {
      if (ron.length === 3) { this.abort = '삼가화'; this.endAbort(); return; }
      const ws           = ron.map((s) => ({ seat: s, how: 'ron'       , winTile: ph.tile, ev: this.evalWin(s, 'ron', ph.tile) , total: 0 }));
      this.settleWin(ws, from);
      return;
    }
    this.payRiichi(this.players[from]);
    const pk = ph.need.find((s) => ph.resp[s].t === 'pon' || ph.resp[s].t === 'kan');
    const ck = ph.need.find((s) => ph.resp[s].t === 'chi');
    const caller = pk ?? ck;
    if (caller === undefined) { this.afterDiscard(from); return; }
    const a = ph.resp[caller]                                                 ;
    const q = this.players[caller];
    const fp = this.players[from];
    fp.river[fp.river.length - 1].called = true;
    for (const x of a.tiles) q.hand.splice(q.hand.indexOf(x), 1);
    const k = kindOf(ph.tile);
    const tiles = [...a.tiles, ph.tile];
    const start = a.t === 'chi' ? Math.min(...tiles.map(kindOf)) : k;
    q.melds.push({ typ: a.t === 'chi' ? 'S' : a.t === 'pon' ? 'T' : 'K', t: start, tiles, src: 'discard', from });
    this.bump('울기_버림패');
    this.noCalls = false;
    this.heavenSeat = -1;
    for (const x of this.players) x.ippatsu = false;
    if (a.t === 'kan') { this.bump('깡'); this.kanCommon(caller, true); return; }
    this.phase = { t: 'turn', seat: caller, rinshan: false, afterCall: true, forbid: this.kuikae(k, a.t === 'chi' ? 'S' : 'T', start) };
  }

          resolveChankan(ph                                       )       {
    this.markPasses(ph.need, ph.resp, ph.opts);
    const ron = ph.need.filter((s) => ph.resp[s].t === 'ron');
    if (ron.length) {
      if (ron.length === 3) { this.abort = '삼가화'; this.endAbort(); return; }
      const ws           = ron.map((s) => ({ seat: s, how: 'chankan'       , winTile: ph.tile, ev: this.evalWin(s, 'chankan', ph.tile) , total: 0 }));
      this.settleWin(ws, ph.seat);
      return;
    }
    this.finishKakan(ph.seat, ph.tile);
  }

          afterDiscard(from        )       {
    if (this.abort) { this.endAbort(); return; }
    if (this.roundEnd || this.discards >= 4) { this.startPub(); return; }
    this.beginTurn((from + 1) % 4);
  }

  // ---------- 공개패 페이즈 ----------
          startPub()       {
    if (this.rnd === 6) { this.riichiInd.push(...this.riichiPool); this.riichiPool = []; }
    const t = this.draw();
    this.pub.push(t);
    const idx = this.pub.length - 1;
    const last = this.rnd === 6;
    this.log.push({ t: 'pub', idx, tile: t });
    const need           = [];
    const opts                           = {};
    for (const q of this.players) {
      const cand = last ? this.pub.map((_, i) => i).filter((i) => !q.usedPub.includes(i)) : [idx];
      const o           = [];
      for (const i of cand) {
        if (this.evalWin(q.seat, 'public', this.pub[i], i)) o.push({ t: 'ron', pub: i });
        o.push(...this.callOptions(q, this.pub[i], true, i, false));
      }
      if (o.length) { o.push({ t: 'pass' }); need.push(q.seat); opts[q.seat] = o; }
    }
    if (need.length === 0) { this.afterPub(); return; }
    this.phase = { t: 'pub-resp', idx, last, need, opts, resp: {} };
  }

          resolvePub(ph                                   )       {
    const order = [0, 1, 2, 3].map((k) => (this.dealer + k) % 4);
    const rons = order.filter((s) => ph.resp[s]?.t === 'ron');
    if (rons.length) {
      if (rons.length === 4) { this.abort = '공개패4화료'; this.endAbort(); return; }
      const ws           = rons.map((s) => {
        const pub = (ph.resp[s]                             ).pub;
        return { seat: s, how: 'public'         , winTile: this.pub[pub], ev: this.evalWin(s, 'public', this.pub[pub], pub) , total: 0 };
      });
      this.settleWin(ws, -1);
      return;
    }
    const callers = order.filter((s) => ['pon', 'kan', 'chi'].includes(ph.resp[s]?.t));
    if (callers.length === 0) { this.afterPub(); return; }
    const kan           = [];
    this.noCalls = false;
    this.heavenSeat = -1;
    for (const s of callers) {
      const a = ph.resp[s]                                                 ;
      const q = this.players[s];
      const pubIdx = a.pub ;
      const id = this.pub[pubIdx];
      for (const x of a.tiles) q.hand.splice(q.hand.indexOf(x), 1);
      const tiles = [...a.tiles, id];
      const start = a.t === 'chi' ? Math.min(...tiles.map(kindOf)) : kindOf(id);
      q.melds.push({ typ: a.t === 'chi' ? 'S' : a.t === 'pon' ? 'T' : 'K', t: start, tiles, src: 'public', from: -1, pub: pubIdx });
      q.usedPub.push(pubIdx);
      this.bump('울기_공개패');
    }
    for (const x of this.players) x.ippatsu = false;
    for (const s of callers) {
      const a = ph.resp[s]                                                 ;
      if (a.t === 'kan') {
        kan.push(s);
        this.bump('깡');
        this.kanCommon(s, false);
        const q = this.players[s];
        const t = this.draw();
        q.hand.push(t);
        q.lastDraw = t;
      }
    }
    this.phase = { t: 'pub-post', need: callers, kan, resp: {} };
  }

          resolvePubPost(ph                                   )       {
    const order = [0, 1, 2, 3].map((k) => (this.dealer + k) % 4).filter((s) => ph.need.includes(s));
    // 깡으로 뽑은 영상패는 각자 자기 패라서, 여러 명이 동시에 영상개화할 수 있다
    const wins = order.filter((s) => ph.resp[s].t === 'tsumo');
    if (wins.length) {
      this.settleWin(wins.map((s) => ({ seat: s, how: 'rinshan'       , winTile: this.players[s].lastDraw, ev: this.evalWin(s, 'rinshan', null) , total: 0 })), -1);
      return;
    }
    for (const s of order) {
      const a = ph.resp[s]                                     ;
      this.doDiscard(this.players[s], a.tile, !!a.riichi, true);
    }
    for (const s of order) this.payRiichi(this.players[s]);
    this.afterPub();
  }

          afterPub()       {
    if (this.abort) { this.endAbort(); return; }
    if (this.rnd === 6) { this.endExhaust(); return; }
    this.rnd++;
    this.discards = 0;
    this.roundEnd = false;
    this.beginTurn(this.dealer);
  }

  // ---------- 종료 처리 ----------
          finish(r            )       {
    this.result = r;
    this.phase = { t: 'over' };
  }

          endAbort()       {
    this.finish({ kind: 'draw', winners: [], from: -1, draw: { reason: this.abort , tenpai: [false, false, false, false] }, deltas: [0, 0, 0, 0], dealerContinues: true, sticksLeft: this.sticks, rnd: this.rnd });
  }

          endExhaust()       {
    const tenpai = this.players.map((p) => this.isTenpai(p));
    const nt = tenpai.filter(Boolean).length;
    const deltas = [0, 0, 0, 0];
    if (nt > 0 && nt < 4) {
      const gain = 3000 / nt;
      const loss = 3000 / (4 - nt);
      for (let s = 0; s < 4; s++) deltas[s] = tenpai[s] ? gain : -loss;
    }
    this.finish({ kind: 'draw', winners: [], from: -1, draw: { reason: '유국', tenpai }, deltas, dealerContinues: tenpai[this.dealer], sticksLeft: this.sticks, rnd: this.rnd });
  }

  // 화료 정산
          settleWin(ws          , from        )       {
    const deltas = [0, 0, 0, 0];
    const ronLike = ws[0].how === 'ron' || ws[0].how === 'chankan';
    const order = (s        )         => (ronLike ? (s - from + 4) % 4 : (s - this.dealer + 4) % 4);
    ws.sort((a, b) => order(a.seat) - order(b.seat));
    const winSeats = ws.map((w) => w.seat);
    ws.forEach((w, i) => {
      const head = i === 0;
      const total = ceil100(w.ev.pts * (w.seat === this.dealer ? 1.5 : 1));
      w.total = total;
      if (ronLike) {
        const pay = total + (head ? 300 * this.honba : 0);
        deltas[w.seat] += pay;
        deltas[from] -= pay;
        return;
      }
      // 쯔모·영상개화·공개패 화료: 화료하지 못한 사람들이 부담
      const others = [0, 1, 2, 3].filter((s) => s !== w.seat);
      const share = (s        )         => (w.seat === this.dealer ? ceil100(total / 3) : s === this.dealer ? ceil100(total / 2) : ceil100(total / 4));
      const losers = others.filter((s) => !winSeats.includes(s));
      const extra = others.filter((s) => winSeats.includes(s)).reduce((a, s) => a + share(s), 0);
      const bonus = head ? 300 * this.honba : 0;
      for (const s of losers) {
        const pay = share(s) + ceil100(extra / losers.length) + ceil100(bonus / losers.length);
        deltas[s] -= pay;
        deltas[w.seat] += pay;
      }
    });
    deltas[ws[0].seat] += 1000 * this.sticks;
    this.finish({ kind: 'win', winners: ws, from, deltas, dealerContinues: winSeats.includes(this.dealer), sticksLeft: 0, rnd: this.rnd });
  }

  // ---------- 관전/봇용 시점 ----------
  view(seat        )      {
    const ph = this.phase;
    const pub = (x        ) => ({ melds: x.melds, river: x.river, riichi: x.riichi, double: x.double, handCount: x.hand.length });
    return {
      seat, dealer: this.dealer, roundWind: this.roundWind, honba: this.honba, sticks: this.sticks,
      scores: this.scores.slice(), rnd: this.rnd, discards: this.discards, wallLeft: this.wall.length,
      hand: this.players[seat].hand.slice(), me: this.players[seat],
      players: this.players.map(pub),
      pub: this.pub.slice(), usedPub: this.players[seat].usedPub.slice(),
      frontInd: this.frontInd.slice(), riichiInd: this.riichiInd.slice(),
      phase: ph.t, turnSeat: ph.t === 'turn' ? ph.seat : -1,
      lastDiscard: ph.t === 'discard-resp' ? { from: ph.from, tile: ph.tile } : null,
      pubIdx: ph.t === 'pub-resp' ? ph.idx : -1, lastPub: ph.t === 'pub-resp' ? ph.last : false,
      seatWind: this.seatWindKind(seat),
    };
  }
}

export { DRAGONS };
