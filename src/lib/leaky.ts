/**
 * 논문 읽기 3: 부가 정보(힌트)가 있는 LWE 의 primal 추정 (교육용 단순화).
 *
 * Dachman-Soled–Ducas–Gong–Rossi (Crypto 2020) 의 DBDD 틀에서, 힌트가 비밀의 **한 좌표**에 대한 것일 때만 다룬다.
 *   - 완전 힌트  s_i = l          → 그 좌표를 지운다 (차원 −1)
 *   - 모듈러 힌트 s_i ≡ l (mod k) → s_i = l + k·t 로 바꾸면 미지수 t 의 표준편차가 σ/k (가우시안 근사)
 *   - 근사 힌트  s_i + e_h = l, e_h ~ N(0, σ_h²) → 사후 분산 σ²σ_h² / (σ² + σ_h²)
 * 좌표마다 표준편차가 다른 비밀에 대해 18장의 ADPS16 조건  σ_e√β ≤ δ^{2β−d} · vol^{1/d}  를 쓴다.
 * (비밀 좌표 i 를 σ_e/σ_i 배로 늘려 모든 좌표의 표준편차를 σ_e 로 맞춘 격자의 부피)
 */
import { deltaBeta } from './bkz';

const lg = Math.log2;

/** 비밀 좌표의 표준편차 목록을 (값, 개수) 묶음으로 받아 최소 β 와 m 을 찾는다 */
export function primalHet(groups: { sigma: number; count: number }[], logq: number, sigmaE: number, mMax: number, step = 8) {
  const g = groups.filter((x) => x.count > 0 && x.sigma > 0);
  const n = g.reduce((s, x) => s + x.count, 0);
  const scale = g.reduce((s, x) => s + x.count * lg(sigmaE / x.sigma), 0);
  let best: { beta: number; m: number; d: number } | null = null;
  for (let m = Math.max(8, Math.floor(n / 8)); m <= mMax; m += step) {
    const d = m + n + 1, lv = m * logq + scale;
    for (let beta = 40; beta <= d; beta++) {
      if (lg(sigmaE * Math.sqrt(beta)) <= (2 * beta - d) * lg(deltaBeta(beta)) + lv / d) { if (!best || beta < best.beta) best = { beta, m, d }; break; }
    }
  }
  return best;
}

export interface Hints { perfect: number; modular: number; modK: number; approx: number; sigmaH: number; }

/** n 개 비밀 좌표(표준편차 σ_s) 중 서로 다른 좌표들에 힌트를 준다. 남은 좌표는 그대로. */
export function hintedGroups(n: number, sigmaS: number, h: Hints) {
  const perfect = Math.min(h.perfect, n), modular = Math.min(h.modular, n - perfect), approx = Math.min(h.approx, n - perfect - modular);
  const plain = n - perfect - modular - approx;
  return [
    { sigma: sigmaS, count: plain },
    { sigma: sigmaS / h.modK, count: modular },
    { sigma: Math.sqrt((sigmaS * sigmaS * h.sigmaH * h.sigmaH) / (sigmaS * sigmaS + h.sigmaH * h.sigmaH)), count: approx },
  ];
}

export function leakyBeta(n: number, logq: number, sigmaS: number, sigmaE: number, mMax: number, h: Hints, step = 8) {
  return primalHet(hintedGroups(n, sigmaS, h), logq, sigmaE, mMax, step);
}
