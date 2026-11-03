/**
 * 17장: ML-DSA (FIPS 204) 의 산술과 서명 루프 (교육용).
 *
 * - 환 R_q = ℤ_8380417[X]/(X²⁵⁶ + 1), 완전 NTT (ζ = 1753, 원시 512 제곱근)
 * - Power2Round, Decompose / HighBits / LowBits, MakeHint / UseHint — FIPS 204 와 같은 정의
 * - 서명 루프의 네 가지 거절 검사와 검증
 * - ⚠️ 해시(SHAKE)는 32비트 토이 해시와 mulberry32 로 대신한다. 구조와 거절 통계를 보기 위한 것.
 */
import { modPow } from './algebra';
import { type Rng, mulberry32 } from './lwe';

export const Q = 8380417;
export const N = 256;
export const D = 13;

export interface MLDSAParams { k: number; l: number; eta: number; tau: number; gamma1: number; gamma2: number; omega: number; lambda: number; }
export const PARAMS: Record<'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87', MLDSAParams> = {
  'ML-DSA-44': { k: 4, l: 4, eta: 2, tau: 39, gamma1: 2 ** 17, gamma2: (Q - 1) / 88, omega: 80, lambda: 128 },
  'ML-DSA-65': { k: 6, l: 5, eta: 4, tau: 49, gamma1: 2 ** 19, gamma2: (Q - 1) / 32, omega: 55, lambda: 192 },
  'ML-DSA-87': { k: 8, l: 7, eta: 2, tau: 60, gamma1: 2 ** 19, gamma2: (Q - 1) / 32, omega: 75, lambda: 256 },
};
export const beta = (P: MLDSAParams) => P.tau * P.eta;

/** 기대 반복 횟수 ≈ exp(256·β·(l/γ₁ + k/γ₂))  (FIPS 204 표 1: 4.25, 5.1, 3.85) */
export const expectedRepetitions = (P: MLDSAParams) => Math.exp(N * beta(P) * (P.l / P.gamma1 + P.k / P.gamma2));

export function sizes(P: MLDSAParams) {
  const bitlen = (x: number) => Math.floor(Math.log2(x)) + 1;
  return {
    pk: 32 + 32 * P.k * 10,
    sk: 128 + 32 * ((P.l + P.k) * bitlen(2 * P.eta) + D * P.k),
    sig: P.lambda / 4 + P.l * 32 * (1 + Math.log2(P.gamma1)) + P.omega + P.k,
  };
}

const m = (x: number) => ((x % Q) + Q) % Q;
/** a·b mod q (곱이 2⁴⁶ 미만이라 배정밀도로 정확) */
const mulq = (a: number, b: number) => m(a * b);
export const centered = (x: number, a = Q) => { const r = ((x % a) + a) % a; return r > a / 2 ? r - a : r; };
/** mod± 2γ₂ 처럼 (−a/2, a/2] 로 보내는 중심 나머지 */
const modpm = (x: number, a: number) => { const r = ((x % a) + a) % a; return r > a / 2 ? r - a : r; };

const bitRev8 = (i: number) => { let r = 0; for (let b = 0; b < 8; b++) r |= ((i >> b) & 1) << (7 - b); return r; };
export const ZETAS = Array.from({ length: 256 }, (_, i) => modPow(1753, bitRev8(i), Q));

/** FIPS 204 알고리즘 41: NTT (8층, 완전 분해) */
export function ntt(w: number[]): number[] {
  const a = w.map(m);
  let k = 0;
  for (let len = 128; len >= 1; len >>= 1)
    for (let start = 0; start < N; start += 2 * len) {
      const z = ZETAS[++k];
      for (let j = start; j < start + len; j++) {
        const t = mulq(z, a[j + len]);
        a[j + len] = m(a[j] - t);
        a[j] = m(a[j] + t);
      }
    }
  return a;
}

