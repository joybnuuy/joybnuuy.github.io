// 설정 · 입문 매뉴얼 · 대국 중 첫 등장 힌트
// app.js보다 먼저 불러온다. tileHTML, api, toast 같은 함수는 실제로 호출될 때 app.js에 있으면 된다.

// ---------- 설정 (이 기기에만 저장) ----------
const SETTINGS_DEFAULT = { labels: 'hand', lang: 'ko', hints: true, tileSound: true, voice: true, vibrate: true, tapMode: 'double', calm: false };
const Settings = (() => {
  let s = { ...SETTINGS_DEFAULT };
  try { Object.assign(s, JSON.parse(localStorage.getItem('jimothy-settings') || '{}')); } catch { /* 기본값 */ }
  return s;
})();
function saveSettings() {
  try { localStorage.setItem('jimothy-settings', JSON.stringify(Settings)); } catch { /* 저장 불가 */ }
  document.body.classList.toggle('calm', !!Settings.calm);
}
document.addEventListener('DOMContentLoaded', () => document.body.classList.toggle('calm', !!Settings.calm));

const Guide = (() => {
  // '234m 55s 1z' 같은 표기를 패 id로. 0m/0p/0s는 적도라 5
  function ids(str) {
    const out = [];
    for (const tok of str.trim().split(/\s+/)) {
      const suit = tok.at(-1);
      for (const d of tok.slice(0, -1)) {
        const n = Number(d);
        if (suit === 'z') { out.push((27 + n - 1) * 4 + 1); continue; }
        const base = { m: 0, p: 9, s: 18 }[suit];
        out.push(n === 0 ? (base + 4) * 4 : (base + n - 1) * 4 + 1);
      }
    }
    return out;
  }
  const lbl = () => (Settings.labels === 'off' ? '' : ' lbl');
  // 패 묶음. 공백으로 나눈 묶음 사이를 조금 띄운다
  const T = (str, cls = '') => `<span class="gtiles">${str.trim().split(/\s+/).map((g) => `<span class="ggrp">${ids(g).map((id) => tileHTML(id, `gt${lbl()} ${cls}`)).join('')}</span>`).join('')}</span>`;
  const one = (str, cls = '') => tileHTML(ids(str)[0], `gt${lbl()} ${cls}`);

  // ---------- 매뉴얼 카드 ----------
  // part: 'base' = 필수, 'more' = 더 알아보기
  const CARDS = [
    { part: 'base', title: 'Jimothy 마작은?', body: () => `
      <p class="lead">패 <b>8장</b>으로 정해진 모양을 먼저 만들면 이겨요.</p>
      <p>4명이 번갈아 패를 가져오고 버리면서 손을 완성해요. 한 판은 <b>6순</b> 안에 끝나서 아주 빨라요.</p>
      <p class="muted2">리치마작을 몰라도 괜찮아요. 꼭 필요한 것만 차례대로 알려 드릴게요.</p>` },
    { part: 'base', title: '패 읽기', body: () => `
      <p>숫자패는 세 종류이고, 각각 <b>1~9</b>가 있어요.</p>
      <div class="grow"><span class="gname">만</span>${T('123456789m')}</div>
      <div class="grow"><span class="gname">통</span>${T('123456789p')}</div>
      <div class="grow"><span class="gname">삭</span>${T('123456789s')}</div>
      <p>글자패(자패)는 바람 4종과 삼원패 3종이에요.</p>
      <div class="grow"><span class="gname">바람</span>${T('1234z')}<span class="gname">삼원</span>${T('567z')}</div>
      <p class="muted2">같은 패는 4장씩 있어요. 빨간 5는 보너스 패(적도라)예요. ${one('0p')}</p>
      <div class="gset">패에 글자 표시: ${seg('labels', [['off', '끔'], ['hand', '내 손패만'], ['all', '모든 패']])}</div>` },
    { part: 'base', title: '완성 모양', body: () => `
      <p><b>몸통 2개 + 머리 1개</b> = 8장이면 완성이에요.</p>
      <div class="gex"><span>몸통 (같은 패 3장)</span>${T('555p')}</div>
      <div class="gex"><span>몸통 (이어진 숫자 3장)</span>${T('345s')}</div>
      <div class="gex"><span>머리 (같은 패 2장)</span>${T('77z')}</div>
      <div class="gex ok"><span>완성!</span>${T('555p 345s 77z')}</div>
      <p class="muted2">이어진 숫자는 같은 종류끼리만 돼요. 글자패는 이어지지 않아요. 같은 패 2장씩 4쌍 같은 특별한 모양도 있어요.</p>`,
      ox: { q: '이 8장은 완성일까요?', items: [
        ['2m 3p 4m 567s 99m', false, '2만·3통·4만은 숫자는 이어지지만 종류가 달라서 몸통이 아니에요.'],
        ['345p 777s 11z', true, '맞아요! 이어진 숫자 345통, 같은 패 777삭, 머리 동동이에요.'],
        ['567z 234m 88p', false, '백·발·중은 글자패라 이어지지 않아요. 같은 패 3장이어야 몸통이에요.'],
        ['12233455m', true, '맞아요! 123만 + 234만 + 55만으로 나눌 수 있어요. 섞여 보여도 나눠 보면 완성일 수 있어요.'],
      ] } },
    { part: 'base', title: '내 차례', body: () => `
      <p>평소에는 <b>7장</b>을 들고 있어요. 차례가 오면 1장을 가져와 8장이 되고, 필요 없는 <b>1장을 버려요</b>.</p>
      <div class="gex ganim" data-n="${st.replay}">${T('234m 567p 5s')}<span class="gsp"></span><span class="gdraw">${one('5s', 'last')}</span><span class="gdone">완성!</span></div>
      <button class="gmini" data-g="replay">다시 보기</button>
      <p>한 장만 더 있으면 완성되는 상태를 <b>텐파이</b>라고 해요. 위 손은 5삭을 가져와서 완성됐어요.</p>
      <p class="muted2">패를 한 번 누르면 올라오고, 한 번 더 누르면 버려요 (설정에서 한 번 누르기로 바꿀 수 있어요).</p>` },
    { part: 'base', title: '공개패', body: () => `
      <p>버림이 4번 나오면 한 순이 끝나고, 가운데에 <b>공개패</b>가 1장 열려요.</p>
      <div class="gex"><span>공개패 칸</span>${T('9m 5p 2s')}<span class="gslot"></span><span class="gslot"></span><span class="gslot"></span></div>
      <p>공개패는 <b>4명이 동시에</b> 쓸 수 있어요. 그 패로 완성되면 화료할 수 있고, 몸통이 되면 가져와서 울 수 있어요.</p>
      <p class="muted2">공개패가 6장째 열릴 때까지 아무도 못 끝내면 유국이에요. 공개패 장수가 지금 몇 순인지예요.</p>
      <p class="gnote">다른 마작에는 없는 규칙이에요.</p>` },
    { part: 'base', title: '이기는 방법 세 가지', body: () => `
      <div class="gwin"><b>쯔모</b><span>내가 가져온 패로 완성. 나머지 3명이 나눠서 점수를 내요.</span></div>
      <div class="gwin"><b>론</b><span>다른 사람이 버린 패로 완성. 버린 사람이 혼자 다 내요.</span></div>
      <div class="gwin"><b>지모시</b><span>공개패로 완성. 쯔모처럼 나머지가 나눠 내요.</span></div>
      <p>완성되면 빨간 버튼이 떠요. 누르면 끝!</p>` },
    { part: 'base', title: '역이 있어야 화료', body: () => `
      <p>모양만으로는 안 되고, <b>역</b>(점수가 붙는 조건)이 하나는 있어야 이길 수 있어요. 처음엔 이것만 알면 돼요.</p>
      <div class="gwin"><b>리치</b><span>울지 않고 텐파이가 되면 선언 (뒤에서 설명)</span></div>
      <div class="gwin"><b>멘젠쯔모</b><span>울지 않고 내가 가져온 패로 완성</span></div>
      <div class="gwin"><b>탕야오</b><span>8장 모두 2~8 숫자패 ${T('234m 66p')}</span></div>
      <div class="gwin"><b>역패</b><span>삼원패나 내 바람 3장 ${T('555z')}</span></div>
      <p class="muted2">6순째에는 도라가 1장만 있어도 화료할 수 있어요 (6순화료).</p>`,
      quiz: { q: '울지 않았고 리치도 안 했어요. 남이 버린 패로 이 모양이 완성되면 화료할 수 있을까요?', show: '234m 345p 66s', opts: [['네, 탕야오가 있어요', true, '맞아요! 전부 2~8 숫자패라 탕야오예요.'], ['아니요, 역이 없어요', false, '1·9와 글자패가 없으면 탕야오가 붙어요.']] } },
    { part: 'base', title: '울기 (치 · 퐁 · 깡)', body: () => `
      <p>다른 사람이 버린 패나 공개패를 가져와 몸통을 만드는 것을 <b>울기</b>라고 해요.</p>
      <div class="gwin"><b>치</b><span>이어진 숫자. <b>왼쪽 사람</b>이 버린 패만 가능</span></div>
      <div class="gwin"><b>퐁</b><span>같은 패 3장</span></div>
      <div class="gwin"><b>깡</b><span>같은 패 4장. 한 장을 더 가져와요</span></div>
      <p><b>버린 패로 울면</b> 리치를 못 하고 몇몇 역의 점수가 줄어요. <b>공개패로 울면</b> 그런 손해가 없어요!</p>` },
    { part: 'base', title: '리치', body: () => `
      <p>울지 않고 텐파이가 되면, 버릴 때 <b>리치</b>를 선언할 수 있어요.</p>
      <ul class="gul"><li>1,000점을 걸어요 (화료한 사람이 가져가요)</li><li>그 뒤로는 손을 바꿀 수 없어서, 가져온 패를 <b>자동으로 버려요</b></li><li>리치만으로 역이 되고, <b>리치도라</b> 보너스도 받아요</li></ul>
      <p class="muted2">리치 버튼을 켜고 버릴 패를 고르면 돼요.</p>` },
    { part: 'base', title: '도라', body: () => `
      <p>가운데 <b>도라 표시패</b>의 <b>다음 패</b>가 도라예요. 도라 1장마다 1판이 더해져요.</p>
      <div class="gex"><span>표시패가 이것이면</span>${one('3m')}<span class="garrow">→</span><span>도라는</span>${one('4m', 'dora')}</div>
      <div class="gex"><span>9 다음은 1로</span>${one('9p')}<span class="garrow">→</span>${one('1p', 'dora')}</div>
      <div class="gex"><span>바람은 동→남→서→북→동</span>${one('4z')}<span class="garrow">→</span>${one('1z', 'dora')}</div>
      <p class="muted2">리치도라 표시패는 리치한 사람에게만 적용돼요. 빨간 5도 도라예요. 도라는 반짝여서 바로 알 수 있어요.</p>`,
      quiz: { q: '도라 표시패가 이것이면 도라는?', show: '9m', opts: [['1만', true, '맞아요! 9 다음은 1로 돌아가요.'], ['8만', false, '표시패의 다음 숫자가 도라예요.'], ['9만', false, '표시패 자체가 아니라 다음 패가 도라예요.']] } },
    { part: 'base', title: '친과 점수', body: () => `
      <p>한 판마다 <b>친</b>이 한 명 있어요. 화면에서 <b>주홍색 원판</b>을 단 사람이에요.</p>
      <ul class="gul"><li>친이 이기면 점수를 <b>1.5배</b> 받아요</li><li>친이 이기거나, 아무도 못 이겼을 때 친이 텐파이면 친을 <b>한 번 더</b> 해요</li><li>아니면 친이 오른쪽 사람에게 넘어가요. 친이 한 바퀴 돌면 동장전이 끝나요 (반장전은 두 바퀴)</li></ul>
      <p>모두 <b>25,000점</b>으로 시작해서, 끝났을 때 점수가 가장 많은 사람이 1등이에요. 누가 0점 밑으로 내려가면 바로 끝나요.</p>` },
    { part: 'base', title: '화면 보는 법 ① 전체', body: () => `
      ${tour('opp', 'all', [])}
      <p>화면은 세 부분이에요.</p>
      <div class="gnum"><i>1</i><span>위: <b>다른 세 사람</b>의 자리</span></div>
      <div class="gnum"><i>2</i><span>가운데: 몇 순째인지, <b>도라</b>, <b>공개패</b></span></div>
      <div class="gnum"><i>3</i><span>아래: <b>내가 버린 패</b>와 <b>내 손패</b></span></div>` },
    { part: 'base', title: '화면 보는 법 ② 다른 사람', body: () => `
      ${tour('opp', 'opps', ['.opps'])}
      <ul class="gul">
        <li>동그란 판에 <b>바람</b>과 <b>점수</b>. 주홍색 판이 <b>친</b>이에요 (이기면 1.5배)</li>
        <li>초록 뒷면 = 그 사람이 들고 있는 패. 차례가 오면 가져온 패가 떨어져 놓여요</li>
        <li><b>강</b>: 그 사람이 버린 패. <b>울기</b>: 가져와서 만든 몸통</li>
        <li><b>금색으로 빛나는 자리</b>가 지금 차례인 사람</li>
        <li>막대 = <b>리치</b>한 사람. 강에 누운 패가 리치를 선언한 패예요</li></ul>` },
    { part: 'base', title: '화면 보는 법 ③ 가운데', body: () => `
      ${tour('opp', 'mid', ['.mid'])}
      <ul class="gul">
        <li>동전: 지금 <b>몇 순째</b>인지 (6순까지)</li>
        <li><b>도라 표시패</b>: 이 패의 <b>다음 패</b>가 보너스(도라)예요</li>
        <li><b>리치도라 표시패</b>: 리치한 사람만 받는 보너스. 뒷면은 깡이 나오면 열려요</li>
        <li><b>공개패</b> 칸: 한 순이 끝날 때마다 1장씩 열려요. 공개패를 쓸 때는 이 판이 금색으로 빛나요</li></ul>` },
    { part: 'base', title: '화면 보는 법 ④ 내 자리', body: () => `
      ${tour('me', 'me', ['.me', '.hand'])}
      <ul class="gul">
        <li><b>내 강</b>: 내가 버린 패</li>
        <li>맨 아래 받침대가 <b>내 손패</b>. 떨어져 있는 오른쪽 패가 방금 가져온 패예요</li>
        <li>울어서 만든 몸통은 손패 오른쪽 끝에 놓여요</li>
        <li>내 차례면 받침대 윗선이 <b>금색</b>으로 빛나요</li></ul>` },
    { part: 'base', title: '화면 보는 법 ⑤ 버튼과 표시', body: () => `
      ${tour('resp', 'btn', ['.actions'])}
      <div class="gkey"><span class="gbtn win">론!</span><span>빨강 = 화료할 수 있어요</span></div>
      <div class="gkey"><span class="gbtn">퐁</span><span class="gbtn">치</span><span>초록 = 울기 (가져와서 몸통 만들기)</span></div>
      <div class="gkey"><span class="gbtn riichi">리치</span><span>보라 = 리치 선언</span></div>
      <div class="gkey"><span class="gbtn pass">패스</span><span>안 할래요</span></div>
      <div class="gkey">${one('2m', 'dora')}<span>보랏빛으로 반짝이는 패 = 도라 (보너스)</span></div>
      <div class="gkey">${one('3p', 'lying')}<span>누운 패 = 남의 버림패로 가져온 패, 또는 리치를 선언한 패</span></div>
      <div class="gkey">${one('7s', 'ghost')}<span>흐린 패 = 공개패로 가져온 패</span></div>` },
    { part: 'more', title: '조심할 것', body: () => `
      <p><b>후리텐</b>: 내가 이미 버린 패로 완성되는 상태라면, 남이 버린 그 패로는 <b>론할 수 없어요</b>. 쯔모와 공개패 화료(지모시)는 괜찮아요.</p>
      <p><b>유국</b>: 6순이 지나도 아무도 못 이기면, 텐파이인 사람이 노텐인 사람에게서 합계 3,000점을 받아요.</p>
      <p class="muted2">마지막 공개패 페이즈에는 울어서 텐파이를 만드는 것도 방법이에요.</p>` },
    { part: 'more', title: '점수와 다음 단계', body: () => `
      <p>점수 = <b>판수 × 1,000</b> + 동전역(모양에 따른 작은 점수). 합이 5,000을 넘으면 판수 점수가 2배, 친은 1.5배예요.</p>
      <p>자세한 역과 점수는 <b>규칙</b> 화면에 있어요. 이제 봇과 한 판 해 볼까요?</p>` },
  ];


  // ---------- 화면 보는 법: 실제 대국 화면을 가짜 상황으로 그려서 보여 준다 ----------
  function demoState(mode) {
    const K = (str, c = 1) => ids(str).map((id) => (id & ~3) + c);
    const rv = (str, o = {}) => K(str).map((t) => ({ tile: t, noCall: false, riichi: false, called: false, ...o }));
    const pl = (seat, name, wind, o) => Object.assign({ seat, name, human: seat === 0, melds: [], river: [], riichi: false, double: false, handCount: 7, seatWind: wind, auto: false }, o);
    const pub = [K('3p', 2)[0], K('8s', 2)[0]];
    const dis5s = K('5s', 2)[0];
    const myHand = mode === 'me' ? [...K('234m 678p 5s'), K('7z')[0]] : K('234m 678p 5s 5s', 1).map((t, i) => (i === 7 ? t + 2 : t)).slice(0, 7);
    const players = [
      pl(0, '나', 3, { river: rv('1z 9s 4p'), handCount: myHand.length }),
      pl(1, '봇 나래', 0, { river: rv('1z 9m 2s'), handCount: 4, melds: [{ typ: 'S', t: K('3p')[0] >> 2, tiles: [K('4p', 3)[0], K('5p', 3)[0], pub[0]], src: 'public', from: -1, pub: 0 }] }),
      pl(2, '봇 다솜', 1, { river: [...rv('7z 1p'), { tile: K('6m', 3)[0], noCall: false, riichi: true, called: false }, ...rv('3s')], riichi: true, handCount: mode === 'opp' ? 8 : 7 }),
      pl(3, '봇 라온', 2, { river: [...rv('9p 4z 8m'), ...(mode === 'resp' ? [{ tile: dis5s, noCall: false, riichi: false, called: false }] : [])], handCount: 4, melds: [{ typ: 'T', t: 33, tiles: [K('7z', 0)[0], K('7z', 2)[0], K('7z', 3)[0]], src: 'discard', from: 2 }] }),
    ];
    const h = {
      dealer: 1, roundWind: 0, rnd: 3, discards: 1, wallLeft: 84, honba: 0, sticks: 1, scores: [25000, 26000, 24000, 25000],
      frontInd: K('1m', 3), riichiInd: K('7s', 3), frontHidden: 2, riichiHidden: 2, pub, usedPub: [],
      phase: mode === 'resp' ? 'discard-resp' : 'turn', turnSeat: mode === 'opp' ? 2 : mode === 'me' ? 0 : -1, afterCall: false, forbid: [],
      lastDiscard: mode === 'resp' ? { from: 3, tile: dis5s } : null, pubIdx: -1, lastPub: false,
      waiting: mode === 'opp' ? [2] : [0], deadline: 0, hand: myHand, lastDraw: mode === 'me' ? myHand[myHand.length - 1] : -1,
      glowSeat: mode === 'opp' ? 2 : mode === 'me' ? 0 : 3, pubPhase: false, players,
      legal: mode === 'me' ? myHand.map((t) => ({ t: 'discard', tile: t })) : mode === 'resp' ? [{ t: 'ron' }, { t: 'pon', tiles: [myHand[6], myHand[5]] }, { t: 'pass' }] : [],
    };
    return { room: { phase: 'playing', host: 0, seats: [] }, you: 0, match: { title: '동1국', dealer: 1, handCount: 1 }, events: mode === 'resp' ? [{ id: 1, t: 'discard', seat: 3, tile: dis5s }] : [], hand: h, serverTime: Date.now() };
  }
  function demoFull(mode) {
    const real = S;
    S = demoState(mode);
    let html;
    try { html = gameHTML(); } finally { S = real; }
    // 누르면 실제 행동이 나가지 않게 버튼·패의 식별자를 지운다
    return html.replace(/ id="/g, ' data-x="').replace(/ data-(i|hand)="/g, ' data-d$1="');
  }
  function tour(mode, zone, sels) {
    const full = demoFull(mode);
    let region = '';
    if (sels.length) {
      const t = document.createElement('template');
      t.innerHTML = full;
      region = sels.map((sel) => { const el = t.content.querySelector(sel); return el ? el.outerHTML : ''; }).join('');
    }
    return `<div class="tour ${zone === 'all' ? 'tall' : ''}"><div class="tmap"><div class="tmap-in focus-${zone}">${full}</div></div>${region ? `<div class="tregion"><div class="tregion-in">${region}</div></div>` : ''}</div>`;
  }

  function seg(key, opts) {
    return `<span class="seg">${opts.map(([v, t]) => `<button data-g="set" data-k="${key}" data-v="${v}" class="${String(Settings[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</span>`;
  }

  const st = { part: 'base', idx: 0, answered: {}, replay: 0 };

  function manualHTML() {
    const cards = CARDS.filter((c) => (st.part === 'base' ? c.part === 'base' : c.part === 'more'));
    const c = cards[st.idx];
    const last = st.idx === cards.length - 1;
    let quiz = '';
    if (c.quiz) {
      const a = st.answered[c.title];
      quiz = `<div class="gquiz"><div class="gq">✏️ ${c.quiz.q}</div>${c.quiz.show ? `<div class="gqshow">${T(c.quiz.show)}</div>` : ''}
        <div class="gopts">${c.quiz.opts.map(([label, ok, why], i) => {
          const picked = a === i;
          const cls = a === undefined ? '' : ok ? 'right' : picked ? 'wrong' : 'dim';
          const shown = /[mpsz]$/.test(label.split(' ')[0]) && !/[가-힣]/.test(label) ? T(label) : label;
          return `<button data-g="quiz" data-i="${i}" class="gopt ${cls}">${shown}</button>`;
        }).join('')}</div>
        ${a !== undefined ? `<div class="gwhy ${c.quiz.opts[a][1] ? 'ok' : 'no'}">${c.quiz.opts[a][2]}</div>` : ''}</div>`;
    }
    if (c.ox) {
      quiz = `<div class="gquiz"><div class="gq">✏️ ${c.ox.q}</div>${c.ox.items.map(([spec, ok, why], i) => {
        const a = st.answered[`${c.title}#${i}`];
        const res = a === undefined ? '' : a === ok ? 'right' : 'wrong';
        return `<div class="goxrow ${res}"><div class="gqshow">${T(spec)}</div><div class="gox">
          <button data-g="ox" data-i="${i}" data-v="1" class="${a === true ? 'picked' : ''}">완성</button><button data-g="ox" data-i="${i}" data-v="0" class="${a === false ? 'picked' : ''}">아니에요</button></div>
          ${a !== undefined ? `<div class="gwhy ${a === ok ? 'ok' : 'no'}">${a === ok ? '⭕ ' : '❌ '}${a === ok ? why : (ok ? '완성이에요. ' : '') + why.replace(/^맞아요! /, '')}</div>` : ''}</div>`;
      }).join('')}</div>`;
    }
    const dots = cards.map((_, i) => `<i class="${i === st.idx ? 'on' : ''}"></i>`).join('');
    let foot;
    if (!last) foot = `<button class="btn ghost" data-g="prev" ${st.idx === 0 ? 'disabled' : ''}>이전</button><button class="btn primary" data-g="next">다음</button>`;
    else if (st.part === 'base') foot = `<button class="btn ghost" data-g="more">더 알아보기</button><button class="btn primary" data-g="play">봇과 한 판</button>`;
    else foot = `<button class="btn ghost" data-g="rules">규칙 보기</button><button class="btn primary" data-g="play">봇과 한 판</button>`;
    return `<div class="sheet gsheet">
      <div class="ghead"><span class="gpart">${st.part === 'base' ? '처음 해요' : '더 알아보기'} · ${st.idx + 1}/${cards.length}</span><button class="icon light" data-g="close">닫기</button></div>
      <h2>${c.title}</h2><div class="gbody">${c.body()}</div>${quiz}
      <div class="gdots">${dots}</div><div class="row gfoot">${foot}</div></div>`;
  }

  // ---------- 설정 ----------
  function settingsHTML() {
    const row = (title, key, opts, desc = '') => `<div class="srow"><div><b>${title}</b>${desc ? `<div class="muted2">${desc}</div>` : ''}</div>${seg(key, opts)}</div>`;
    const yn = [[true, '켬'], [false, '끔']];
    return `<div class="sheet gsheet"><div class="ghead"><h2 style="margin:0">설정</h2><button class="icon light" data-g="close">닫기</button></div>
      ${row('패에 글자 표시', 'labels', [['off', '끔'], ['hand', '손패만'], ['all', '모든 패']], '오른쪽 위에 1~9, 동남서북, 백발중')}
      ${row('글자 언어', 'lang', [['ko', '한국어'], ['en', 'English']], '영어: 1~9, E S W N, Wh G R')}
      ${row('버리기', 'tapMode', [['double', '두 번 누르기'], ['single', '한 번 누르기']])}
      ${row('처음 상황 설명', 'hints', yn, '처음 겪는 상황에 한 번씩 설명을 띄워요')}
      ${row('패 소리', 'tileSound', yn)}
      ${row('음성 (치·퐁·리치…)', 'voice', yn)}
      ${row('내 차례 진동', 'vibrate', yn)}
      ${row('움직임 줄이기', 'calm', [[true, '켬'], [false, '끔']], '날아가는 패, 반짝임을 멈춰요')}
      <button class="btn ghost" data-g="resethints">설명 다시 보기 (처음 상황 설명 초기화)</button></div>`;
  }

  // ---------- 대국 중 도움말 ----------
  function helpHTML() {
    const h = S && S.hand;
    const tip = !h ? '' : h.phase === 'pub-resp' ? (h.lastPub ? HINTS.last.text : HINTS.pub.text)
      : h.phase === 'discard-resp' ? '방금 버려진 패로 론하거나 울 수 있는 사람이 정하는 중이에요.'
      : h.phase === 'pub-post' ? '공개패로 운 사람이 버릴 패를 고르는 중이에요. 다 고르면 함께 공개돼요.' : '차례인 사람이 패를 가져와 버리는 중이에요.';
    return `<div class="sheet gsheet"><div class="ghead"><h2 style="margin:0">도움말</h2><button class="icon light" data-g="close">닫기</button></div>
      ${tip ? `<div class="gtip"><b>지금</b> ${tip}</div>` : ''}
      <button class="btn primary" data-g="manual">처음 해요 (입문 설명)</button>
      <button class="btn ghost" data-g="rules">규칙 (역 · 점수 · 진행)</button>
      <button class="btn ghost" data-g="settings">설정</button></div>`;
  }

  // ---------- 처음 겪는 상황 힌트 ----------
  const HINTS = {
    turn: { text: '<b>내 차례</b>예요. 버릴 패를 한 번 누르면 올라오고, 한 번 더 누르면 버려요.' },
    pub: { text: '<b>공개패 페이즈</b>예요. 방금 열린 공개패로 4명이 동시에 론이나 울기를 정해요. 공개패로 울어도 멘젠이 유지돼요.' },
    last: { text: '<b>마지막 공개패</b>예요. 아직 안 쓴 공개패 중 하나로 론하거나 울 수 있어요. 울어서 텐파이를 만들면 유국 때 점수를 받아요.' },
    call: { text: '<b>울 수 있어요.</b> 버린 패로 울면 리치를 못 하고 몇몇 역 점수가 줄어요. 필요 없으면 패스를 누르세요.' },
    riichi: { text: '<b>리치할 수 있어요.</b> 리치 버튼을 켜고 버릴 패를 고르세요. 1,000점을 걸고, 그 뒤로는 자동으로 버려요.' },
    win: { text: '<b>화료할 수 있어요!</b> 빨간 버튼을 누르세요.' },
  };
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem('jimothy-hints') || '{}'); } catch { seen = {}; }
  let showing = null;
  function pickHint(s) {
    const h = s.hand;
    if (!h || s.room.phase !== 'playing' || !h.waiting.includes(s.you) || !h.legal.length) return null;
    const L = h.legal;
    if (L.some((a) => a.t === 'tsumo' || a.t === 'ron')) return 'win';
    if (h.phase === 'pub-resp') return h.lastPub ? 'last' : 'pub';
    if (L.some((a) => a.t === 'discard' && a.riichi)) return 'riichi';
    if (h.phase === 'discard-resp' && L.some((a) => a.t === 'pon' || a.t === 'chi' || a.t === 'kan')) return 'call';
    if (h.phase === 'turn' && !h.afterCall) return 'turn';
    return null;
  }
  function hints(s) {
    let el = document.getElementById('hint');
    const key = Settings.hints ? pickHint(s) : null;
    if (showing && key !== showing) { showing = null; if (el) el.remove(); el = null; }
    if (!key || seen[key] || showing === key) return;
    showing = key;
    el = document.createElement('div');
    el.id = 'hint';
    el.className = 'hint';
    el.innerHTML = `<div>${HINTS[key].text}</div><div class="hrow"><button data-g="hintok">알겠어요</button><button data-g="hintoff">설명 끄기</button></div>`;
    document.body.appendChild(el);
  }
  function closeHint(off) {
    if (showing) seen[showing] = true;
    try { localStorage.setItem('jimothy-hints', JSON.stringify(seen)); } catch { /* 무시 */ }
    if (off) { Settings.hints = false; saveSettings(); }
    showing = null;
    const el = document.getElementById('hint');
    if (el) el.remove();
  }

  // 봇 셋과 동장전 바로 시작
  async function quickPlay() {
    try {
      const name = localStorage.getItem('jimothy-name') || '나';
      const j = await api('create', { name });
      saveSession({ code: j.code, token: j.token });
      connect();
      await api('start', { botLevel: 1, turnSec: 40, hands: 4 });
    } catch (e) { toast(e.message); }
  }

  // 누른 버튼 처리. 처리했으면 true
  function onClick(el) {
    const g = el.dataset.g;
    const cards = CARDS.filter((c) => (st.part === 'base' ? c.part === 'base' : c.part === 'more'));
    if (g === 'close') { ui.manual = 0; ui.settings = 0; ui.help = 0; ui.rules = 0; renderModals(); render(); return true; }
    if (g === 'next') { st.idx = Math.min(cards.length - 1, st.idx + 1); renderModals(); return true; }
    if (g === 'prev') { st.idx = Math.max(0, st.idx - 1); renderModals(); return true; }
    if (g === 'more') { st.part = 'more'; st.idx = 0; renderModals(); return true; }
    if (g === 'ox') { st.answered[`${cards[st.idx].title}#${el.dataset.i}`] = el.dataset.v === '1'; renderModals(); return true; }
    if (g === 'replay') { st.replay++; renderModals(); return true; }
    if (g === 'quiz') { st.answered[cards[st.idx].title] = Number(el.dataset.i); renderModals(); return true; }
    if (g === 'set') {
      let v = el.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false;
      Settings[el.dataset.k] = v;
      saveSettings();
      lastHTML = '';
      renderModals(); render();
      return true;
    }
    if (g === 'resethints') { seen = {}; try { localStorage.removeItem('jimothy-hints'); } catch { /* 무시 */ } Settings.hints = true; saveSettings(); toast('처음 상황 설명을 다시 보여 드릴게요'); renderModals(); return true; }
    if (g === 'manual') { ui.help = 0; openManual(); return true; }
    if (g === 'settings') { ui.help = 0; ui.manual = 0; ui.settings = 1; renderModals(); return true; }
    if (g === 'rules') { ui.help = 0; ui.manual = 0; ui.rules = 1; renderModals(); return true; }
    if (g === 'play') { ui.manual = 0; renderModals(); if (!session) quickPlay(); else toast('이미 방에 들어와 있어요'); return true; }
    if (g === 'hintok') { closeHint(false); return true; }
    if (g === 'hintoff') { closeHint(true); return true; }
    return false;
  }

  function openManual() { st.part = 'base'; st.idx = 0; ui.manual = 1; renderModals(); }

  return { manualHTML, settingsHTML, helpHTML, hints, onClick, openManual, ids };
})();
