// 패 그리기: FastMahjongTrainer v1/v4와 같은 libreriichi 패면 SVG (CC0, public/tiles/libre)
// kind 0-8 만, 9-17 통, 18-26 삭, 27-30 동남서북, 31-33 백발중. 파일명: m/p/s + 1~9 (0 = 적5), z1~z7
const Tiles = (() => {
  const isRed = (id) => (id & 3) === 0 && [4, 13, 22].includes(id >> 2);
  const name = (kind, red) => (kind >= 27 ? 'z' + (kind - 26) : 'mps'[Math.floor(kind / 9)] + (red ? 0 : (kind % 9) + 1));

  // 오른쪽 위 글자: 수패는 1~9, 자패는 동남서북·백발중 (영어: E S W N, Wh G R)
  const HON_KO = ['동', '남', '서', '북', '백', '발', '중'], HON_EN = ['E', 'S', 'W', 'N', 'Wh', 'G', 'R'];
  const label = (k) => (k < 27 ? String((k % 9) + 1) : (typeof Settings !== 'undefined' && Settings.lang === 'en' ? HON_EN : HON_KO)[k - 27]);

  // 패 하나의 HTML. id가 -1이면 뒷면
  function html(id, cls = '', attrs = '') {
    if (id < 0) return `<div class="tile back ${cls}" ${attrs}></div>`;
    const kind = id >> 2;
    const lab = / lbl\b|^lbl\b/.test(cls) ? `<span class="tl${isRed(id) ? ' r' : ''}">${label(kind)}</span>` : '';
    return `<div class="tile ${cls}" data-id="${id}" ${attrs}><img src="tiles/libre/${name(kind, isRed(id))}.svg" alt="" draggable="false">${lab}</div>`;
  }
  // 시작할 때 모든 패 이미지를 미리 받아 둔다
  function preload() {
    for (let k = 0; k < 34; k++) for (const red of (k === 4 || k === 13 || k === 22) ? [false, true] : [false]) new Image().src = `tiles/libre/${name(k, red)}.svg`;
  }
  const kindName = (k) => (k < 27 ? `${(k % 9) + 1}${['만', '통', '삭'][Math.floor(k / 9)]}` : ['동', '남', '서', '북', '백', '발', '중'][k - 27]);
  return { html, isRed, kindName, preload };
})();
Tiles.preload();
