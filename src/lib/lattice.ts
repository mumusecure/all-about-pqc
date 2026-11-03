/**
 * 격자 연산 기본 도구 (교육용).
 *
 * - 기저는 "행 벡터" 규약: B[i] 가 i번째 기저 벡터 b_i.
 * - 정수 기저를 가정하며, 정수 연산은 Number(2^53 미만)로 정확하게 수행된다.
 * - Gram-Schmidt 계수는 부동소수점으로 계산한다. 이 교과서의 차원(≤ 80)과
 *   계수 크기(≤ 수천)에서는 충분히 정확하다. 실전 구현(fplll 등)은
 *   정밀도 관리를 훨씬 정교하게 한다(Nguyen–Stehlé L² 알고리즘).
 */

export type Vec = number[];
export type Basis = Vec[];

export const dot = (a: Vec, b: Vec): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
export const norm2 = (a: Vec): number => dot(a, a);
export const norm = (a: Vec): number => Math.sqrt(norm2(a));
export const sub = (a: Vec, b: Vec): Vec => a.map((x, i) => x - b[i]);
export const add = (a: Vec, b: Vec): Vec => a.map((x, i) => x + b[i]);
export const scale = (c: number, a: Vec): Vec => a.map((x) => c * x);
export const cloneBasis = (B: Basis): Basis => B.map((r) => r.slice());

/** 가장 가까운 정수로 반올림 (0.5는 0에서 멀어지는 방향). */
export const roundHalfAway = (x: number): number => (x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5));

export interface GSO {
  /** b*_i : Gram-Schmidt 직교화 벡터 */
  bstar: Basis;
  /** mu[i][j] = <b_i, b*_j> / <b*_j, b*_j>  (j < i) */
  mu: number[][];
  /** Bn[i] = ||b*_i||^2 */
  Bn: number[];
}

/** Gram-Schmidt 직교화 (정규화하지 않음). */
export function gramSchmidt(B: Basis): GSO {
  const n = B.length;
  const bstar: Basis = [];
  const mu: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const Bn: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let v = B[i].slice();
    for (let j = 0; j < i; j++) {
      mu[i][j] = Bn[j] === 0 ? 0 : dot(B[i], bstar[j]) / Bn[j];
      v = sub(v, scale(mu[i][j], bstar[j]));
    }
    mu[i][i] = 1;
    bstar.push(v);
    Bn[i] = norm2(v);
  }
  return { bstar, mu, Bn };
}

/** 격자의 부피(행렬식의 절댓값) = ∏ ||b*_i||. 큰 차원에서는 logVolume 을 쓴다. */
export function volume(B: Basis): number {
  return gramSchmidt(B).Bn.reduce((p, x) => p * Math.sqrt(x), 1);
}

/** log2(vol(L)) */
export function logVolume(B: Basis): number {
  return gramSchmidt(B).Bn.reduce((s, x) => s + 0.5 * Math.log2(x), 0);
}

/** 정사각 정수 행렬의 행렬식 (Bareiss 알고리즘, 정확한 정수 연산; 작은 행렬용). */
export function detInt(M: Basis): number {
  const n = M.length;
  const A = M.map((r) => r.map((x) => BigInt(x)));
  let sign = 1n;
  let prev = 1n;
  for (let k = 0; k < n - 1; k++) {
    if (A[k][k] === 0n) {
      let p = k + 1;
      while (p < n && A[p][k] === 0n) p++;
      if (p === n) return 0;
      [A[k], A[p]] = [A[p], A[k]];
      sign = -sign;
    }
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j < n; j++) {
        A[i][j] = (A[i][j] * A[k][k] - A[i][k] * A[k][j]) / prev;
      }
    }
    prev = A[k][k];
  }
  return Number(sign * A[n - 1][n - 1]);
}

/** 직교성 결함(orthogonality defect) = ∏||b_i|| / vol(L) ≥ 1. 1이면 직교 기저. */
export function orthogonalityDefect(B: Basis): number {
  const prod = B.reduce((p, b) => p * norm(b), 1);
  return prod / volume(B);
}

/** 제곱근 Hermite 인자 δ = (||b_1|| / vol^{1/d})^{1/d}. 축소 품질의 표준 척도. */
export function rootHermiteFactor(B: Basis): number {
  const d = B.length;
  const lv = logVolume(B);
  const lb1 = Math.log2(norm(B[0]));
  return Math.pow(2, (lb1 - lv / d) / d);
}

/* ------------------------------------------------------------------ */
/* 2차원: Lagrange–Gauss 축소                                           */
/* ------------------------------------------------------------------ */

export type GaussStepKind = 'size-reduce' | 'swap' | 'done';
export interface GaussStep {
  kind: GaussStepKind;
  b1: Vec;
  b2: Vec;
  /** size-reduce 단계에서 사용한 정수 m = round(mu) */
  m?: number;
  /** 단계 직전의 mu = <b2,b1>/<b1,b1> */
  mu?: number;
}

/**
 * Lagrange–Gauss 축소의 한 단계를 수행한다.
 * 규칙: (1) |mu| > 1/2 이면 b2 ← b2 − round(mu)·b1,
 *       (2) 아니고 ||b2|| < ||b1|| 이면 교환, (3) 아니면 완료.
 */
