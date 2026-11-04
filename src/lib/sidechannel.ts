/**
 * 20장: 복호 실패 공격과 구현 공격 (교육용).
 *
 * - failure boosting: 암호화 동전 (r, e1) 의 노름 R² = ‖r‖² + ‖e1‖² 가 큰 '약한 암호문'만 골라 쓰면
 *   질의당 실패 확률은 오르지만, 그런 암호문을 찾는 사전 계산이 든다 (D'Anvers 외 PKC 2019 의 기본형).
 *   조건부 잡음 ≈ N(0, (η₁/2)(R² + nk·Var Δu)) + (e2 + Δv 의 정확한 분포)  — 가우시안 근사
 * - 평문 확인(PC) 오라클 공격: "복호 결과가 0 인가?" 만 알려 주는 오라클로 K-PKE 비밀키를 계수마다 복원
 * - TVLA 식 Welch t-검정: 비밀에 따라 아주 조금 다른 측정값도 표본을 모으면 드러난다
 */
import { type MLKEMParams, N, Q, compress, decompress, kpkeDecrypt, nttInv, pmfCompressError, type KPKECipher, type KPKEKey } from './mlkem';
import { type PMF, convolve, pmfCBD } from './prob';
import { type Rng, gaussian } from './lwe';

/* ------------------------------------------------------------------ failure boosting */

