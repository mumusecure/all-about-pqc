/**
 * LWE · Regev 암호 · 임베딩 공격 (교육용 토이 구현).
 *
 * ⚠️ 이 코드는 개념 학습용이다. 상수 시간이 아니고, 안전한 난수 생성기를
 *    쓰지 않으며, 파라미터도 일부러 작게 잡는다. 실제 보안에 사용하지 말 것.
 */
import { type Basis, type Vec, lll, norm } from './lattice';

/* ------------------------------------------------------------------ */
/* 재현 가능한 난수 (시드 고정)                                           */
/* ------------------------------------------------------------------ */

/** mulberry32: 32비트 시드 기반의 작고 빠른 PRNG. 재현성을 위한 것이며 암호학적으로 안전하지 않다. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** 0 이상 q 미만의 균등 정수 */
export const uniformMod = (rng: Rng, q: number): number => Math.floor(rng() * q);

/** 표준정규분포 (Box–Muller) */
export function gaussian(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * 표준편차 sigma 인 연속 가우시안을 반올림한 정수 오차.
 * (이산 가우시안 D_{Z,σ} 의 근사. 실제 표준은 중심 이항분포 등을 쓴다.)
 */
export const roundedGaussian = (rng: Rng, sigma: number): number => Math.round(sigma * gaussian(rng));

/** x mod q 를 [0, q) 로 */
export const mod = (x: number, q: number): number => ((x % q) + q) % q;

/** x mod q 를 중심 대표값 (−q/2, q/2] 로 */
export function centerMod(x: number, q: number): number {
  const r = mod(x, q);
  return r > q / 2 ? r - q : r;
}

/* ------------------------------------------------------------------ */
/* LWE 인스턴스                                                         */
/* ------------------------------------------------------------------ */

export type SecretDist = 'uniform' | 'gaussian';

export interface LWEParams {
  n: number; // 비밀 차원
  m: number; // 샘플 수
  q: number; // 모듈러스
  sigma: number; // 오차 표준편차
  secret?: SecretDist; // 기본값 'gaussian' (짧은 비밀 = 정규형 LWE)
}

export interface LWEInstance {
  params: LWEParams;
  A: number[][]; // m × n, 성분은 Z_q
  s: Vec; // 길이 n
  e: Vec; // 길이 m
  b: Vec; // b = A s + e mod q
}

export function sampleLWE(params: LWEParams, rng: Rng): LWEInstance {
  const { n, m, q, sigma } = params;
  const secret = params.secret ?? 'gaussian';
  const A = Array.from({ length: m }, () => Array.from({ length: n }, () => uniformMod(rng, q)));
  const s = Array.from({ length: n }, () => (secret === 'uniform' ? uniformMod(rng, q) : roundedGaussian(rng, sigma)));
  const e = Array.from({ length: m }, () => roundedGaussian(rng, sigma));
  const b = A.map((row, i) => mod(row.reduce((acc, a, j) => acc + a * s[j], 0) + e[i], q));
  return { params, A, s, e, b };
}

/* ------------------------------------------------------------------ */
/* Regev 공개키 암호 (1비트)                                              */
/* ------------------------------------------------------------------ */

export interface RegevPublicKey {
  A: number[][];
  b: Vec;
  q: number;
}

export function regevKeyGen(params: LWEParams, rng: Rng) {
  const inst = sampleLWE({ ...params, secret: params.secret ?? 'uniform' }, rng);
  const pk: RegevPublicKey = { A: inst.A, b: inst.b, q: params.q };
  return { pk, sk: inst.s, e: inst.e };
}

export interface RegevCiphertext {
  u: Vec; // u = Aᵀ r  (길이 n)
  v: number; // v = bᵀ r + bit·⌊q/2⌋
  r: Vec; // 교육용으로 함께 보관 (실제로는 버린다)
}

/** 무작위 부분집합 r ∈ {0,1}^m 을 골라 1비트를 암호화한다. */
export function regevEncrypt(pk: RegevPublicKey, bit: 0 | 1, rng: Rng): RegevCiphertext {
  const { A, b, q } = pk;
  const m = A.length;
  const n = A[0].length;
  const r = Array.from({ length: m }, () => (rng() < 0.5 ? 0 : 1));
  const u = new Array(n).fill(0);
  let v = 0;
  for (let i = 0; i < m; i++) {
    if (!r[i]) continue;
    for (let j = 0; j < n; j++) u[j] += A[i][j];
    v += b[i];
  }
  return { u: u.map((x) => mod(x, q)), v: mod(v + bit * Math.floor(q / 2), q), r };
}

/** 복호 과정의 중간값 w = v − ⟨u, s⟩ mod q 를 돌려준다. */
export function regevPhase(sk: Vec, ct: RegevCiphertext, q: number): number {
  return mod(ct.v - ct.u.reduce((acc, x, j) => acc + x * sk[j], 0), q);
}

/** w 가 0 근처면 0, q/2 근처면 1. */
export function regevDecrypt(sk: Vec, ct: RegevCiphertext, q: number): 0 | 1 {
  const w = regevPhase(sk, ct, q);
  return Math.abs(centerMod(w, q)) < q / 4 ? 0 : 1;
}

/* ------------------------------------------------------------------ */
/* 임베딩(primal) 공격: LWE → uSVP → LLL                                 */
/* ------------------------------------------------------------------ */

/**
 * 짧은 비밀 LWE 인스턴스 (A, b)로부터 차원 d = m + n + 1 의 격자 기저를 만든다.
 *
 *   [ q·I_m   0     0 ]   ← m 개 행
 *   [ Aᵀ      I_n   0 ]   ← n 개 행
 *   [ bᵀ      0     1 ]   ← 1 개 행
 *
 * 마지막 행 + Σ_j (−s_j)·(Aᵀ의 j번째 행) + (q·I 행들의 정수 결합)
 *   = (b − A s + q z, −s, 1) = (e, −s, 1)
 * 이므로 격자 안에 매우 짧은 벡터 (e, −s, 1)이 숨어 있다.
 */
export function embeddingBasis(inst: Pick<LWEInstance, 'A' | 'b'>, q: number): Basis {
  const m = inst.A.length;
  const n = inst.A[0].length;
  const d = m + n + 1;
  const B: Basis = [];
  for (let i = 0; i < m; i++) {
    const row = new Array(d).fill(0);
    row[i] = q;
    B.push(row);
  }
  for (let j = 0; j < n; j++) {
    const row = new Array(d).fill(0);
    for (let i = 0; i < m; i++) row[i] = inst.A[i][j];
    row[m + j] = 1;
    B.push(row);
  }
  const last = new Array(d).fill(0);
  for (let i = 0; i < m; i++) last[i] = inst.b[i];
  last[d - 1] = 1;
  B.push(last);
  return B;
}

export interface AttackResult {
  success: boolean;
  recovered: Vec | null;
  shortest: Vec;
  targetNorm: number;
  /** Gaussian heuristic 로 예측한 '보통' 최단 벡터 길이 */
  gaussianHeuristic: number;
  dim: number;
  ms: number;
  swaps: number;
}

/** 차원 d, 부피 2^logVol 인 격자의 Gaussian heuristic: sqrt(d / (2πe)) · vol^{1/d} */
export function gaussianHeuristic(d: number, logVol2: number): number {
  return Math.sqrt(d / (2 * Math.PI * Math.E)) * Math.pow(2, logVol2 / d);
}

export function embeddingAttack(inst: LWEInstance): AttackResult {
  const { q } = inst.params;
  const m = inst.A.length;
  const n = inst.A[0].length;
  const B = embeddingBasis(inst, q);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { basis, stats } = lll(B, 0.99);
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  let recovered: Vec | null = null;
  for (const row of basis) {
    const last = row[row.length - 1];
    if (Math.abs(last) !== 1) continue;
    const sign = last; // (e, −s, 1) 또는 (−e, s, −1)
    const cand = row.slice(m, m + n).map((x) => -sign * x);
    // 검증: b − A·cand 가 모든 좌표에서 작으면 성공
    const ok = inst.A.every((r, i) => {
      const resid = centerMod(inst.b[i] - r.reduce((acc, a, j) => acc + a * cand[j], 0), q);
      return Math.abs(resid) <= Math.max(6 * inst.params.sigma, 2);
    });
    if (ok) {
      recovered = cand;
      break;
    }
  }
  const target = [...inst.e, ...inst.s.map((x) => -x), 1];
  const d = m + n + 1;
  return {
    success: recovered !== null && recovered.every((x, i) => x === inst.s[i]),
    recovered,
    shortest: basis[0],
    targetNorm: norm(target),
    gaussianHeuristic: gaussianHeuristic(d, m * Math.log2(q)),
    dim: d,
    ms: t1 - t0,
    swaps: stats.swaps,
  };
}