export function gaussStep(b1: Vec, b2: Vec): GaussStep {
  const mu = dot(b2, b1) / norm2(b1);
  const m = roundHalfAway(mu);
  if (m !== 0 && Math.abs(mu) > 0.5) {
    return { kind: 'size-reduce', b1, b2: sub(b2, scale(m, b1)), m, mu };
  }
  if (norm2(b2) < norm2(b1)) return { kind: 'swap', b1: b2, b2: b1, mu };
  return { kind: 'done', b1, b2, mu };
}

/** Lagrange–Gauss 축소 전체 과정을 단계별로 기록한다. 결과의 b1 은 최단 벡터. */
export function gaussReduce(b1: Vec, b2: Vec, maxSteps = 1000): GaussStep[] {
  const steps: GaussStep[] = [];
  let x = b1.slice();
  let y = b2.slice();
  if (norm2(y) < norm2(x)) {
    steps.push({ kind: 'swap', b1: y, b2: x });
    [x, y] = [y, x];
  }
  for (let t = 0; t < maxSteps; t++) {
    const s = gaussStep(x, y);
    steps.push(s);
    if (s.kind === 'done') break;
    x = s.b1;
    y = s.b2;
  }
  return steps;
}

/* ------------------------------------------------------------------ */
/* n차원: LLL                                                           */
/* ------------------------------------------------------------------ */

export interface LLLStats {
  swaps: number;
  sizeReductions: number;
  iterations: number;
}
export interface LLLResult {
  basis: Basis;
  stats: LLLStats;
}

/**
 * 교과서형 LLL (Lenstra–Lenstra–Lovász 1982).
 *
 * 출력 기저는 다음 두 조건을 만족한다.
 *  - 크기 축소:  |mu[i][j]| ≤ 1/2  (j < i)
 *  - Lovász 조건: ||b*_k||² ≥ (δ − mu[k][k−1]²) · ||b*_{k−1}||²
 *
 * 교환 시 Gram-Schmidt 정보(mu, Bn)는 표준 갱신 공식(Cohen, Alg. 2.6.3)으로
 * O(n) 시간에 갱신한다. 마지막에 한 번 더 검사해서 부동소수점 오차로 조건이
 * 깨졌으면 처음부터 다시 돌린다.
 */
export function lll(input: Basis, delta = 0.75): LLLResult {
  const first = lllPass(cloneBasis(input), delta);
  if (isLLLReduced(first.basis, delta)) return first;
  const second = lllPass(first.basis, delta);
  second.stats.swaps += first.stats.swaps;
  second.stats.sizeReductions += first.stats.sizeReductions;
  second.stats.iterations += first.stats.iterations;
  return second;
}

function lllPass(B: Basis, delta: number): LLLResult {
  const n = B.length;
  const stats: LLLStats = { swaps: 0, sizeReductions: 0, iterations: 0 };
  if (n <= 1) return { basis: B, stats };

  const { mu, Bn } = gramSchmidt(B);

  const swapUpdate = (k: number) => {
    const m = mu[k][k - 1];
    const Bnew = Bn[k] + m * m * Bn[k - 1];
    mu[k][k - 1] = (m * Bn[k - 1]) / Bnew;
    Bn[k] = (Bn[k - 1] * Bn[k]) / Bnew;
    Bn[k - 1] = Bnew;
    for (let j = 0; j < k - 1; j++) {
      const t = mu[k][j];
      mu[k][j] = mu[k - 1][j];
      mu[k - 1][j] = t;
    }
    for (let i = k + 1; i < n; i++) {
      const t = mu[i][k];
      mu[i][k] = mu[i][k - 1] - m * t;
      mu[i][k - 1] = t + mu[k][k - 1] * mu[i][k];
    }
  };

  let k = 1;
  const maxIter = 2_000_000;
  while (k < n && stats.iterations < maxIter) {
    stats.iterations++;
    // 크기 축소: b_k ← b_k − round(mu_kj) b_j  (j = k−1, ..., 0)
    for (let j = k - 1; j >= 0; j--) {
      const q = roundHalfAway(mu[k][j]);
      if (q !== 0) {
        stats.sizeReductions++;
        for (let t = 0; t < B[k].length; t++) B[k][t] -= q * B[j][t];
        for (let i = 0; i < j; i++) mu[k][i] -= q * mu[j][i];
        mu[k][j] -= q;
      }
    }
    // Lovász 조건 검사
    if (Bn[k] >= (delta - mu[k][k - 1] * mu[k][k - 1]) * Bn[k - 1]) {
      k++;
    } else {
      [B[k], B[k - 1]] = [B[k - 1], B[k]];
      stats.swaps++;
      swapUpdate(k);
      k = Math.max(k - 1, 1);
    }
  }
  return { basis: B, stats };
}

/** 기저가 (δ에 대해) LLL-축소되어 있는지 검사한다. 테스트와 위젯에서 사용. */
export function isLLLReduced(B: Basis, delta = 0.75, eps = 1e-9): boolean {
  const { mu, Bn } = gramSchmidt(B);
  for (let i = 1; i < B.length; i++) {
    for (let j = 0; j < i; j++) if (Math.abs(mu[i][j]) > 0.5 + eps) return false;
    if (Bn[i] < (delta - mu[i][i - 1] ** 2) * Bn[i - 1] - eps * Math.max(1, Bn[i - 1])) return false;
  }
  return true;
}

/** log2 ||b*_i|| 프로파일 (축소 품질을 그림으로 볼 때 쓰는 표준 도구). */
export function gsoLogProfile(B: Basis): number[] {
  return gramSchmidt(B).Bn.map((x) => 0.5 * Math.log2(x));
}
