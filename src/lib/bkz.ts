/**
 * 10장: BKZ · 열거 · 체(sieve) (교육용).
 *
 * - enumBlock: Schnorr–Euchner 지그재그 열거로 사영된 블록 격자의 최단 벡터
 * - bkzTour: BKZ 한 바퀴 (블록마다 열거 → 삽입 → LLL)
 * - gaussSieve: Micciancio–Voulgaris 의 Gauss sieve
 * - 비용 모델: δ_β 공식, Gaussian heuristic 으로 예측한 열거 노드 수
 */
import { type Basis, gramSchmidt, lll } from './lattice';
import { type Rng, mulberry32 } from './lwe';
import { logBallVolume } from './prob';

/* ------------------------------------------------------------------ 격자 */

/** q-ary 격자 기저 [[qI_k, 0], [A, I]] (차원 d, k = d/2). 부피 q^k. */
export function qaryLattice(d: number, q: number, seed: number): Basis {
  const k = Math.floor(d / 2), r = mulberry32(seed);
  return Array.from({ length: d }, (_, i) => {
    const row = new Array(d).fill(0);
    if (i < k) row[i] = q;
    else { for (let j = 0; j < k; j++) row[j] = Math.floor(r() * q); row[i] = 1; }
    return row;
  });
}

export const norm2 = (v: number[]) => v.reduce((s, x) => s + x * x, 0);
export const logVolume2 = (B: Basis) => gramSchmidt(B).Bn.reduce((s, x) => s + 0.5 * Math.log2(x), 0);
/** 제곱근 Hermite 인자 δ = (‖b₁‖ / vol^{1/d})^{1/d} */
export const rootHermite = (B: Basis) => Math.pow(Math.sqrt(norm2(B[0])) / Math.pow(2, logVolume2(B) / B.length), 1 / B.length);

/** Gaussian heuristic: λ₁ ≈ vol^{1/d} / V_d(1)^{1/d}  (log₂) */
export const log2GH = (d: number, log2Vol: number) => (log2Vol - logBallVolume(d) / Math.LN2) / d;

/* ------------------------------------------------------------------ 열거 */

export interface EnumResult { x: number[] | null; norm2: number; nodes: number; }

/**
 * 사영 격자 π_k(L(b_k, …, b_{k+d−1})) 에서 제곱 노름이 R2 보다 작은 가장 짧은 벡터의 계수를 찾는다.
 * mu, Bn 은 전체 기저의 GSO. 지그재그 순서: 중심 c 에 가까운 정수부터 r, r±1, r∓1, r±2, …
 */
export function enumBlock(mu: number[][], Bn: number[], k: number, d: number, R2: number, maxNodes = 5e7): EnumResult {
  const x = new Array(d).fill(0), c = new Array(d).fill(0), r = new Array(d).fill(0), t = new Array(d).fill(0), s = new Array(d).fill(1);
  const l = new Array(d + 1).fill(0);
  let best: number[] | null = null, bestR2 = R2, nodes = 0;
  const setLevel = (i: number) => {
    let ci = 0;
    for (let j = i + 1; j < d; j++) ci -= x[j] * mu[k + j][k + i];
    c[i] = ci; r[i] = Math.round(ci); s[i] = ci >= r[i] ? 1 : -1; t[i] = 0; x[i] = r[i];
  };
  const advance = (i: number) => {
    if (l[i + 1] === 0) { x[i] += 1; return; }            // 위가 모두 0 이면 ±v 중복을 피해 한 방향만
    t[i] += 1;
    const step = Math.ceil(t[i] / 2);
    x[i] = r[i] + (t[i] % 2 === 1 ? s[i] * step : -s[i] * step);
  };
  let i = d - 1;
  setLevel(i);
  while (nodes < maxNodes) {
    nodes++;
    const diff = x[i] - c[i];
    l[i] = l[i + 1] + diff * diff * Bn[k + i];
    if (l[i] < bestR2) {
      if (i === 0) {
        if (l[0] > 1e-9) { bestR2 = l[0]; best = x.slice(); }
        advance(0);
      } else { i--; setLevel(i); }
    } else {
      i++;
      if (i === d) break;
      advance(i);
    }
  }
  return { x: best, norm2: bestR2, nodes };
}

