/**
 * 17장: 서명 분포 실험 도구 (교육용).
 * - 가우시안 거절 샘플링: 한쪽으로 밀린 제안 분포(Lyubashevsky 2012) vs 바이모달(BLISS)
 * - 2차원 hash-and-sign: Babai(반올림·최근접 평면)는 비밀 기저 모양을 흘리고, Klein/GPV 샘플러는 흘리지 않는다
 */
import { type Rng, gaussian } from './lwe';

/* ------------------------------------------------------------------ 거절 샘플링의 반복 횟수 M */

/** 한쪽 이동, 꼬리 자르기 판 (Lyubashevsky, Eurocrypt 2012, σ = α‖v‖): M = exp(12/α + 1/(2α²)) */
export const unimodalM = (alpha: number) => Math.exp(12 / alpha + 1 / (2 * alpha * alpha));
/** 바이모달 (BLISS, CRYPTO 2013): M = exp(1/(2α²)), 꼬리 자르기 없이 정확 */
export const bimodalM = (alpha: number) => Math.exp(1 / (2 * alpha * alpha));

/** 단조 감소 함수 f(α) = target 인 α 를 이분법으로 */
export function solveAlpha(f: (a: number) => number, target: number): number {
  let lo = 0.05, hi = 1000;
  for (let i = 0; i < 200; i++) { const mid = Math.sqrt(lo * hi); if (f(mid) > target) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
}

/** 1차원 바이모달 거절 샘플링 한 번: 받아들이면 z, 아니면 null. 받아들인 z 는 정확히 N(0, σ²). */
export function bimodalTry(rng: Rng, sigma: number, v: number): number | null {
  const z = sigma * gaussian(rng) + (rng() < 0.5 ? v : -v);
  return rng() < 1 / Math.cosh((z * v) / (sigma * sigma)) ? z : null;
}

/** 1차원 한쪽 이동 거절 샘플링 한 번 (M 은 위 식). 받아들인 z 는 N(0, σ²) 에 통계적으로 가깝다. */
export function unimodalTry(rng: Rng, sigma: number, v: number): number | null {
  const z = sigma * gaussian(rng) + v;
  const M = unimodalM(sigma / Math.abs(v));
  const ratio = Math.exp((-2 * z * v + v * v) / (2 * sigma * sigma)); // D(z) / D_v(z)
  return rng() < Math.min(1, ratio / M) ? z : null;
}

/* ------------------------------------------------------------------ 2차원 hash-and-sign */

export type V2 = [number, number];
export type B2 = [V2, V2];
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];

export function gso(B: B2): { bs: B2; mu: number } {
  const mu = dot(B[1], B[0]) / dot(B[0], B[0]);
  return { bs: [B[0], [B[1][0] - mu * B[0][0], B[1][1] - mu * B[0][1]]], mu };
}

/** Babai 반올림: 좌표를 반올림 → t − v ∈ P½(B) */
export function roundOff(B: B2, t: V2): V2 {
  const det = B[0][0] * B[1][1] - B[0][1] * B[1][0];
  const c0 = Math.round((t[0] * B[1][1] - t[1] * B[1][0]) / det), c1 = Math.round((-t[0] * B[0][1] + t[1] * B[0][0]) / det);
  return [c0 * B[0][0] + c1 * B[1][0], c0 * B[0][1] + c1 * B[1][1]];
}

/** ℤ 위 이산 가우시안 (중심 c, 표준편차 σ), 거절 샘플링 */
export function sampleZ(rng: Rng, c: number, sigma: number): number {
  const lo = Math.floor(c - 10 * sigma), hi = Math.ceil(c + 10 * sigma);
  for (;;) {
    const x = lo + Math.floor(rng() * (hi - lo + 1));
    if (rng() < Math.exp(-((x - c) ** 2) / (2 * sigma * sigma))) return x;
  }
}

/**
 * 최근접 평면(randomized = false) 또는 Klein 샘플러(randomized = true, GPV 서명의 핵심).
 * Klein: i = n..1 마다 계수를 ‘반올림’ 대신 이산 가우시안 D_{ℤ, c_i, σ/‖b_i*‖} 에서 뽑는다.
 */
export function nearestPlane(B: B2, t: V2, rng?: Rng, sigma = 0): V2 {
  const { bs } = gso(B);
  let r: V2 = [t[0], t[1]];
  const v: V2 = [0, 0];
  for (let i = 1; i >= 0; i--) {
    const ci = dot(r, bs[i]) / dot(bs[i], bs[i]);
    const z = rng ? sampleZ(rng, ci, sigma / Math.sqrt(dot(bs[i], bs[i]))) : Math.round(ci);
    r = [r[0] - z * B[i][0], r[1] - z * B[i][1]];
    v[0] += z * B[i][0]; v[1] += z * B[i][1];
  }
  return v;
}

/** 표본 공분산 (평균 0 가정) 과 고윳값·주축 각도 */
export function covariance(pts: V2[]) {
  const n = Math.max(1, pts.length);
  const a = pts.reduce((s, p) => s + p[0] * p[0], 0) / n, b = pts.reduce((s, p) => s + p[0] * p[1], 0) / n, d = pts.reduce((s, p) => s + p[1] * p[1], 0) / n;
  const tr = a + d, disc = Math.sqrt(Math.max(0, ((a - d) / 2) ** 2 + b * b));
  return { a, b, d, l1: tr / 2 + disc, l2: tr / 2 - disc, angle: 0.5 * Math.atan2(2 * b, a - d) };
}
