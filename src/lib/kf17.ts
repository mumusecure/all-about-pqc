/**
 * 논문 읽기 4: Kirchner–Fouque (Eurocrypt 2017) 식 밀집 부분격자 공격의 충분조건을 NTRU 에 맞춘 것 (교육용).
 *
 * NTRU 격자 (차원 2n, 부피 qⁿ) 안의 키 부분격자 L_key 는 랭크 n, 부피 ≈ ‖(f, g)‖ⁿ ≈ (2nσ²)^{n/2}.
 * 2k 차원 부분 격자를 BKZ-β 로 축소했을 때, (i) Pataki–Tural + GSA 로 첫 벡터의 상한, (ii) L_key 밖 벡터의
 * 사영 격자 Gaussian heuristic 하한을 비교해 얻는 조건 (논문 읽기 1 의 식 (3.2) 와 같은 꼴):
 *
 *   (k / 2πe)^{k/2} · q^k  ≥  δ_β^{k(3k−1)} · Vol(L_key)²
 *
 * 모든 값은 log₂. 이 조건은 '충분조건'이라 실제 경계보다 보수적이다.
 */
import { deltaBeta } from './bkz';
import { usvpBetaNTRU } from './ntruattack';

const lg = Math.log2;

/** 조건의 여유 (log₂). log2Vol2 = log₂ Vol(L_key)² */
export function marginKF(log2q: number, k: number, delta: number, log2Vol2: number) {
  return (k / 2) * lg(k / (2 * Math.PI * Math.E)) + k * log2q - k * (3 * k - 1) * lg(delta) - log2Vol2;
}

/** 키 계수 표준편차 σ 인 NTRU 의 log₂ Vol(L_key)² ≈ n·log₂(2nσ²) */
export const log2VolKey2 = (n: number, sigma: number) => n * lg(2 * n * sigma * sigma);

/** δ 가 주어질 때 k (2 ≤ k ≤ n) 에 대한 최대 여유와 그 k. 거친 격자로 훑은 뒤 주변을 정밀하게 본다 */
export function bestK(n: number, log2q: number, delta: number, log2Vol2: number) {
  const step = Math.max(1, Math.floor(n / 64));
  let best = { k: 2, m: -Infinity };
  for (let k = 2; k <= n; k += step) { const m = marginKF(log2q, k, delta, log2Vol2); if (m > best.m) best = { k, m }; }
  for (let k = Math.max(2, best.k - step); k <= Math.min(n, best.k + step); k++) { const m = marginKF(log2q, k, delta, log2Vol2); if (m > best.m) best = { k, m }; }
  return best;
}

/**
 * 어떤 k ≤ n 에서든 조건이 성립하는 최소 β (β ≥ 50, 없으면 null). 여유는 β 에 대해 단조라 이분 탐색.
 * 반환하는 k 는 그 β 에서 조건이 성립하는 **가장 작은** k (부분 차원 2k 가 작을수록 축소가 싸다), kMax 는 가장 큰 k.
 */
export function betaKF(n: number, log2q: number, sigma: number, betaMax = 2 * n) {
  const v2 = log2VolKey2(n, sigma);
  const ok = (b: number) => bestK(n, log2q, deltaBeta(b), v2).m >= 0;
  if (!ok(betaMax)) return null;
  let beta = 50;
  if (!ok(50)) {
    let lo = 50, hi = betaMax;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ok(mid)) hi = mid; else lo = mid; }
    beta = hi;
  }
  const d = deltaBeta(beta);
  let k = 0, kMax = 0;
  for (let j = 2; j <= n; j++) if (marginKF(log2q, j, d, v2) >= 0) { if (!k) k = j; kMax = j; }
  return { beta, k, kMax };
}

/** uSVP 와 KF 충분조건이 같은 β 를 주는 최소 log₂ q (0.1 간격) */
export function crossingLog2q(n: number, sigma: number, lo = 8, hi = 60) {
  for (let lq = lo; lq <= hi; lq += 0.1) {
    const u = usvpBetaNTRU(n, lq, sigma), k = betaKF(n, lq, sigma);
    if (u && k && k.beta <= u) return Math.round(lq * 10) / 10;
  }
  return null;
}
