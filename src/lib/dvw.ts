/**
 * 논문 읽기 5: Ducas–van Woerden, NTRU Fatigue (ASIACRYPT 2021) 의 SKR·DSD 예측기를 TypeScript 로 옮긴 것 (교육용).
 *
 * 원본: 저자들의 공개 코드 https://github.com/WvanWoerden/NTRUFatigue 의 estimator.sage.
 * 구조와 상수(작은 블록의 GH 상수, 8 투어 BKZ 의 실험 기울기 표)는 원본을 따랐고, 수치 루틴
 * (log-gamma, digamma, 불완전 감마, ζ'/ζ, m 의 최적화)은 직접 구현했다. 로그는 모두 자연로그.
 *
 *  - SKR (secret key recovery): 숨은 키 벡터 하나의 사영이 블록 첫 GS 벡터보다 짧아지는 사건 (2016 uSVP 의 확률판)
 *  - DSD (dense sublattice discovery): 앞 s 개 기저 벡터가 펼치는 공간과 키 부분격자의 교집합(랭크 s − n)에 있는
 *    짧은 벡터의 사영이, 위치 κ = s − β 의 블록에서 먼저 짧아지는 사건
 */

/* ------------------------------------------------------------------ 수치 루틴 */

const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
/** ln Γ(x), x > 0 */
export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += LANCZOS[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** ψ(x) = d/dx ln Γ(x), x > 0 */
export function digamma(x: number): number {
  let r = 0;
  while (x < 6) { r -= 1 / x; x += 1; }
  const f = 1 / (x * x);
  return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
}

/** 정규화된 하부 불완전 감마 P(a, x) */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  const lg = lgamma(a);
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a;
    for (let i = 0; i < 10000; i++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-15) break; }
    return Math.min(1, sum * Math.exp(-x + a * Math.log(x) - lg));
  }
  // 연분수 (Lentz)
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a); b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.max(0, 1 - Math.exp(-x + a * Math.log(x) - lg) * h);
}

/** 자유도 k 인 카이제곱 분포의 CDF */
export const chi2CDF = (k: number, x: number) => (x > 100 * k ? 1 : gammaP(k / 2, x / 2));

const zetaCache = new Map<number, number>();
/** 정수 k ≥ 2 에서 ζ′(k)/ζ(k) = −Σ Λ… 대신 직접 합 (Euler–Maclaurin 꼬리 보정) */
export function zetaPrimeOverZeta(k: number): number {
  const hit = zetaCache.get(k); if (hit !== undefined) return hit;
  let z = 0, zp = 0;
  const M = 2000;
  for (let m = 1; m < M; m++) { const t = Math.pow(m, -k); z += t; zp -= Math.log(m) * t; }
  // 꼬리 Σ_{m ≥ M} : 적분 + 첫 항의 절반
  const tM = Math.pow(M, -k), lM = Math.log(M);
  z += (M * tM) / (k - 1) + tM / 2;
  zp -= (M * tM * (lM / (k - 1) + 1 / ((k - 1) * (k - 1)))) + (lM * tM) / 2;
  const r = zp / z;
  zetaCache.set(k, r);
  return r;
}

/* ------------------------------------------------------------------ 격자 휴리스틱 (원본과 같은 모델) */

const ballLogVol = (n: number) => (n / 2) * Math.log(Math.PI) - lgamma(n / 2 + 1);

/** 원본의 작은 차원 GH 상수 (d < 49) */
const GH_CONST: Record<number, number> = { 1: 0, 2: -0.50511, 3: -0.46488, 4: -0.391, 5: -0.29759, 6: -0.2488, 7: -0.2197, 8: -0.15748, 9: -0.14673, 10: -0.07541, 11: -0.0487, 12: -0.01045, 13: 0.02298, 14: 0.04212, 15: 0.07014, 16: 0.09205, 17: 0.12004, 18: 0.14988, 19: 0.17351, 20: 0.18659, 21: 0.20971, 22: 0.22728, 23: 0.24951, 24: 0.26313, 25: 0.27662, 26: 0.2943, 27: 0.31399, 28: 0.32494, 29: 0.34796, 30: 0.36118, 31: 0.37531, 32: 0.39056, 33: 0.39958, 34: 0.41473, 35: 0.4256, 36: 0.44222, 37: 0.45396, 38: 0.46275, 39: 0.4755, 40: 0.48889, 41: 0.50009, 42: 0.51312, 43: 0.52463, 44: 0.52903, 45: 0.5393, 46: 0.55289, 47: 0.56343, 48: 0.57204 };

/** 랭크 d, ln 부피 logvol 인 격자의 ln λ₁ 추정 (Gaussian heuristic) */
export const logGH = (d: number, logvol = 0) => (d < 49 ? GH_CONST[d] + logvol / d : (logvol - ballLogVol(d)) / d);

const deltaGH = (k: number) => Math.exp(logGH(k) / (k - 1));

