/**
 * 18장: LWE 파라미터의 구체적 안전성 추정 (교육용, lattice estimator 의 핵심 모델만).
 *
 * - primal (uSVP): ADPS16 성공 조건  σ√β ≤ δ_β^{2β−d} · vol^{1/d}
 * - dual: 짧은 쌍대 벡터로 구별, 이점 ε = exp(−2π²(ℓσ/q)²), 체 한 번이 2^{0.2075β} 개의 벡터를 준다고 가정
 * - 희소 비밀의 '좌표 버리기' 하이브리드: g 개 좌표가 0 이라고 걸고 n − g 차원에서 primal
 * - 비용 모델: core-SVP 고전 0.292β, 양자 0.265β, 그리고 반복을 넣은 8d·2^{0.292β+16.4}
 */
import { deltaBeta } from './bkz';

export interface LWEParams { n: number; logq: number; sigmaS: number; sigmaE: number; mMax: number; }
export interface AttackResult { beta: number; m: number; d: number; extra?: number; note?: string; }

const lg = Math.log2;

/** primal 조건의 양변 (log₂): 왼쪽 = 숨은 벡터의 사영 길이, 오른쪽 = GSA 에서 ‖b*_{d−β+1}‖ */
export function primalSides(P: LWEParams, m: number, beta: number) {
  const d = m + P.n + 1, nu = P.sigmaE / P.sigmaS;
  const lv = m * P.logq + P.n * lg(nu);
  return { d, lhs: lg(P.sigmaE * Math.sqrt(beta)), rhs: (2 * beta - d) * lg(deltaBeta(beta)) + lv / d, logVolPerDim: lv / d };
}

/** 표본 수 m 을 최적화한 primal uSVP 의 최소 β (β ≥ 50 에서만 탐색) */
export function primalUSVP(P: LWEParams, step = 8): AttackResult | null {
  let best: AttackResult | null = null;
  for (let m = Math.max(8, Math.floor(P.n / 8)); m <= P.mMax; m += step) {
    const d = m + P.n + 1;
    for (let beta = 50; beta <= d; beta++) {
      const s = primalSides(P, m, beta);
      if (s.lhs <= s.rhs) { if (!best || beta < best.beta) best = { beta, m, d }; break; }
    }
  }
  return best;
}

/** dual: 비용(log₂) = 0.292β + log₂(필요한 반복), 반복 = max(1, 1/(ε²·2^{0.2075β})) */
export function dualAttack(P: LWEParams, step = 8): (AttackResult & { cost: number; log2eps: number }) | null {
  let best: (AttackResult & { cost: number; log2eps: number }) | null = null;
  const c = P.sigmaS / P.sigmaE;
  for (let m = Math.max(8, Math.floor(P.n / 8)); m <= P.mMax; m += step) {
    const d = m + P.n, lv = P.n * P.logq + P.n * lg(c);
    for (let beta = 50; beta <= d; beta++) {
      const logl = d * lg(deltaBeta(beta)) + lv / d;
      const x = P.sigmaE * 2 ** logl / 2 ** P.logq;
      const log2eps = (-2 * Math.PI * Math.PI * x * x) / Math.LN2;
      const reps = Math.max(0, -2 * log2eps - 0.2075 * beta);
      const cost = 0.292 * beta + reps;
      if (!best || cost < best.cost) best = { beta, m, d, cost, log2eps, extra: reps };
    }
  }
  return best;
}

/** log₂ C(a, b) */
const log2Binom = (a: number, b: number) => (lgamma(a + 1) - lgamma(b + 1) - lgamma(a - b + 1)) / Math.LN2;
function lgamma(x: number): number {
  // Lanczos (g = 7)
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * 해밍 무게 h 인 희소 삼진 비밀: g 개 좌표를 골라 '전부 0' 이라고 걸고(확률 p = C(n−h, g)/C(n, g)),
 * 나머지 n − g 차원에서 primal. 기대 비용 = 0.292β(n−g) − log₂ p.
 */
export function dropHybrid(n: number, h: number, logq: number, sigmaE: number, g: number, mMax: number, step = 16) {
  const nn = n - g;
  if (h > nn) return null;
  const logp = log2Binom(n - h, g) - log2Binom(n, g);
  const r = primalUSVP({ n: nn, logq, sigmaS: Math.sqrt(h / nn), sigmaE, mMax }, step);
  if (!r) return null;
  return { g, beta: r.beta, guess: -logp, cost: 0.292 * r.beta - logp };
}

export const costModels = (beta: number, d: number) => ({
  classical: 0.292 * beta,
  quantum: 0.265 * beta,
  withTours: 0.292 * beta + 16.4 + lg(8 * d),
});

export const sigmaCBD = (eta: number) => Math.sqrt(eta / 2);
export const sigmaTernary = Math.sqrt(2 / 3);

export const PRESETS: Record<string, LWEParams & { label: string }> = {
  'ML-KEM-512': { label: 'ML-KEM-512 (키 복구, n = 512)', n: 512, logq: Math.log2(3329), sigmaS: sigmaCBD(3), sigmaE: sigmaCBD(3), mMax: 512 },
  'ML-KEM-768': { label: 'ML-KEM-768 (n = 768)', n: 768, logq: Math.log2(3329), sigmaS: sigmaCBD(2), sigmaE: sigmaCBD(2), mMax: 768 },
  'ML-KEM-1024': { label: 'ML-KEM-1024 (n = 1024)', n: 1024, logq: Math.log2(3329), sigmaS: sigmaCBD(2), sigmaE: sigmaCBD(2), mMax: 1024 },
  'HE-1024': { label: '동형암호식 (n = 1024, q = 2²⁷, 삼진 비밀, σ = 3.2)', n: 1024, logq: 27, sigmaS: sigmaTernary, sigmaE: 3.2, mMax: 2048 },
};
