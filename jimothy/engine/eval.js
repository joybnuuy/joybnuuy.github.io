// 화료형 판정과 점수 계산 (규칙서 "역 목록", "점수 계산" 기준)
import { DRAGONS, GREEN, TERMS, isHonor, isTerm, isYao, kindName } from './tiles.js';

                                                                     
                                     
                                                                                        

                          
                                                     
                  
                  
           
                  
                  
                   
                                       
                                       
                                                                
                                                                          
                                                    
                                    
 

                             
                           
                                             
                                      
               
                                      
                                                   
                                                           
                                          
 

                                         

function meldDecomp(c          , i = 0)          {
  while (i < 34 && c[i] === 0) i++;
  if (i === 34) return [[]];
  const res          = [];
  if (c[i] >= 3) {
    c[i] -= 3;
    for (const r of meldDecomp(c, i)) res.push([{ typ: 'T', t: i }, ...r]);
    c[i] += 3;
  }
  if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
    c[i]--; c[i + 1]--; c[i + 2]--;
    for (const r of meldDecomp(c, i)) res.push([{ typ: 'S', t: i }, ...r]);
    c[i]++; c[i + 1]++; c[i + 2]++;
  }
  return res;
}

                                                                      

export function evaluate(x         )                    {
  const c = x.concealed.slice();
  const nm = x.melds.length;
  const needM = 2 - nm;
  const menzen = x.melds.every((m) => m.src !== 'discard');
  const full = c.slice();
  for (const m of x.melds) {
    if (m.typ === 'S') { full[m.t]++; full[m.t + 1]++; full[m.t + 2]++; } else full[m.t] += m.typ === 'K' ? 4 : 3;
  }
  const present           = [];
  for (let t = 0; t < 34; t++) if (full[t]) present.push(t);
  const ronLike = x.how === 'ron' || x.how === 'chankan';
  const coinWin = ronLike || x.how === 'public';

  const common                     = [];
  if (x.riichi) common.push(x.double ? ['더블리치', 2] : ['리치', 1]);
  if (x.riichi && x.ippatsu) common.push(['일발', 1]);
  if (menzen && (x.how === 'tsumo' || x.how === 'rinshan')) common.push(['멘젠쯔모', 1]);
  if (x.how === 'rinshan') common.push(['영상개화', 1]);
  if (x.how === 'chankan') common.push(['창깡', 1]);
  if (present.every((t) => !isYao(t))) common.push(['탕야오', 1]);
  const suits = new Set(present.filter((t) => t < 27).map((t) => Math.floor(t / 9)));
  const hon = present.some((t) => t >= 27);
  if (suits.size === 1 && !hon) common.push(['청일색', menzen ? 6 : 5]);
  else if (suits.size === 1 && hon) common.push(['혼일색', menzen ? 3 : 2]);
  const hro = present.every((t) => isYao(t)) && hon && present.some((t) => isTerm(t));
  if (hro) common.push(['혼노두', 2]);
  if (x.finalRound) common.push(['6순화료', 0]);

  const heavenYm = x.heaven === 'tenhou' ? '천화' : x.heaven === 'chiho' ? '지화' : null;
  const yakuhaiKinds = [...DRAGONS, x.roundWind, x.seatWind];

  const finish = (yk                    , ym          , coinBase        , setsX        , pr        , wait        , baseLabel = '', waitName = '')                    => {
    const han = yk.reduce((a, [, h]) => a + h, 0);
    const valid = ym.length > 0 || han >= 1 || (x.finalRound && x.dora >= 1);
    if (!valid) return null;
    let coin = coinBase;
    const parts                     = [];
    if (coinBase) parts.push([baseLabel, coinBase]);
    for (const s of setsX) {
      if (s.typ === 'S') continue;
      const u = (isYao(s.t) ? 2 : 1) * (s.ank ? 2 : 1) * (s.typ === 'K' ? 4 : 1);
      coin += 100 * u;
      parts.push([`${kindName(s.t)} ${s.ank ? '암' : '명'}${s.typ === 'K' ? '깡' : '커'}`, 100 * u]);
    }
    if (pr >= 0 && yakuhaiKinds.includes(pr)) { coin += 100; parts.push(['역패 머리', 100]); }
    if (wait) { coin += wait; parts.push([`${waitName} 대기`, wait]); }
    if (menzen) { coin += 300; parts.push(['멘젠', 300]); }
    if (coinWin) { coin += 300; parts.push([x.how === 'public' ? '론 (지모시)' : '론', 300]); }
    const hv = han + x.dora + 13 * ym.length;
    let b = 1000 * hv;
    if (b + coin > 5000) b *= 2;
    return { yaku: yk, han, ym, dora: x.dora, coin, pts: Math.min(30000, b + coin), base: b, coinParts: parts };
  };

  let best                    = null;
  const consider = (r                   )       => {
    if (r && (!best || r.pts > best.pts || (r.pts === best.pts && r.han > best.han))) best = r;
  };
  const withHeaven = (ym          )           => (heavenYm ? [...ym, heavenYm] : ym);

  if (nm === 0) {
    const total = c.reduce((a, b) => a + b, 0);
    // 스이쯔: 서로 다른 또이쯔 4개
    if (total === 8 && c.filter((v) => v === 2).length === 4 && c.every((v) => v === 0 || v === 2)) {
      consider(finish([...common, ['스이쯔', 2]], withHeaven([]), 0, [], -1, 0, '스이쯔 기본'));
    }
    // 자요구: 자패 7종 + 1·9패 1장
    let honorsOk = true;
    for (let t = 27; t < 34; t++) if (c[t] !== 1) honorsOk = false;
    if (honorsOk && TERMS.reduce((a, t) => a + c[t], 0) === 1 && total === 8) {
      consider(finish([...common], withHeaven(['자요구']), 800, [], -1, 0, '자요구 기본'));
    }
  }

  // 기본형 3+3+2
  for (let pr = 0; pr < 34; pr++) {
    if (c[pr] < 2) continue;
    c[pr] -= 2;
    for (const blocks of meldDecomp(c)) {
      if (blocks.length !== needM) continue;
      // 화료패가 들어간 자리 (머리 / 각 몸통)
      const places           = []; // -1 = 머리
      if (pr === x.winKind) places.push(-1);
      const seen = new Set        ();
      blocks.forEach((b, i) => {
        const has = b.typ === 'T' ? b.t === x.winKind : x.winKind >= b.t && x.winKind <= b.t + 2;
        const key = `${b.typ}${b.t}`;
        if (has && !seen.has(key)) { seen.add(key); places.push(i); }
      });
      for (const pl of places) {
        const setsX         = blocks.map((b, i) => ({
          typ: b.typ,
          t: b.t,
          ank: b.typ === 'T' && !(ronLike && pl === i),
          conc: true,
        }));
        for (const m of x.melds) setsX.push({ typ: m.typ, t: m.t, ank: m.typ !== 'S' && m.src !== 'discard', conc: false });

        // 대기 형태
        let wait = 0;
        let ryanmen = false;
        let waitName = '';
        if (pl === -1) { wait = 100; waitName = '단기'; }
        else {
          const b = blocks[pl];
          if (b.typ === 'S') {
            if (x.winKind === b.t + 1) { wait = 100; waitName = '간짱'; }
            else if ((x.winKind === b.t && b.t % 9 === 6) || (x.winKind === b.t + 2 && b.t % 9 === 0)) { wait = 100; waitName = '변짱'; }
            else ryanmen = true;
          }
        }

        const yk                     = [...common];
        const ym           = [];
        for (const s of setsX) {
          if (s.typ === 'S') continue;
          for (const k of [...DRAGONS, x.roundWind, x.seatWind]) if (s.t === k) yk.push(['역패', 1]);
        }
        if (setsX.every((s) => s.typ !== 'S')) yk.push(['또이또이', 2]);
        if (setsX.every((s) => s.ank && s.typ !== 'S')) ym.push('량안커');
        if (setsX.every((s) => s.typ === 'K')) ym.push('량깡쯔');
        if (menzen && setsX.every((s) => s.typ === 'S') && !yakuhaiKinds.includes(pr) && ryanmen) yk.push(['핑후', 1]);
        if (menzen && setsX.length === 2 && setsX[0].typ === 'S' && setsX[1].typ === 'S' && setsX[0].t === setsX[1].t) yk.push(['이페코', 1]);
        // 이색동순·이색동각: 두 몸통이 같은 숫자이고 색만 다름. 울어도 1판 (삼색동순·삼색동각에 대응)
        if (setsX.length === 2 && setsX[0].t < 27 && setsX[1].t < 27 && setsX[0].t % 9 === setsX[1].t % 9 && Math.floor(setsX[0].t / 9) !== Math.floor(setsX[1].t / 9)) {
          if (setsX[0].typ === 'S' && setsX[1].typ === 'S') yk.push(['이색동순', 1]);
          else if (setsX[0].typ !== 'S' && setsX[1].typ !== 'S') yk.push(['이색동각', 1]);
        }
        const hasY = (s      )          => (s.typ === 'S' ? s.t % 9 === 0 || s.t % 9 === 6 : isYao(s.t));
        const hasT = (s      )          => s.t < 27 && (s.typ === 'S' ? s.t % 9 === 0 || s.t % 9 === 6 : s.t % 9 === 0 || s.t % 9 === 8);
        if (setsX.every(hasT) && isTerm(pr)) yk.push(['준찬타', menzen ? 3 : 2]);
        else if (setsX.every(hasY) && isYao(pr) && !hro) yk.push(['찬타', menzen ? 2 : 1]);
        const pubHas = x.pubAvail[pr] > 0;
        if (DRAGONS.includes(pr) && setsX.every((s) => s.typ !== 'S' && DRAGONS.includes(s.t))) {
          yk.push(['소삼원', 2]);
          if (pubHas) ym.push('대삼원');
        }
        if (pubHas) {
          if (present.every((t) => isHonor(t))) ym.push('자일색');
          if (present.every((t) => isTerm(t))) ym.push('청노두');
          if (present.every((t) => GREEN.has(t))) ym.push('녹일색');
        }
        consider(finish(yk, withHeaven(ym), 600, setsX, pr, wait, '화료 기본', waitName));
      }
    }
    c[pr] += 2;
  }
  return best;
}