/** 알고리즘 42: 역 NTT (마지막에 256⁻¹ = 8347681) */
export function nttInv(w: number[]): number[] {
  const a = w.slice();
  let k = 256;
  for (let len = 1; len < N; len <<= 1)
    for (let start = 0; start < N; start += 2 * len) {
      const z = Q - ZETAS[--k];
      for (let j = start; j < start + len; j++) {
        const t = a[j];
        a[j] = m(t + a[j + len]);
        a[j + len] = mulq(z, m(t - a[j + len]));
      }
    }
  return a.map((x) => mulq(x, 8347681));
}

const pmul = (f: number[], g: number[]) => f.map((x, i) => mulq(x, g[i]));
const padd = (f: number[], g: number[]) => f.map((x, i) => m(x + g[i]));
const psub = (f: number[], g: number[]) => f.map((x, i) => m(x - g[i]));
const infNorm = (f: number[]) => f.reduce((s, x) => Math.max(s, Math.abs(centered(x))), 0);

/* ------------------------------------------------------------------ 반올림 도구 */

/** 알고리즘 35: r = r₁·2ᵈ + r₀,  r₀ ∈ (−2ᵈ⁻¹, 2ᵈ⁻¹] */
export function power2Round(r: number): [number, number] {
  const rp = m(r), r0 = modpm(rp, 2 ** D);
  return [(rp - r0) / 2 ** D, r0];
}

/** 알고리즘 36: r = r₁·2γ₂ + r₀ (경계 q − 1 처리 포함) */
export function decompose(r: number, gamma2: number): [number, number] {
  const rp = m(r);
  let r0 = modpm(rp, 2 * gamma2);
  if (rp - r0 === Q - 1) return [0, r0 - 1];
  return [(rp - r0) / (2 * gamma2), r0];
}
export const highBits = (r: number, g2: number) => decompose(r, g2)[0];
export const lowBits = (r: number, g2: number) => decompose(r, g2)[1];
/** 알고리즘 39: r 에 z 를 더하면 HighBits 가 바뀌는가 */
export const makeHint = (z: number, r: number, g2: number) => (highBits(r, g2) !== highBits(r + z, g2) ? 1 : 0);
/** 알고리즘 40: 힌트로 HighBits(r + z) 를 복원 */
export function useHint(h: number, r: number, g2: number): number {
  const M = (Q - 1) / (2 * g2);
  const [r1, r0] = decompose(r, g2);
  if (h === 1 && r0 > 0) return (r1 + 1) % M;
  if (h === 1 && r0 <= 0) return (r1 - 1 + M) % M;
  return r1;
}

/* ------------------------------------------------------------------ 토이 해시 */

function toyHash(seed: number, xs: number[]): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (const x of xs) {
    h = Math.imul(h ^ (x >>> 0), 0x01000193) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  }
  return h >>> 0;
}

/** 알고리즘 29 의 모양: 정확히 τ 개의 ±1 을 가진 c (Fisher–Yates 식 배치) */
export function sampleInBall(seed: number, tau: number): number[] {
  const r = mulberry32(seed), c = new Array(N).fill(0);
  for (let i = N - tau; i < N; i++) {
    const j = Math.floor(r() * (i + 1));
    c[i] = c[j];
    c[j] = r() < 0.5 ? 1 : Q - 1;
  }
  return c;
}

/* ------------------------------------------------------------------ 키 생성 · 서명 · 검증 */

export interface MLDSAKey {
  P: MLDSAParams;
  Ahat: number[][][];   // k × l, NTT 영역
  s1hat: number[][]; s2hat: number[][];
  t1: number[][]; t0hat: number[][];
}

const uniformPoly = (rng: Rng, lo: number, hi: number) => Array.from({ length: N }, () => m(lo + Math.floor(rng() * (hi - lo + 1))));

