/**
 * Kirchner–Fouque 식 밀집 부분격자 공격의 성공 조건 (Lee–Wallet, ePrint 2020/230, 식 (3.2)).
 *
 *   (k / 2πe)^{k/2} · q^k  ≥  δ^{k(3k−1)} · (n/2)^n
 *
 * 모든 값은 log₂ 로 다룬다. 반환값 margin ≥ 0 이면 (휴리스틱) 충분조건이 성립.
 */
export function margin32(n: number, log2q: number, k: number, delta: number): number {
  const lhs = (k / 2) * Math.log2(k / (2 * Math.PI * Math.E)) + k * log2q;
  const rhs = k * (3 * k - 1) * Math.log2(delta) + n * Math.log2(n / 2);
  return lhs - rhs;
}

/** GSA 에서 쓰는 BKZ-β 의 근 Hermite 인자 근사식 δ_β = ((β/2πe)(πβ)^{1/β})^{1/(2(β−1))} */
export const deltaBKZ = (beta: number): number =>
  Math.pow((beta / (2 * Math.PI * Math.E)) * Math.pow(Math.PI * beta, 1 / beta), 1 / (2 * (beta - 1)));

/** 조건을 만족하는 k 의 범위 [kmin, kmax] (1 ≤ k ≤ n), 없으면 null */
export function kRange(n: number, log2q: number, delta: number): [number, number] | null {
  let lo = -1, hi = -1;
  for (let k = 2; k <= n; k++) {
    if (margin32(n, log2q, k, delta) >= 0) {
      if (lo < 0) lo = k;
      hi = k;
    }
  }
  return lo < 0 ? null : [lo, hi];
}
