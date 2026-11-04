/**
 * 19장: NTRU 고유의 공격 (교육용).
 * - fatigue point (Ducas–van Woerden 2021, 삼진 NTRU): q* ≈ 0.004 · n^{2.484}
 * - NTRU 격자에서의 uSVP 예측 (18장 모델을 d = 2n, vol = qⁿ 에 적용)
 * - 2의 거듭제곱 원분체의 노름 사상 N_{K/L}: f(x)·f(−x) = F(x²) 를 r 배 지수까지 반복 (부분체 공격)
 */
import { deltaBeta } from './bkz';
import { type Rng } from './lwe';

export const log2Fatigue = (n: number) => Math.log2(0.004) + 2.484 * Math.log2(n);

/** NTRU 격자 (차원 2n, 부피 qⁿ) 에서 (f, g) (계수 표준편차 σ) 를 uSVP 로 찾는 최소 β (β ≥ 50) */
export function usvpBetaNTRU(n: number, logq: number, sigma: number): number | null {
  const d = 2 * n;
  for (let b = 50; b < d; b++) if (Math.log2(sigma * Math.sqrt(b)) <= (2 * b - d) * Math.log2(deltaBeta(b)) + logq / 2) return b;
  return null;
}

/** 실제 스킴의 (n, q) 와 비밀 분포의 대략적 표준편차 */
export const NTRU_SCHEMES = [
  { name: 'NTRU-HPS-2048-509', n: 509, q: 2048, note: 'NIST 3라운드' },
  { name: 'NTRU-HPS-2048-677', n: 677, q: 2048, note: 'NIST 3라운드' },
  { name: 'NTRU-HRSS-701', n: 701, q: 8192, note: 'NIST 3라운드' },
  { name: 'NTRU-HPS-4096-821', n: 821, q: 4096, note: 'NIST 3라운드' },
  { name: 'NTRU+768', n: 768, q: 3457, note: 'KpqC' },
  { name: 'NTRU+1152', n: 1152, q: 3457, note: 'KpqC' },
  { name: 'Falcon-512', n: 512, q: 12289, note: '비밀이 삼진이 아님' },
  { name: 'Falcon-1024', n: 1024, q: 12289, note: '비밀이 삼진이 아님' },
];

/* ------------------------------------------------------------------ 노름 사상 */

/** f·g mod (xⁿ + 1), 정수 계수 */
function negamul(f: number[], g: number[]): number[] {
  const n = f.length, h = new Array(n).fill(0);
  for (let i = 0; i < n; i++) if (f[i]) for (let j = 0; j < n; j++) {
    const k = i + j;
    if (k < n) h[k] += f[i] * g[j]; else h[k - n] -= f[i] * g[j];
  }
  return h;
}

/**
 * K = ℚ[x]/(xⁿ+1) → 지수 2 부분체 ℚ[y]/(y^{n/2}+1), y = x²:  N(f) = f(x)·f(−x) 의 짝수 차 계수.
 * (f(x)f(−x) 는 x 의 짝수 거듭제곱만 가지므로 y 의 다항식이 된다.)
 */
export function normDown2(f: number[]): number[] {
  const fm = f.map((c, i) => (i % 2 ? -c : c));
  const p = negamul(f, fm);
  return p.filter((_, i) => i % 2 === 0);
}

/** 지수 r (2 의 거듭제곱) 부분체로의 노름: normDown2 를 log₂ r 번 */
export function normDown(f: number[], r: number): number[] {
  let g = f;
  for (let s = r; s > 1; s >>= 1) g = normDown2(g);
  return g;
}

export const l2 = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
export const ternaryPoly = (n: number, rng: Rng) => Array.from({ length: n }, () => Math.floor(rng() * 3) - 1);

/**
 * 부분체 격자에서의 gap = GH / ‖(N f, N g)‖.  부분체 NTRU 격자는 차원 2n/r, 부피 q^{n/r} 이라
 * GH ≈ √(2n/r / 2πe) · √q.  r = 1 이면 원래 NTRU 격자.
 */
export function subfieldGap(f: number[], g: number[], r: number, logq: number) {
  const nf = normDown(f, r), ng = normDown(g, r);
  const d = (2 * f.length) / r;
  const keyNorm = Math.sqrt(l2(nf) ** 2 + l2(ng) ** 2);
  const log2GH = 0.5 * Math.log2(d / (2 * Math.PI * Math.E)) + logq / 2;
  return { r, d, log2Key: Math.log2(keyNorm), log2GH, log2Gap: log2GH - Math.log2(keyNorm) };
}

/**
 * 축소 강도 δ 로 그 격자에서 숨은 벡터를 찾을 여유 (log₂): gap − δ^d.
 * (14·15장의 경험칙 'gap 이 δ^d 보다 크면 찾는다'.) 부분체는 gap 이 작아지는 대신 d 가 1/r 로 줄어든다.
 */
export function subfieldMargin(f: number[], g: number[], r: number, logq: number, delta = 1.0219) {
  const s = subfieldGap(f, g, r, logq);
  return { ...s, margin: s.log2Gap - s.d * Math.log2(delta) };
}