/** 원본의 8 투어 BKZ 실험 기울기 (β ≤ 60) */
const SMALL_SLOPE: number[] = [0, 0, 0.04473, 0.04472, 0.04402, 0.04407, 0.04334, 0.04326, 0.04218, 0.04237, 0.04144, 0.04054, 0.03961, 0.03862, 0.03745, 0.03673, 0.03585, 0.03477, 0.03378, 0.03298, 0.03222, 0.03155, 0.03088, 0.03029, 0.02999, 0.02954, 0.02922, 0.02891, 0.02878, 0.0285, 0.02827, 0.02801, 0.02786, 0.02761, 0.02768, 0.02744, 0.02728, 0.02713, 0.02689, 0.02678, 0.02671, 0.02647, 0.02634, 0.02614, 0.02595, 0.02583, 0.02559, 0.02534, 0.02514, 0.02506, 0.02493, 0.02475, 0.02454, 0.02441, 0.02427, 0.02407, 0.02393, 0.02371, 0.02366, 0.02341, 0.02332];

/** BKZ-β 후 프로파일 ln‖bᵢ*‖ 의 기울기 (i 가 1 늘 때 줄어드는 양) */
export function slope(beta: number): number {
  if (beta <= 60) return SMALL_SLOPE[beta];
  if (beta <= 70) { const r = (70 - beta) / 10; return r * SMALL_SLOPE[60] + (1 - r) * 2 * Math.log(deltaGH(70)); }
  return 2 * Math.log(deltaGH(beta));
}

/** Z 모양 프로파일 (ln‖bᵢ*‖, i = 0 … 2n−1): 가운데에서 기울기 slope 로 퍼지고, ln q 와 0 에서 잘린다 */
export function zshape(q: number, n: number, beta: number): number[] {
  const lq = Math.log(q), s = slope(beta);
  const L = [...new Array(n).fill(lq), ...new Array(n).fill(0)];
  let diff = s / 2;
  for (let i = 0; i < n; i++) {
    if (diff > lq / 2) break;
    L[n - i - 1] = lq / 2 + diff;
    L[n + i] = lq / 2 - diff;
    diff += s;
  }
  return L;
}

/** d 차원 가우시안 벡터에서 k 차원을 사영으로 지울 때 ln 길이의 기대 손실 */
const projLogLoss = (d: number, k: number) => (digamma((d - k) / 2) - digamma(d / 2)) / 2;

export type NtruKind = 'matrix' | 'circulant';

/** 키 부분격자의 ln 부피 (원본의 두 모델: 행렬 NTRU / 순환(환) NTRU) */
export function dslLogVol(n: number, sigmasq: number, kind: NtruKind = 'circulant'): number {
  if (kind === 'matrix') {
    const total = (n * (Math.log(sigmasq) + Math.log(2) + digamma(n))) / 2;
    let loss = 0; for (let i = 0; i < n; i++) loss += digamma((2 * n - i) / 2) - digamma(n);
    return total + loss / 2;
  }
  const g = 0.5772156649015329;
  return (Math.log(2) - g + Math.log(n) + Math.log(sigmasq)) / 2 + ((n - 1) * (1 - g + Math.log(n) + Math.log(sigmasq))) / 2;
}

/** 앞 s 개 기저 벡터의 생성 공간과 키 부분격자의 교집합 (랭크 s − n) 의 ln 부피, s = n+1 … 2n */
export function dsliVols(dslLog: number, shape: number[]): number[] {
  const n = shape.length / 2, vols = new Array(2 * n + 1).fill(NaN);
  let v = dslLog, dim = n;
  vols[2 * n] = v;
  for (let s = 2 * n - 1; s > n; s--) {
    v += -shape[s] + projLogLoss(s + 1, n) + zetaPrimeOverZeta(dim);
    vols[s] = v;
    dim--;
  }
  return vols;
}

/** 가우시안 표본(분산 1, 차원 d1 + d2)의 제곱 길이가 lt 이하일 확률 (앞 d2 좌표의 제곱 길이가 l2 이하라는 조건에서) */
function condChi2(d1: number, d2: number, lt: number, l2: number): number {
  const PE2 = chi2CDF(d2, l2);
  if (PE2 === 0) return 1; // 원본은 여기서 예외: 언더플로면 성공으로 본다(안전성 과소평가)
  const steps = 5 * (d1 + d2);
  let p = 0;
  for (let i = steps - 1; i >= 0; i--) {
    const lo = (i * l2) / steps, mid = ((i + 0.5) * l2) / steps, hi = ((i + 1) * l2) / steps;
    p += ((chi2CDF(d2, hi) - chi2CDF(d2, lo)) / PE2) * chi2CDF(d1, lt - mid);
  }
  return p;
}

