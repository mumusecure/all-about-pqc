/**
 * 13장: 모듈 격자 축소의 재료 (교육용). R = ℤ[x]/(xⁿ+1), K = ℚ(ζ_{2n}).
 * - 정규 임베딩, 켤레(x ↦ x⁻¹), 원분 단원 u_a = 1 + x + … + x^{a−1} (a 홀수)
 * - 계수 반올림 오차의 노름: "R 이 반올림으로 유클리드처럼 행동하는가"
 * - 랭크 2 모듈의 가우스 축소를 R 위에서 (Napias 식)
 * - 이데알 격자와 회전을 쓰는 Gauss sieve
 */
import { type C, cabs, embed } from './numfield';
import { type Rng, mulberry32 } from './lwe';
import { type Basis, lll } from './lattice';

export type Poly = number[];

export function negamul(f: Poly, g: Poly): Poly {
  const n = f.length, h = new Array(n).fill(0);
  for (let i = 0; i < n; i++) if (f[i]) for (let j = 0; j < n; j++) {
    const k = i + j;
    if (k < n) h[k] += f[i] * g[j]; else h[k - n] -= f[i] * g[j];
  }
  return h;
}
/** 켤레 x ↦ x⁻¹ = −x^{n−1}: 정규 임베딩에서 복소켤레 */
export const conj = (a: Poly): Poly => a.map((_, i) => (i === 0 ? a[0] : -a[a.length - i]));
export const addP = (a: Poly, b: Poly) => a.map((x, i) => x + b[i]);
export const subP = (a: Poly, b: Poly) => a.map((x, i) => x - b[i]);
const cdiv = (a: C, b: C): C => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };

/** 임베딩 값에서 계수로 (역변환; 실수 계수) */
export function fromEmbedding(e: C[]): number[] {
  const n = e.length;
  return Array.from({ length: n }, (_, i) => {
    let s = 0;
    for (let j = 0; j < n; j++) {
      const th = (-Math.PI * (2 * j + 1) * i) / n;
      s += e[j][0] * Math.cos(th) - e[j][1] * Math.sin(th);
    }
    return s / n;
  });
}

/** 원분 단원 u_a = (ζ^a − 1)/(ζ − 1) = 1 + x + … + x^{a−1}  (a 홀수) */
export const cycloUnit = (n: number, a: number): Poly => Array.from({ length: n }, (_, i) => (i < a ? 1 : 0));

/** log₂|σ_j(f)|, 켤레 쌍 중 하나씩 (j < n/2) */
export const logProfile = (f: Poly) => embed(f).slice(0, Math.max(1, f.length / 2)).map((z) => Math.log2(cabs(z)));
export const log2AbsNorm = (f: Poly) => embed(f).reduce((s, z) => s + Math.log2(cabs(z)), 0);
export const l2 = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

/** f·u^e (e 는 음수 가능, 임베딩 영역에서 계산 후 정수로 반올림) */
export function timesUnitPower(f: Poly, u: Poly, e: number): Poly {
  const ef = embed(f), eu = embed(u);
  const out = ef.map((z, j) => {
    let w: C = [1, 0];
    const base: C = e >= 0 ? eu[j] : cdiv([1, 0], eu[j]);
    for (let t = 0; t < Math.abs(e); t++) w = [w[0] * base[0] - w[1] * base[1], w[0] * base[1] + w[1] * base[0]];
    return [z[0] * w[0] - z[1] * w[1], z[0] * w[1] + z[1] * w[0]] as C;
  });
  return fromEmbedding(out).map(Math.round);
}

/* ------------------------------------------------------------------ 반올림과 노름 */

/** 무작위 μ ∈ K 를 계수마다 반올림한 오차 e 의 |N(e)| 통계 */
export function roundingNormStats(n: number, trials: number, rng: Rng) {
  let below = 0;
  const logs: number[] = [];
  for (let t = 0; t < trials; t++) {
    const e = Array.from({ length: n }, () => rng() - 0.5);
    const ln = n === 1 ? Math.log2(Math.abs(e[0])) : log2AbsNorm(e);
    logs.push(ln);
    if (ln < 0) below++;
  }
  logs.sort((a, b) => a - b);
  return { frac: below / trials, median: logs[Math.floor(trials / 2)] };
}