/** 계수 x 의 벡터 v = Σ xᵢ b_{k+i} 를 위치 k 에 넣는다. gcd 소거로 기저를 유지(정수 연산만). */
export function insertVector(B: Basis, k: number, x: number[]): Basis {
  const C = B.map((row) => row.slice()), y = x.slice();
  for (;;) {
    const nz = y.map((v, i) => [Math.abs(v), i]).filter(([a]) => a > 0).sort((a, b) => a[0] - b[0]);
    if (nz.length === 1) break;
    const j = nz[0][1];                                       // 절댓값이 가장 작은 계수
    for (const [, i] of nz.slice(1)) {
      const qt = Math.round(y[i] / y[j]);
      if (qt === 0) continue;
      y[i] -= qt * y[j];                                      // x_i b_i + x_j b_j = (x_i − q x_j) b_i + x_j (b_j + q b_i)
      for (let t = 0; t < C[0].length; t++) C[k + j][t] += qt * C[k + i][t];
    }
  }
  const j = y.findIndex((v) => v !== 0);
  if (y[j] < 0) C[k + j] = C[k + j].map((v) => -v);
  const v = C.splice(k + j, 1)[0];
  C.splice(k, 0, v);
  return C;
}

export interface TourStats { insertions: number; nodes: number; }

/** BKZ-β 한 바퀴 (k = 0 … n−2). 입력은 LLL 축소되어 있다고 가정. */
export function bkzTour(input: Basis, beta: number, delta = 0.99): { basis: Basis; stats: TourStats } {
  let B = input.map((r) => r.slice());
  const n = B.length;
  const stats: TourStats = { insertions: 0, nodes: 0 };
  for (let k = 0; k < n - 1; k++) {
    const d = Math.min(beta, n - k);
    const { mu, Bn } = gramSchmidt(B);
    const res = enumBlock(mu, Bn, k, d, delta * Bn[k]);
    stats.nodes += res.nodes;
    if (res.x) {
      B = lll(insertVector(B, k, res.x), delta).basis;
      stats.insertions++;
    }
  }
  return { basis: B, stats };
}

/** BKZ-β (바뀌지 않거나 maxTours 까지) */
export function bkz(input: Basis, beta: number, maxTours = 8, delta = 0.99) {
  let B = lll(input, delta).basis;
  const tours: TourStats[] = [];
  for (let t = 0; t < maxTours; t++) {
    const r = bkzTour(B, beta, delta);
    B = r.basis; tours.push(r.stats);
    if (r.stats.insertions === 0) break;
  }
  return { basis: B, tours };
}

/* ------------------------------------------------------------------ 체 (Gauss sieve) */

export interface SieveResult { shortest: number[]; norm2: number; listSize: number; maxList: number; iterations: number; collisions: number; trace: number[]; }

/** 무작위 격자 벡터: LLL 축소 기저 벡터들의 작은 무작위 결합 (목록으로 줄이는 것은 체가 한다) */
function sampleVector(B: Basis, rng: Rng): number[] {
  const n = B.length, coef = Array.from({ length: n }, () => (rng() < 0.6 ? 0 : rng() < 0.5 ? 1 : -1));
  const v = new Array(B[0].length).fill(0);
  for (let i = 0; i < n; i++) if (coef[i]) for (let t = 0; t < v.length; t++) v[t] += coef[i] * B[i][t];
  return v;
}

const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
const add = (a: number[], b: number[]) => a.map((x, i) => x + b[i]);
const dotv = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

