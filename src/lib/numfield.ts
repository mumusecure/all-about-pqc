/**
 * 11장: 수체와 임베딩 (교육용).
 * K = ℚ(ζ_{2n}) = ℚ[x]/(xⁿ+1), n 은 2의 거듭제곱. 정수환 O_K = ℤ[x]/(xⁿ+1).
 */
export type C = [number, number]; // 복소수 (re, im)
export const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
export const cabs = (a: C): number => Math.hypot(a[0], a[1]);

/** xⁿ + 1 의 근 ζ^{2j+1} (ζ = e^{iπ/n}), j = 0..n−1 */
export const roots = (n: number): C[] => Array.from({ length: n }, (_, j) => [Math.cos((Math.PI * (2 * j + 1)) / n), Math.sin((Math.PI * (2 * j + 1)) / n)]);

/** 정규(canonical) 임베딩 σ(a) = (a(ω_j))_j */
export function embed(a: number[]): C[] {
  return roots(a.length).map((w) => {
    let acc: C = [0, 0];
    for (let i = a.length - 1; i >= 0; i--) acc = cadd(cmul(acc, w), [a[i], 0]);
    return acc;
  });
}

/** 체 노름 N(a) = ∏ σ_j(a)  (실수, 실제로는 정수) */
export function fieldNorm(a: number[]): number {
  const p = embed(a).reduce<C>((acc, z) => cmul(acc, z), [1, 0]);
  return p[0];
}

/** 대각합 Tr(a) = Σ σ_j(a) = n·a₀ (xⁿ+1 의 경우) */
export const trace = (a: number[]): number => embed(a).reduce((s, z) => s + z[0], 0);

/** 갈루아 자기동형 σ_k : x ↦ x^k (k 홀수) 를 계수에 적용 */
export function galois(a: number[], k: number): number[] {
  const n = a.length;
  const out = new Array(n).fill(0);
  a.forEach((c, i) => {
    const e = (i * k) % (2 * n);
    if (e < n) out[e] += c;
    else out[e - n] -= c;
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* 2차 수체의 이데알 격자 (위젯용)                                         */
/* ℚ(√−d): 원소 x + y√−d ↦ ℝ² 의 점 (x, y√d)  (복소 임베딩의 실부·허부)        */
/* ------------------------------------------------------------------ */

export interface QuadIdeal { label: string; d: number; basis: [number, number][]; norm: number; principal: string | null; note: string; }

/** ℤ-기저 (x + y√−d 의 (x, y) 쌍) → 평면 벡터 */
export const quadVec = (d: number, [x, y]: [number, number]): [number, number] => [x, y * Math.sqrt(d)];

export const quadIdeals: QuadIdeal[] = [
  { label: 'ℤ[i] 의 이데알 (2 + i)', d: 1, basis: [[2, 1], [-1, 2]], norm: 5, principal: '2 + i', note: 'ℤ[i] 는 모든 이데알이 주이데알(PID). 생성원 α 와 iα 가 정사각형 격자를 만든다.' },
  { label: 'ℤ[i] 의 이데알 (3)', d: 1, basis: [[3, 0], [0, 3]], norm: 9, principal: '3', note: '3 은 ℤ[i] 에서도 소수(관성). 노름 9 = 3².' },
  { label: 'ℤ[√−5] 의 이데알 (1 + √−5)', d: 5, basis: [[1, 1], [-5, 1]], norm: 6, principal: '1 + √−5', note: '주이데알. 생성원의 노름 1 + 5 = 6 이 이데알의 노름과 같다.' },
  { label: 'ℤ[√−5] 의 이데알 (2, 1 + √−5)', d: 5, basis: [[2, 0], [1, 1]], norm: 2, principal: null, note: '주이데알이 아니다: 노름 2 인 원소 x² + 5y² = 2 가 없다. 6 = 2·3 = (1+√−5)(1−√−5) 의 두 분해가 이데알 수준에서 하나로 합쳐지는 데 이런 이데알이 필요하다.' },
];