/* ------------------------------------------------------------------ 모듈 가우스 축소 */

export type MVec = [Poly, Poly];
/** 에르미트 내적 ⟨u, v⟩ = u₁·v̄₁ + u₂·v̄₂ ∈ R */
export const herm = (u: MVec, v: MVec): Poly => addP(negamul(u[0], conj(v[0])), negamul(u[1], conj(v[1])));
/** 유클리드 길이² = Tr⟨v, v⟩ / n · n … 정규 임베딩 기준으로는 Σ_j |σ_j|². 여기서는 계수 길이² 로 (xⁿ+1 은 n 배 차이뿐) */
export const len2 = (v: MVec) => v[0].reduce((s, x) => s + x * x, 0) + v[1].reduce((s, x) => s + x * x, 0);
/** 대수적 크기: log₂ N(⟨v, v⟩) */
export const logNormSize = (v: MVec) => log2AbsNorm(herm(v, v));

export interface GaussRun { steps: number; stalled: boolean; out: MVec[]; firstLen: number; }

/**
 * R 위의 가우스 축소: μ = ⟨b₂, b₁⟩ / ⟨b₁, b₁⟩ ∈ K 를 계수마다 반올림해 b₂ ← b₂ − ⌊μ⌉ b₁,
 * 대수적 크기 N⟨·,·⟩ 가 줄면 교환. 크기가 더 이상 줄지 않으면 멈춘다(stalled = 아직 짧은 벡터가 아닌데 멈춤).
 */
export function moduleGauss(b1: MVec, b2: MVec, maxSteps = 200): GaussRun {
  let a: MVec = [b1[0].slice(), b1[1].slice()], b: MVec = [b2[0].slice(), b2[1].slice()];
  if (logNormSize(b) < logNormSize(a)) [a, b] = [b, a];
  let steps = 0;
  for (; steps < maxSteps; steps++) {
    const num = embed(herm(b, a)), den = embed(herm(a, a));
    const mu = fromEmbedding(num.map((z, j) => cdiv(z, den[j]))).map(Math.round);
    if (mu.some((x) => x !== 0)) b = [subP(b[0], negamul(mu, a[0])), subP(b[1], negamul(mu, a[1]))];
    if (logNormSize(b) < logNormSize(a) - 1e-9) [a, b] = [b, a];
    else break;
  }
  return { steps, stalled: false, out: [a, b], firstLen: Math.sqrt(Math.min(len2(a), len2(b))) };
}

/** 랭크 2 모듈 R·b₁ + R·b₂ 의 ℤ-기저 (2n 개 벡터, ℤ^{2n}): xⁱ b₁, xⁱ b₂ */
export function zBasis(b1: MVec, b2: MVec): Basis {
  const n = b1[0].length, rows: Basis = [];
  for (const v of [b1, b2]) {
    let p = v[0].slice(), q = v[1].slice();
    for (let i = 0; i < n; i++) {
      rows.push([...p, ...q]);
      p = [-p[n - 1], ...p.slice(0, n - 1)]; q = [-q[n - 1], ...q.slice(0, n - 1)];
    }
  }
  return rows;
}

/**
 * 짧은 기저 (g₁, g₂) (계수 ≤ B) 를 R 위의 유니모듈러 변환으로 '나쁘게' 만든 랭크 2 모듈.
 * b₂ = g₂ + c·g₁, b₁ = g₁ + c′·b₂ (c, c′ 는 계수 ≤ M 인 무작위 다항식).
 */
export function randomModule(n: number, B: number, seed: number, M = 6): [MVec, MVec] {
  const r = mulberry32(seed), rp = (b: number) => Array.from({ length: n }, () => Math.floor(r() * (2 * b + 1)) - b);
  const g1: MVec = [rp(B), rp(B)], g2: MVec = [rp(B), rp(B)];
  const c = rp(M), c2 = rp(M);
  const b2: MVec = [addP(g2[0], negamul(c, g1[0])), addP(g2[1], negamul(c, g1[1]))];
  const b1: MVec = [addP(g1[0], negamul(c2, b2[0])), addP(g1[1], negamul(c2, b2[1]))];
  return [b1, b2];
}