/** v 를 목록 L 의 원소들로 더 이상 줄지 않을 때까지 줄인다 (‖v ± w‖ < ‖v‖) */
function reduceAgainst(v: number[], L: number[][]): number[] {
  let changed = true, nv = norm2(v);
  while (changed) {
    changed = false;
    for (const w of L) {
      const ip = dotv(v, w), nw = norm2(w);
      if (nw <= nv && 2 * Math.abs(ip) > nw) {
        v = ip > 0 ? sub(v, w) : add(v, w);
        nv = norm2(v); changed = true;
      }
    }
  }
  return v;
}

/**
 * Gauss sieve (Micciancio–Voulgaris 2010). 충돌(0 으로 줄어든 표본)이 maxCollisions 번 나면 멈춘다.
 * 목록 L 은 쌍마다 ‖v ± w‖ ≥ max(‖v‖, ‖w‖) 를 만족(서로 60° 이상 떨어짐).
 */
export function gaussSieve(input: Basis, maxCollisions: number, seed: number, maxIter = 200000): SieveResult {
  const B = lll(input, 0.99).basis;
  const rng = mulberry32(seed);
  let L: number[][] = [];
  const S: number[][] = B.map((b) => b.slice());
  let collisions = 0, it = 0, maxList = 0;
  const trace: number[] = [];
  while (collisions < maxCollisions && it < maxIter) {
    it++;
    let v = S.length ? S.pop()! : sampleVector(B, rng);
    v = reduceAgainst(v, L);
    if (norm2(v) === 0) { collisions++; continue; }
    const nv = norm2(v), keep: number[][] = [];
    for (const w of L) {
      const ip = dotv(v, w), nw = norm2(w);
      if (nw > nv && 2 * Math.abs(ip) > nv) S.push(ip > 0 ? sub(w, v) : add(w, v));
      else keep.push(w);
    }
    keep.push(v);
    L = keep;
    maxList = Math.max(maxList, L.length);
    if (it % 20 === 0) trace.push(L.length);
  }
  let best = L[0];
  for (const w of L) if (norm2(w) < norm2(best)) best = w;
  return { shortest: best, norm2: norm2(best), listSize: L.length, maxList, iterations: it, collisions, trace };
}

/* ------------------------------------------------------------------ 비용 모델 */

/** δ_β ≈ ((β/(2πe))·(πβ)^{1/β})^{1/(2(β−1))}  (GSA + 블록마다 Gaussian heuristic, β ≥ 50 에서 잘 맞음) */
export const deltaBeta = (beta: number) => Math.pow((beta / (2 * Math.PI * Math.E)) * Math.pow(Math.PI * beta, 1 / beta), 1 / (2 * (beta - 1)));

/** 실험값 (Gama–Nguyen 2008): 작은 β 에서는 공식 대신 이것을 쓴다 */
export const DELTA_EXPERIMENT: Record<string, number> = { LLL: 1.0219, 'BKZ-20': 1.0128, 'BKZ-28': 1.0109 };

/**
 * GSA 기저(차원 n, 제곱근 Hermite 인자 δ, 부피 1)에서 반지름 R = rf·GH 인 완전 열거의 레벨별 노드 수 (log₂).
 * 레벨 k (아래에서 k 개 좌표를 정한 단계) 의 노드 수 ≈ V_k(R) / ∏_{i=n−k}^{n−1} ‖b_i*‖ / 2.
 */
export function enumLevelsGSA(n: number, delta: number, rf = 1): number[] {
  const lb = (i: number) => (n - 1 - 2 * i) * Math.log2(delta);          // log₂‖b_i*‖, vol = 1
  const logR = Math.log2(rf) + log2GH(n, 0);
  const out: number[] = [];
  let tail = 0;
  for (let k = 1; k <= n; k++) {
    tail += lb(n - k);
    out.push(logBallVolume(k) / Math.LN2 + k * logR - tail - 1);
  }
  return out;
}
export const log2Sum = (xs: number[]) => { const m = Math.max(...xs); return m + Math.log2(xs.reduce((s, x) => s + 2 ** (x - m), 0)); };