/** SKR: 한 투어에서 키 회전 n 개 중 하나라도 위치 2n−β−1 에서 발견될 확률 */
export function skrProb(beta: number, q: number, n: number, sigmasq: number): { p: number; pos: Float64Array } {
  const lq = Math.log(q), s = slope(beta);
  // 표본 수(쓰는 q-벡터 수) m 을 최적화: m·ln q/(n+m) − s·((m+n−1)/2 − β) 를 최대로
  let m = 1, best = -Infinity;
  for (let mm = 1; mm <= n; mm++) { const f = (mm * lq) / (n + mm) - s * ((mm + n - 1) / 2 - beta); if (f > best) { best = f; m = mm; } }
  let one = 1;
  const stop = Math.min(Math.max(2 * n, 300), 3 * beta);
  for (let b = beta; b < stop; b += beta - 1) {
    const thr = Math.log(b * sigmasq) / 2;
    const lgs = (m * lq) / (n + m) - s * ((m + n - 1) / 2 - b);
    one *= chi2CDF(b, b * Math.exp(2 * (lgs - thr)));
  }
  const p = 1 - Math.pow(1 - one, n);
  const pos = new Float64Array(2 * n);
  pos[2 * n - beta - 1] = p;
  return { p, pos };
}

/** DSD: 위치 κ = s − β (s = n+1 … 2n) 마다 교집합 격자의 짧은 벡터가 발견될 확률 */
export function dsdProb(beta: number, q: number, n: number, sigmasq: number, kind: NtruKind = 'circulant', dslLog?: number): { p: number; pos: Float64Array } {
  const B = zshape(q, n, beta);
  const vols = dsliVols(dslLog ?? dslLogVol(n, sigmasq, kind), B);
  const pos = new Float64Array(2 * n);
  let notAll = 1;
  for (let i = 1; i <= n; i++) {
    const s = n + i;
    const sig2 = Math.exp(2 * logGH(i, vols[s])) / s;
    if (sig2 > 1e10) continue;
    let one = chi2CDF(beta, Math.exp(2 * B[s - beta]) / sig2);
    if (one <= 1e-7) continue;
    if (beta <= 20) {
      for (let j = 2; j < Math.floor(s / beta + 1); j++) {
        if (one < 1e-6) { one = 0; break; }
        const ind = s - j * (beta - 1) - 1;
        if (ind < 0) break;
        one *= condChi2(beta - 1, s - ind - (beta - 1), Math.exp(2 * B[ind]) / sig2, Math.exp(2 * B[ind + beta - 1]) / sig2);
      }
    }
    pos[s - beta] = one;
    notAll *= Math.max(1 - one, 0);
  }
  return { p: 1 - notAll, pos };
}

export interface Combined { avgBeta: number; pSKR: number; pDSD: number; posSKR: Float64Array; posDSD: Float64Array; }

/** 진행형 BKZ (β = 2, 3, …, 각 β 에서 tours 투어) 에서 어느 사건이 먼저 일어나는지의 확률과 평균 β */
export function combined(q: number, n: number, sigmasq = 2 / 3, kind: NtruKind = 'circulant', tours = 8, only?: 'SKR' | 'DSD'): Combined {
  let rem = 1, avg = 0, pS = 0, pD = 0;
  const posSKR = new Float64Array(2 * n), posDSD = new Float64Array(2 * n);
  for (let beta = 2; beta < n; beta++) {
    const S = only === 'DSD' ? null : skrProb(beta, q, n, sigmasq);
    const D = only === 'SKR' ? null : dsdProb(beta, q, n, sigmasq, kind);
    if ((S?.p ?? 0) > 1e-7 || (D?.p ?? 0) > 1e-7) {
      for (let t = 0; t < tours; t++) for (let i = 0; i < 2 * n; i++) {
        if (S) { const p = S.pos[i]; if (p) { avg += beta * rem * p; posSKR[i] += rem * p; pS += rem * p; rem *= 1 - p; } }
        if (D) { const p = D.pos[i]; if (p) { avg += beta * rem * p; posDSD[i] += rem * p; pD += rem * p; rem *= 1 - p; } }
      }
    }
    if (rem < 0.001) { avg += beta * rem; break; }
  }
  return { avgBeta: avg, pSKR: pS, pDSD: pD, posSKR, posDSD };
}

/** DSD 가 먼저일 확률이 ratio 이상이 되는 최소 q (원본과 같은 구간 [n^2.484/e⁶, n^2.484/e⁵] 에서 이분 탐색) */
export function findFatigue(n: number, sigmasq = 2 / 3, kind: NtruKind = 'circulant', tours = 8, ratio = 0.5, lo?: number, hi?: number): number {
  let a = lo ?? Math.floor(Math.pow(n, 2.484) / Math.exp(6)), b = hi ?? Math.floor(Math.pow(n, 2.484) / Math.exp(5));
  const wins = (q: number) => combined(q, n, sigmasq, kind, tours).pDSD >= ratio;
  while (b - a >= 2) { const mid = Math.floor((a + b) / 2); if (wins(mid)) b = mid; else a = mid; }
  return a + 1;
}

/** 구간을 모를 때: q 를 2 배씩 키워 구간을 잡은 뒤 findFatigue 로 이분 탐색 */
export function fatiguePoint(n: number, sigmasq = 2 / 3, kind: NtruKind = 'circulant', tours = 8, ratio = 0.5): number {
  let lo = 2, hi = 4;
  while (combined(hi, n, sigmasq, kind, tours).pDSD < ratio) { lo = hi; hi *= 2; }
  return findFatigue(n, sigmasq, kind, tours, ratio, lo - 1, hi);
}