const pmfSquare = (d: PMF): PMF => {
  const m = new Map<number, number>();
  d.p.forEach((p, i) => { const x = (d.min + i) ** 2; m.set(x, (m.get(x) ?? 0) + p); });
  const hi = Math.max(...m.keys()), p = new Array(hi + 1).fill(0);
  m.forEach((v, k) => (p[k] = v));
  return { min: 0, p };
};
function power(d: PMF, n: number): PMF {
  let res: PMF = { min: 0, p: [1] }, base = d, e = n;
  while (e > 0) { if (e & 1) res = convolve(res, base); e >>= 1; if (e) base = convolve(base, base); }
  return res;
}
/** ln Pr[Z > z], Z ~ N(0,1), 꼬리가 아주 작아도 정확하게 (점근 전개) */
export function logPhiC(z: number): number {
  if (z < 5) return Math.log(0.5 * erfc(z / Math.SQRT2));
  return -z * z / 2 - Math.log(z * Math.sqrt(2 * Math.PI)) + Math.log(1 - 1 / z ** 2 + 3 / z ** 4);
}
function erfc(x: number): number {
  // Numerical Recipes erfcc (상대 오차 < 1.2e-7)
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
const lse = (xs: number[]) => { const m = Math.max(...xs); return m === -Infinity ? -Infinity : m + Math.log(xs.reduce((s, x) => s + Math.exp(x - m), 0)); };

export interface BoostPoint { r2: number; log2Weak: number; log2Q: number; log2Work: number; }

/**
 * 임계값 t 마다: p_weak = Pr[R² ≥ t], δ_weak = E[δ(R) | R² ≥ t].
 * 실패 하나를 얻는 데 질의 1/δ_weak 번, 사전 계산(해시) 1/(p_weak·δ_weak) 번.
 */
export function boostingCurve(P: MLKEMParams) {
  const n = N * P.k;
  const cu = pmfCompressError(P.du);
  const varU = cu.p.reduce((s, x, i) => s + x * (cu.min + i) ** 2, 0);
  const X = convolve(pmfCBD(P.eta2), pmfCompressError(P.dv));
  const R = convolve(power(pmfSquare(pmfCBD(P.eta1)), n), power(pmfSquare(pmfCBD(P.eta2)), n));
  const lnDelta = (r2: number) => {
    const s = Math.sqrt((P.eta1 / 2) * (r2 + n * varU));
    const terms: number[] = [];
    X.p.forEach((p, i) => { if (p > 0) { const x = X.min + i; terms.push(Math.log(p) + logPhiC((Q / 4 - x) / s), Math.log(p) + logPhiC((Q / 4 + x) / s)); } });
    return Math.log(N) + lse(terms);
  };
  const pts: BoostPoint[] = [];
  const accP: number[] = [], accD: number[] = [];
  let lnTotal = -Infinity;
  const all: number[] = [];
  for (let i = R.p.length - 1; i >= 0; i--) {
    const p = R.p[i];
    if (!(p > 0)) continue;
    const r2 = R.min + i, lp = Math.log(p), ld = lnDelta(r2);
    accP.push(lp); accD.push(lp + ld); all.push(lp + ld);
    if (accP.length % 8 === 1 || i === 0) {
      const pw = lse(accP), dw = lse(accD) - pw;
      pts.push({ r2, log2Weak: -pw / Math.LN2, log2Q: -dw / Math.LN2, log2Work: -(pw + dw) / Math.LN2 });
    }
  }
  lnTotal = lse(all);
  return { pts: pts.reverse(), log2Delta: lnTotal / Math.LN2, meanR2: n * (P.eta1 / 2 + P.eta2 / 2) };
}

/* ------------------------------------------------------------------ 평문 확인 오라클 */

/** 오라클: 암호문을 복호한 메시지가 0 비트열인가? (부채널이나 키 재사용이 이런 오라클을 만든다) */
export const zeroOracle = (key: KPKEKey) => (c: KPKECipher) => kpkeDecrypt(key, c).bits.every((b) => b === 0);

/** 비밀 다항식 i 의 계수 j 를 겨냥한 암호문: u_i = c (상수), v = t·x^j. 복호 시 w_j = t − c·s_{i,j}. */
export function craft(P: MLKEMParams, i: number, j: number, z: number): KPKECipher {
  const y0 = 2 ** (P.du - 4);                                    // Decompress_du(y0) ≈ q/16 ≈ 208
  const u = Array.from({ length: P.k }, (_, t) => { const p = new Array(N).fill(0); if (t === i) p[0] = y0; return p; });
  const v = new Array(N).fill(0); v[j] = z;
  return { u, v };
}

/** 후보 s 마다 "질의 z 에서 비트가 1 인가" 를 미리 계산 (공격자도 할 수 있는 계산) */
function bitTable(P: MLKEMParams) {
  const c = decompress(2 ** (P.du - 4), P.du);
  const cands = Array.from({ length: 2 * P.eta1 + 1 }, (_, t) => t - P.eta1);
  const zs = Array.from({ length: 2 ** P.dv }, (_, z) => z);
  const bit = (z: number, s: number) => compress((((decompress(z, P.dv) - c * s) % Q) + Q) % Q, 1);
  return { cands, zs, bit };
}

/** 계수 하나를 적응적으로 복원: 남은 후보를 가장 고르게 나누는 z 로 질의 */
export function recoverCoeff(P: MLKEMParams, oracle: (c: KPKECipher) => boolean, i: number, j: number) {
  const { cands, zs, bit } = bitTable(P);
  let left = cands.slice(), queries = 0;
  while (left.length > 1 && queries < 10) {
    let bestZ = -1, bestScore = Infinity;
    for (const z of zs) { const ones = left.filter((s) => bit(z, s) === 1).length; const score = Math.abs(2 * ones - left.length); if (ones > 0 && ones < left.length && score < bestScore) { bestScore = score; bestZ = z; } }
    if (bestZ < 0) break;
    const isZero = oracle(craft(P, i, j, bestZ));       // 비트가 0 이면 메시지 전체가 0
    queries++;
    left = left.filter((s) => (bit(bestZ, s) === 0) === isZero);
  }
  return { s: left.length === 1 ? left[0] : null, queries };
}

/** 실제 비밀 (검증용) */
export const secretOf = (key: KPKEKey) => key.sHat.map((p) => nttInv(p).map((x) => (x > Q / 2 ? x - Q : x)));

/* ------------------------------------------------------------------ t-검정 */

/**
 * 측정값 = 기본값 + λ·(비밀 비트) + 잡음 N(0, σ²). 고정 입력 클래스(비밀 비트 1)와 무작위 클래스(비트 0/1 반반)를
 * 각각 m 번 재서 Welch t 를 계산 (TVLA 의 fixed-vs-random).
 */
export function tvla(rng: Rng, m: number, lambda: number, sigma: number) {
  let s1 = 0, q1 = 0, s2 = 0, q2 = 0;
  for (let i = 0; i < m; i++) {
    const a = lambda + sigma * gaussian(rng);
    const b = (rng() < 0.5 ? lambda : 0) + sigma * gaussian(rng);
    s1 += a; q1 += a * a; s2 += b; q2 += b * b;
  }
  const m1 = s1 / m, m2 = s2 / m, v1 = q1 / m - m1 * m1, v2 = q2 / m - m2 * m2;
  return (m1 - m2) / Math.sqrt(v1 / m + v2 / m);
}