/** 주이데알 gR 의 ℤ-기저 (행 xⁱ g) */
export function principalIdeal(g: Poly): Basis {
  const n = g.length, rows: Basis = [];
  let p = g.slice();
  for (let i = 0; i < n; i++) { rows.push(p.slice()); p = [-p[n - 1], ...p.slice(0, n - 1)]; }
  return rows;
}

/** 같은 격자를 ℤ 위에서 LLL 로 축소한 첫 벡터 길이 (비교용) */
export const lllFirstLen = (b1: MVec, b2: MVec) => l2(lll(zBasis(b1, b2), 0.99).basis[0]);

/* ------------------------------------------------------------------ 이데알 격자와 회전 체 */

/** 소 이데알 (q, x − r) 의 ℤ-기저 (q ≡ 1 mod 2n, rⁿ ≡ −1): 행 q·e₀, 그리고 xⁱ − rⁱ */
export function idealLattice(n: number, q: number, r: number): Basis {
  const B: Basis = [], m = (x: number) => ((x % q) + q) % q;
  let ri = 1;
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(0);
    if (i === 0) row[0] = q; else { row[0] = m(-ri); row[i] = 1; }
    B.push(row);
    ri = m(ri * r);
  }
  return B;
}
export function rootOfMinusOne(n: number, q: number): number | null {
  for (let x = 2; x < q; x++) { let p = 1; for (let i = 0; i < n; i++) p = (p * x) % q; if (p === q - 1) return x; }
  return null;
}
const rotations = (v: number[]) => {
  const n = v.length, out: number[][] = [];
  let p = v.slice();
  for (let i = 0; i < n; i++) { out.push(p, p.map((x) => -x)); p = [-p[n - 1], ...p.slice(0, n - 1)]; }
  return out;
};
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const n2 = (a: number[]) => dot(a, a);

/**
 * Gauss sieve. useRot = true 면 목록의 각 벡터를 그 2n 개 부호 회전 전체로 취급한다(이데알 격자의 대칭).
 * 목록에는 대표 하나만 저장하므로 메모리가 약 1/(2n).
 */
export function idealSieve(B0: Basis, useRot: boolean, maxCollisions: number, seed: number, maxIter = 20000) {
  const B = lll(B0, 0.99).basis, rng = mulberry32(seed);
  let L: number[][] = [];
  const S = B.map((b) => b.slice());
  let coll = 0, it = 0, maxList = 0, comps = 0;
  const expand = (w: number[]) => (useRot ? rotations(w) : [w, w.map((x) => -x)]);
  while (coll < maxCollisions && it < maxIter) {
    it++;
    let v = S.length ? S.pop()! : B.reduce((acc, b) => {
      const u = rng();
      return u < 0.2 ? acc.map((x, i) => x + b[i]) : u < 0.4 ? acc.map((x, i) => x - b[i]) : acc;   // 기저 벡터마다 부호 하나
    }, new Array(B[0].length).fill(0));
    let changed = true;
    while (changed) {
      changed = false;
      for (const w0 of L) for (const w of expand(w0)) {
        comps++;
        const ip = dot(v, w), nw = n2(w);
        if (nw <= n2(v) && 2 * ip > nw) { v = v.map((x, i) => x - w[i]); changed = true; }
      }
    }
    if (n2(v) === 0) { coll++; continue; }
    const keep: number[][] = [];
    for (const w0 of L) {
      let reducible = false;
      for (const w of expand(w0)) { comps++; if (n2(w) > n2(v) && 2 * Math.abs(dot(v, w)) > n2(v)) { reducible = true; break; } }
      if (reducible) S.push(w0); else keep.push(w0);
    }
    keep.push(v);
    L = keep;
    maxList = Math.max(maxList, L.length);
  }
  const best = L.reduce((a, b) => (n2(b) < n2(a) ? b : a), L[0]);
  return { norm: Math.sqrt(n2(best)), best, maxList, iterations: it, comparisons: comps };
}
