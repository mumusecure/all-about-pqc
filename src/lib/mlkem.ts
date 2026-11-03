/**
 * 16장: ML-KEM (FIPS 203) 의 산술 부분 (교육용).
 *
 * - 환 R_q = ℤ_3329[X]/(X²⁵⁶ + 1), NTT (ζ = 17), BaseCaseMultiply, 압축 — FIPS 203 과 같은 정의
 * - K-PKE 는 산술은 실제와 같지만, 난수를 SHAKE 대신 mulberry32 로 뽑는다(위젯용).
 *   바이트 단위로 FIPS 203 과 같은 구현은 labs/lab03_mlkem.py 에 있다.
 * - 복호 실패 확률 δ 의 정확 계산 (PMF 합성곱, 계수 독립 가정 + 합집합 상한)
 */
import { modPow } from './algebra';
import { type Rng } from './lwe';
import { type PMF, convolve, pmfCBD, pmfProduct } from './prob';

export const Q = 3329;
export const N = 256;

export interface MLKEMParams { k: number; eta1: number; eta2: number; du: number; dv: number; }
export const PARAMS: Record<'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024', MLKEMParams> = {
  'ML-KEM-512': { k: 2, eta1: 3, eta2: 2, du: 10, dv: 4 },
  'ML-KEM-768': { k: 3, eta1: 2, eta2: 2, du: 10, dv: 4 },
  'ML-KEM-1024': { k: 4, eta1: 2, eta2: 2, du: 11, dv: 5 },
};
/** FIPS 203 표 1 의 복호 실패 확률 (log₂) */
export const FIPS_LOG2_DELTA = { 'ML-KEM-512': -138.8, 'ML-KEM-768': -164.8, 'ML-KEM-1024': -174.8 };

export const sizes = ({ k, du, dv }: MLKEMParams) => ({ ek: 384 * k + 32, dk: 768 * k + 96, ct: 32 * (du * k + dv) });

const m = (x: number) => ((x % Q) + Q) % Q;
export const centered = (x: number) => { const r = m(x); return r > Q >> 1 ? r - Q : r; };

export const bitRev7 = (i: number) => { let r = 0; for (let b = 0; b < 7; b++) r |= ((i >> b) & 1) << (6 - b); return r; };
export const ZETAS = Array.from({ length: 128 }, (_, i) => modPow(17, bitRev7(i), Q));
export const GAMMAS = Array.from({ length: 128 }, (_, i) => modPow(17, 2 * bitRev7(i) + 1, Q));

/** 알고리즘 9: NTT (출력은 128 개의 1차 다항식 (â₂ᵢ, â₂ᵢ₊₁)) */
export function ntt(f: number[]): number[] {
  const a = f.slice();
  let i = 1;
  for (let len = 128; len >= 2; len >>= 1)
    for (let start = 0; start < N; start += 2 * len) {
      const z = ZETAS[i++];
      for (let j = start; j < start + len; j++) {
        const t = (z * a[j + len]) % Q;
        a[j + len] = m(a[j] - t);
        a[j] = (a[j] + t) % Q;
      }
    }
  return a;
}

/** 알고리즘 10: 역 NTT (마지막에 128⁻¹ = 3303 을 곱한다) */
export function nttInv(f: number[]): number[] {
  const a = f.slice();
  let i = 127;
  for (let len = 2; len <= 128; len <<= 1)
    for (let start = 0; start < N; start += 2 * len) {
      const z = ZETAS[i--];
      for (let j = start; j < start + len; j++) {
        const t = a[j];
        a[j] = (t + a[j + len]) % Q;
        a[j + len] = m(z * (a[j + len] - t));
      }
    }
  return a.map((x) => (x * 3303) % Q);
}

/** 알고리즘 11–12: NTT 영역 곱 = 슬롯마다 (a₀ + a₁X)(b₀ + b₁X) mod (X² − γᵢ) */
export function mulNTT(f: number[], g: number[]): number[] {
  const h = new Array(N);
  for (let i = 0; i < 128; i++) {
    const a0 = f[2 * i], a1 = f[2 * i + 1], b0 = g[2 * i], b1 = g[2 * i + 1];
    h[2 * i] = (a0 * b0 + ((a1 * b1) % Q) * GAMMAS[i]) % Q;
    h[2 * i + 1] = (a0 * b1 + a1 * b0) % Q;
  }
  return h;
}

const addP = (f: number[], g: number[]) => f.map((x, i) => (x + g[i]) % Q);

/** Compress_d(x) = ⌈(2ᵈ/q)·x⌋ mod 2ᵈ,  Decompress_d(y) = ⌈(q/2ᵈ)·y⌋ */
export const compress = (x: number, d: number) => Math.floor((x * 2 ** (d + 1) + Q) / (2 * Q)) % 2 ** d;
export const decompress = (y: number, d: number) => Math.floor((Q * y * 2 + 2 ** d) / 2 ** (d + 1));
export const compressError = (x: number, d: number) => centered(decompress(compress(x, d), d) - x);

/** x ← ℤ_q 균등일 때 압축 오차의 분포 */
export function pmfCompressError(d: number): PMF {
  const cnt = new Map<number, number>();
  for (let x = 0; x < Q; x++) { const e = compressError(x, d); cnt.set(e, (cnt.get(e) ?? 0) + 1); }
  const keys = [...cnt.keys()], lo = Math.min(...keys), hi = Math.max(...keys);
  const p = new Array(hi - lo + 1).fill(0);
  cnt.forEach((c, e) => (p[e - lo] = c / Q));
  return { min: lo, p };
}

