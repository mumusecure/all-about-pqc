/**
 * 12장: Ring-LWE / Module-LWE 토이 (교육용).
 * 환 ℤ_q[x]/(xⁿ − 1) (‘cyclic’) 또는 ℤ_q[x]/(xⁿ + 1) (‘nega’).
 */
import { mod, modPow } from './algebra';
import { type Rng, centerMod, roundedGaussian, uniformMod } from './lwe';

export type RingKind = 'nega' | 'cyclic';

/** f·g mod (xⁿ ∓ 1, q) */
export function ringMul(f: number[], g: number[], q: number, kind: RingKind): number[] {
  const n = f.length, h = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = i + j;
    if (k < n) h[k] += f[i] * g[j];
    else h[k - n] += kind === 'nega' ? -f[i] * g[j] : f[i] * g[j];
  }
  return h.map((x) => mod(x, q));
}

/** a 를 곱하는 사상의 행렬 M_a (열 j = xʲ·a): M_a·s = a·s 의 계수 */
export function mulMatrix(a: number[], q: number, kind: RingKind): number[][] {
  const n = a.length;
  const cols = Array.from({ length: n }, (_, j) => ringMul(a, Array.from({ length: n }, (_, t) => (t === j ? 1 : 0)), q, kind));
  return Array.from({ length: n }, (_, i) => cols.map((c) => c[i]));
}

export interface RLWESample { a: number[]; b: number[]; }

export function sampleRLWE(n: number, q: number, sigma: number, m: number, kind: RingKind, rng: Rng) {
  const s = Array.from({ length: n }, () => roundedGaussian(rng, sigma));
  const samples: RLWESample[] = Array.from({ length: m }, () => {
    const a = Array.from({ length: n }, () => uniformMod(rng, q));
    const e = Array.from({ length: n }, () => roundedGaussian(rng, sigma));
    const as = ringMul(a, s.map((x) => mod(x, q)), q, kind);
    return { a, b: as.map((x, i) => mod(x + e[i], q)) };
  });
  return { s, samples };
}

/** f(r) mod q (Horner) */
export function evalAt(f: number[], r: number, q: number): number {
  let acc = 0;
  for (let i = f.length - 1; i >= 0; i--) acc = mod(acc * r + f[i], q);
  return acc;
}

/** 변환 다항식(xⁿ∓1)의 ℤ_q 근 하나 (cyclic 이면 1, nega 이면 원시 2n 제곱근 하나) */
export function someRoot(n: number, q: number, kind: RingKind): number | null {
  if (kind === 'cyclic') return 1;
  for (let x = 2; x < q; x++) if (modPow(x, n, q) === q - 1) return x;
  return null;
}

/**
 * 근에서의 값 공격: b(r) − a(r)·g 가 ‘작은’ 표본의 비율을 후보 g ∈ ℤ_q 마다 센다.
 * e(r) 이 작으면(cyclic 의 r = 1: e(1) = Σeᵢ) 정답 g = s(r) 에서만 점수가 높다.
 */
export function rootAttackScores(samples: RLWESample[], r: number, q: number, threshold: number): number[] {
  const ar = samples.map((x) => evalAt(x.a, r, q)), br = samples.map((x) => evalAt(x.b, r, q));
  return Array.from({ length: q }, (_, g) => samples.filter((_, i) => Math.abs(centerMod(br[i] - ar[i] * g, q)) <= threshold).length / samples.length);
}
