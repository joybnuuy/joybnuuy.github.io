// 패 표현: id 0..135, kind = id >> 2.
// kind: 0-8 만, 9-17 통, 18-26 삭, 27-30 동남서북, 31-33 백발중
export const KINDS = 34;
export const kindOf = (id        )         => id >> 2;
// 적도라: 5만·5통·5삭의 0번 사본
export const isRed = (id        )          => (id & 3) === 0 && (kindOf(id) === 4 || kindOf(id) === 13 || kindOf(id) === 22);
export const isHonor = (k        )          => k >= 27;
export const isTerm = (k        )          => k < 27 && (k % 9 === 0 || k % 9 === 8);
export const isYao = (k        )          => k >= 27 || isTerm(k);
export const GREEN = new Set([19, 20, 21, 23, 25, 32]);
export const DRAGONS = [31, 32, 33];
export const TERMS = [0, 8, 9, 17, 18, 26];

// 도라 표시패 -> 도라
export function doraOf(ind        )         {
  if (ind < 27) return Math.floor(ind / 9) * 9 + ((ind % 9) + 1) % 9;
  if (ind < 31) return 27 + ((ind - 27 + 1) % 4);
  return 31 + ((ind - 31 + 1) % 3);
}

export function counts(ids          )           {
  const c = new Array        (KINDS).fill(0);
  for (const id of ids) c[id >> 2]++;
  return c;
}

const SUIT = ['m', 'p', 's'];
const HON = ['동', '남', '서', '북', '백', '발', '중'];
// 1m, 5p, 동 같은 짧은 표기
export function kindName(k        )         {
  return k < 27 ? `${(k % 9) + 1}${SUIT[Math.floor(k / 9)]}` : HON[k - 27];
}
export function tileName(id        )         {
  return (isRed(id) ? '적' : '') + kindName(kindOf(id));
}

// 시드 가능한 난수 (mulberry32)
export function makeRng(seed        )               {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffledWall(rng              )           {
  const w = Array.from({ length: 136 }, (_, i) => i);
  for (let i = w.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [w[i], w[j]] = [w[j], w[i]];
  }
  return w;
}