export function sampleCBD(rng: Rng, eta: number): number {
  let s = 0;
  for (let i = 0; i < eta; i++) s += (rng() < 0.5 ? 1 : 0) - (rng() < 0.5 ? 1 : 0);
  return s;
}
const cbdPoly = (rng: Rng, eta: number) => Array.from({ length: N }, () => m(sampleCBD(rng, eta)));

/* ------------------------------------------------------------------ K-PKE (토이 난수) */

export interface KPKEKey { P: MLKEMParams; Ahat: number[][][]; tHat: number[][]; sHat: number[][]; }

export function kpkeKeyGen(P: MLKEMParams, rng: Rng): KPKEKey {
  const { k, eta1 } = P;
  const Ahat = Array.from({ length: k }, () => Array.from({ length: k }, () => Array.from({ length: N }, () => Math.floor(rng() * Q))));
  const sHat = Array.from({ length: k }, () => ntt(cbdPoly(rng, eta1)));
  const eHat = Array.from({ length: k }, () => ntt(cbdPoly(rng, eta1)));
  const tHat = Ahat.map((row, i) => row.reduce((acc, a, j) => addP(acc, mulNTT(a, sHat[j])), eHat[i]));
  return { P, Ahat, tHat, sHat };
}

export interface KPKECipher { u: number[][]; v: number[]; }

/** 암호화: 압축된 (u, v) 를 돌려준다 (값은 0 … 2^d − 1) */
export function kpkeEncrypt(key: KPKEKey, bits: number[], rng: Rng): KPKECipher {
  const { k, eta1, eta2, du, dv } = key.P;
  const yHat = Array.from({ length: k }, () => ntt(cbdPoly(rng, eta1)));
  const e1 = Array.from({ length: k }, () => cbdPoly(rng, eta2));
  const e2 = cbdPoly(rng, eta2);
  const u = Array.from({ length: k }, (_, i) => {
    let acc = new Array(N).fill(0);
    for (let j = 0; j < k; j++) acc = addP(acc, mulNTT(key.Ahat[j][i], yHat[j]));
    return addP(nttInv(acc), e1[i]).map((x) => compress(x, du));
  });
  let acc = new Array(N).fill(0);
  for (let i = 0; i < k; i++) acc = addP(acc, mulNTT(key.tHat[i], yHat[i]));
  const v = addP(addP(nttInv(acc), e2), bits.map((b) => decompress(b, 1))).map((x) => compress(x, dv));
  return { u, v };
}

/** 복호: w = v′ − sᵀu′ 와 복원된 비트 */
export function kpkeDecrypt(key: KPKEKey, c: KPKECipher): { w: number[]; bits: number[] } {
  const { k, du, dv } = key.P;
  let acc = new Array(N).fill(0);
  for (let i = 0; i < k; i++) acc = addP(acc, mulNTT(key.sHat[i], ntt(c.u[i].map((x) => decompress(x, du)))));
  const su = nttInv(acc);
  const w = c.v.map((x, i) => m(decompress(x, dv) - su[i]));
  return { w, bits: w.map((x) => compress(x, 1)) };
}

/** 복호 잡음 = w − μ (중심 표현). 이 값의 절댓값이 q/4 를 넘으면 그 비트가 틀린다. */
export const decryptionNoise = (w: number[], bits: number[]) => w.map((x, i) => centered(x - decompress(bits[i], 1)));

/* ------------------------------------------------------------------ 복호 실패 확률 */

/** 아주 작은(eps 미만) 양 끝 확률을 잘라 배열을 짧게 유지 */
function trim(d: PMF, eps = 2 ** -300): PMF {
  let lo = 0, hi = d.p.length - 1;
  while (lo < hi && d.p[lo] < eps) lo++;
  while (hi > lo && d.p[hi] < eps) hi--;
  return { min: d.min + lo, p: d.p.slice(lo, hi + 1) };
}
function power(d: PMF, n: number): PMF {
  let res: PMF = { min: 0, p: [1] }, base = d, e = n;
  while (e > 0) {
    if (e & 1) res = trim(convolve(res, base));
    e >>= 1;
    if (e) base = trim(convolve(base, base));
  }
  return res;
}

/** 이론 분산: Var = nk·[Var(η₁)² + Var(η₁)(Var(η₂) + Var(Δu))] + Var(η₂) + Var(Δv) */
export function noiseVariance(P: MLKEMParams): number {
  const v = (d: PMF) => d.p.reduce((s, x, i) => s + x * (d.min + i) ** 2, 0);
  const s1 = P.eta1 / 2, s2 = P.eta2 / 2;
  return N * P.k * (s1 * s1 + s1 * (s2 + v(pmfCompressError(P.du)))) + s2 + v(pmfCompressError(P.dv));
}

/**
 * 잡음 eᵀr + e2 + Δv − sᵀ(e1 + Δu) 의 한 계수 분포 (계수들을 독립으로 보는 표준 모델).
 * 각 곱 항은 nk 개 독립 곱의 합이다(negacyclic 부호는 대칭 분포라 상관없다).
 */
export function noisePMF(P: MLKEMParams): PMF {
  const s = pmfCBD(P.eta1), e = pmfCBD(P.eta2);
  const t1 = power(pmfProduct(s, s), N * P.k);
  const t2 = power(pmfProduct(s, convolve(e, pmfCompressError(P.du))), N * P.k);
  const t3 = convolve(e, pmfCompressError(P.dv));
  return trim(convolve(trim(convolve(t1, t2)), t3));
}

/** δ ≈ n · Pr[|잡음| > q/4]  (log₂ 로 돌려준다) */
export function log2FailureProb(P: MLKEMParams, D = noisePMF(P)): number {
  let tail = 0;
  for (let i = D.p.length - 1; i >= 0; i--) if (Math.abs(D.min + i) > Q / 4) tail += D.p[i];
  return tail > 0 ? Math.log2(N * tail) : -Infinity;
}