export function keyGen(P: MLDSAParams, rng: Rng): MLDSAKey {
  const Ahat = Array.from({ length: P.k }, () => Array.from({ length: P.l }, () => Array.from({ length: N }, () => Math.floor(rng() * Q))));
  const s1 = Array.from({ length: P.l }, () => uniformPoly(rng, -P.eta, P.eta));
  const s2 = Array.from({ length: P.k }, () => uniformPoly(rng, -P.eta, P.eta));
  const s1hat = s1.map(ntt), s2hat = s2.map(ntt);
  const t = Ahat.map((row, i) => padd(nttInv(row.reduce((acc, a, j) => padd(acc, pmul(a, s1hat[j])), new Array(N).fill(0))), s2[i]));
  const t1 = t.map((p) => p.map((x) => power2Round(x)[0]));
  const t0hat = t.map((p) => ntt(p.map((x) => m(power2Round(x)[1]))));
  return { P, Ahat, s1hat, s2hat, t1, t0hat };
}

export type Reject = 'z' | 'r0' | 'ct0' | 'hint';
export interface Signature { ctilde: number; z: number[][]; h: number[][]; }
export interface SignResult { sig: Signature; attempts: Reject[]; zMax: number; r0Max: number; }

const matVec = (Ahat: number[][][], vhat: number[][]) => Ahat.map((row) => nttInv(row.reduce((acc, a, j) => padd(acc, pmul(a, vhat[j])), new Array(N).fill(0))));

/** 알고리즘 7 의 서명 루프. attempts 에 거절 이유가 순서대로 쌓인다(마지막 성공은 넣지 않음). */
export function sign(key: MLDSAKey, msg: number, rng: Rng, maxIter = 1000): SignResult {
  const { P } = key, g2 = P.gamma2, b = beta(P);
  const attempts: Reject[] = [];
  for (let it = 0; it < maxIter; it++) {
    const y = Array.from({ length: P.l }, () => uniformPoly(rng, -P.gamma1 + 1, P.gamma1));
    const w = matVec(key.Ahat, y.map(ntt));
    const w1 = w.map((p) => p.map((x) => highBits(x, g2)));
    const ctilde = toyHash(msg, w1.flat());
    const chat = ntt(sampleInBall(ctilde, P.tau));
    const z = y.map((yi, i) => padd(yi, nttInv(pmul(chat, key.s1hat[i]))));
    const cs2 = key.s2hat.map((s) => nttInv(pmul(chat, s)));
    const wcs2 = w.map((p, i) => psub(p, cs2[i]));
    const zMax = Math.max(...z.map(infNorm));
    const r0Max = Math.max(...wcs2.map((p) => p.reduce((s, x) => Math.max(s, Math.abs(lowBits(x, g2))), 0)));
    if (zMax >= P.gamma1 - b) { attempts.push('z'); continue; }
    if (r0Max >= g2 - b) { attempts.push('r0'); continue; }
    const ct0 = key.t0hat.map((t) => nttInv(pmul(chat, t)));
    if (Math.max(...ct0.map(infNorm)) >= g2) { attempts.push('ct0'); continue; }
    const h = ct0.map((p, i) => p.map((x, j) => makeHint(m(-x), m(wcs2[i][j] + x), g2)));
    if (h.flat().reduce((s, x) => s + x, 0) > P.omega) { attempts.push('hint'); continue; }
    return { sig: { ctilde, z, h }, attempts, zMax, r0Max };
  }
  throw new Error('too many iterations');
}

/** 알고리즘 8: w₁′ = UseHint(h, Az − c·t₁·2ᵈ) 로 다시 해시해 비교 */
export function verify(key: MLDSAKey, msg: number, sig: Signature): boolean {
  const { P } = key, g2 = P.gamma2;
  if (Math.max(...sig.z.map(infNorm)) >= P.gamma1 - beta(P)) return false;
  if (sig.h.flat().reduce((s, x) => s + x, 0) > P.omega) return false;
  const chat = ntt(sampleInBall(sig.ctilde, P.tau));
  const Az = matVec(key.Ahat, sig.z.map(ntt));
  const ct1 = key.t1.map((t) => nttInv(pmul(chat, ntt(t.map((x) => mulq(x, 2 ** D))))));
  const w1 = Az.map((p, i) => psub(p, ct1[i]).map((x, j) => useHint(sig.h[i][j], x, g2)));
  return toyHash(msg, w1.flat()) === sig.ctilde;
}
