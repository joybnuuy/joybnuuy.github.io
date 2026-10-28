import { TERMS } from './tiles.js';

// 수패 한 종류(또는 자패)에서 (몸통, 탑자, 머리) 조합의 비지배 집합
                                    
const cache = new Map               ();

function suitOpts(key          , honor         )        {
  const ck = key.join('') + (honor ? 'h' : 's');
  const hit = cache.get(ck);
  if (hit) return hit;
  const c = key.slice();
  const n = c.length;
  const res = new Set        ();
  const rec = (i        , m        , t        , p        )       => {
    while (i < n && c[i] === 0) i++;
    if (i >= n) {
      res.add(`${Math.min(m, 2)},${Math.min(t, 2)},${Math.min(p, 1)}`);
      return;
    }
    if (c[i] >= 3) { c[i] -= 3; rec(i, m + 1, t, p); c[i] += 3; }
    if (!honor && i <= 6 && c[i + 1] && c[i + 2]) {
      c[i]--; c[i + 1]--; c[i + 2]--;
      rec(i, m + 1, t, p);
      c[i]++; c[i + 1]++; c[i + 2]++;
    }
    if (c[i] >= 2) { c[i] -= 2; rec(i, m, t, p + 1); rec(i, m, t + 1, p); c[i] += 2; }
    if (!honor) {
      if (i <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; rec(i, m, t + 1, p); c[i]++; c[i + 1]++; }
      if (i <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; rec(i, m, t + 1, p); c[i]++; c[i + 2]++; }
    }
    c[i]--; rec(i, m, t, p); c[i]++;
  };
  rec(0, 0, 0, 0);
  const all        = [...res].map((s) => s.split(',').map(Number)       );
  const out = all.filter((a) => !all.some((b) => b !== a && b[0] >= a[0] && b[1] >= a[1] && b[2] >= a[2] && (b[0] > a[0] || b[1] > a[1] || b[2] > a[2])));
  cache.set(ck, out);
  return out;
}

function shRegular(c          , needM        )         {
  const o = [
    suitOpts(c.slice(0, 9), false),
    suitOpts(c.slice(9, 18), false),
    suitOpts(c.slice(18, 27), false),
    suitOpts(c.slice(27, 34), true),
  ];
  let best = -1;
  for (const a of o[0]) for (const b of o[1]) for (const d of o[2]) {
    const m1 = a[0] + b[0] + d[0];
    const t1 = a[1] + b[1] + d[1];
    const p1 = a[2] + b[2] + d[2];
    for (const e of o[3]) {
      const m = Math.min(m1 + e[0], needM);
      const t = Math.min(t1 + e[1], needM - m);
      const p = Math.min(1, p1 + e[2]);
      const s = 2 * m + t + p;
      if (s > best) best = s;
    }
  }
  return 2 * needM - best;
}

export function shPairs(c          )         {
  let k = 0, kinds = 0;
  for (const x of c) { if (x >= 2) k++; if (x >= 1) kinds++; }
  return 3 - Math.min(4, k) + Math.max(0, 4 - kinds);
}

export function shJayo(c          )         {
  let honors = 0;
  for (let t = 27; t < 34; t++) if (c[t]) honors++;
  return 7 - honors - (TERMS.some((t) => c[t]) ? 1 : 0);
}

// c: 손에 든 패의 kind별 장수, nm: 울어서 만든 몸통 수. -1이면 화료형, 0이면 텐파이
export function shanten(c          , nm        )         {
  let s = shRegular(c, 2 - nm);
  if (nm === 0) s = Math.min(s, shPairs(c), shJayo(c));
  return s;
}

export function isComplete(c          , nm        )          {
  return shanten(c, nm) === -1;
}

// 텐파이 손(7장 상당)의 대기패 kind 목록
export function waitsOf(c          , nm        )           {
  const out           = [];
  for (let k = 0; k < 34; k++) {
    if (c[k] >= 4) continue;
    c[k]++;
    if (isComplete(c, nm)) out.push(k);
    c[k]--;
  }
  return out;
}
