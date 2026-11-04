/**
 * 23장: 동종사상 토이 (교육용, 작은 소수).
 * - F_{p²} = F_p[i]/(i² + 1) (p ≡ 3 mod 4) 와 초특이 2-동종 그래프 (모듈러 다항식 Φ₂ 의 근)
 * - CGL 해시: 비트열로 그래프 위를 되돌아가지 않고 걷기
 * - CSIDH: p = 4·3·5·7 − 1 = 419 위의 몽고메리 곡선 y² = x³ + Ax² + x 와 군 작용 (x-좌표만의 산술)
 */
import { type Rng, mulberry32 } from './lwe';

const md = (x: number, p: number) => ((x % p) + p) % p;
const mulp = (a: number, b: number, p: number) => Number((BigInt(a) * BigInt(b)) % BigInt(p));
export function powp(b: number, e: number, p: number) { let r = 1, x = md(b, p); while (e > 0) { if (e & 1) r = mulp(r, x, p); x = mulp(x, x, p); e = Math.floor(e / 2); } return r; }
export const invp = (a: number, p: number) => powp(a, p - 2, p);

/* ------------------------------------------------------------------ F_{p²} */

export type F2 = [number, number];
const f2 = (p: number) => ({
  add: (a: F2, b: F2): F2 => [md(a[0] + b[0], p), md(a[1] + b[1], p)],
  sub: (a: F2, b: F2): F2 => [md(a[0] - b[0], p), md(a[1] - b[1], p)],
  mul: (a: F2, b: F2): F2 => [md(mulp(a[0], b[0], p) - mulp(a[1], b[1], p), p), md(mulp(a[0], b[1], p) + mulp(a[1], b[0], p), p)],
  c: (k: number): F2 => [md(k, p), 0],
  eq: (a: F2, b: F2) => a[0] === b[0] && a[1] === b[1],
});
export const f2key = (a: F2) => `${a[0]},${a[1]}`;
export const f2str = (a: F2) => (a[1] === 0 ? `${a[0]}` : a[0] === 0 ? `${a[1]}i` : `${a[0]}+${a[1]}i`);

/**
 * Φ₂(X, Y) = X³ + Y³ − X²Y² + 1488(X²Y + XY²) − 162000(X² + Y²) + 40773375·XY
 *            + 8748000000(X + Y) − 157464000000000.   Φ₂(j, j′) = 0 ⇔ j 와 j′ 이 2-동종.
 */
function phi2Coeffs(j: F2, p: number): F2[] {
  const F = f2(p), c = (k: bigint) => F.c(Number(((k % BigInt(p)) + BigInt(p)) % BigInt(p)));
  const j2 = F.mul(j, j), j3 = F.mul(j2, j);
  // Y³ + (−j² + 1488 j − 162000) Y² + (1488 j² + 40773375 j + 8748000000) Y + (j³ − 162000 j² + 8748000000 j − 157464000000000)
  const a2 = F.add(F.sub(F.mul(c(1488n), j), j2), c(-162000n));
  const a1 = F.add(F.add(F.mul(c(1488n), j2), F.mul(c(40773375n), j)), c(8748000000n));
  const a0 = F.add(F.add(F.sub(j3, F.mul(c(162000n), j2)), F.mul(c(8748000000n), j)), c(-157464000000000n));
  return [a0, a1, a2];
}
/** Φ₂(j, Y) 의 F_{p²} 근 (중복도 포함). 작은 p 라 전수조사 */
export function phi2Roots(j: F2, p: number): F2[] {
  const F = f2(p), [a0, a1, a2] = phi2Coeffs(j, p), roots: F2[] = [];
  for (let x = 0; x < p; x++) for (let y = 0; y < p; y++) {
    const Y: F2 = [x, y];
    const v = F.add(F.mul(F.add(F.mul(F.add(Y, a2), Y), a1), Y), a0);
    if (v[0] === 0 && v[1] === 0) {
      // 중복도: f′(Y) = 3Y² + 2a₂Y + a₁, f″ 등
      const d1 = F.add(F.add(F.mul(F.c(3), F.mul(Y, Y)), F.mul(F.c(2), F.mul(a2, Y))), a1);
      const d2 = F.add(F.mul(F.c(6), Y), F.mul(F.c(2), a2));
      const mult = d1[0] || d1[1] ? 1 : d2[0] || d2[1] ? 2 : 3;
      for (let k = 0; k < mult; k++) roots.push(Y);
    }
  }
  return roots;
}

export interface IsoGraph { p: number; nodes: F2[]; adj: number[][]; }
/** j = 1728 (p ≡ 3 mod 4 에서 초특이) 에서 시작해 2-동종 그래프의 연결 성분 전체를 BFS */
export function supersingular2Graph(p: number): IsoGraph {
  const start: F2 = [1728 % p, 0];
  const idx = new Map<string, number>([[f2key(start), 0]]), nodes: F2[] = [start], adj: number[][] = [];
  for (let k = 0; k < nodes.length; k++) {
    const nb = phi2Roots(nodes[k], p);
    adj[k] = nb.map((r) => { const key = f2key(r); if (!idx.has(key)) { idx.set(key, nodes.length); nodes.push(r); } return idx.get(key)!; });
  }
  return { p, nodes, adj };
}
/** 초특이 j-불변량의 개수 ⌊p/12⌋ + ε */
export const supersingularCount = (p: number) => Math.floor(p / 12) + ({ 1: 0, 5: 1, 7: 1, 11: 2 } as Record<number, number>)[p % 12];

/** CGL 해시: 시작 변을 고정하고, 비트마다 되돌아가지 않는 두 이웃 중 하나로 */
export function cglWalk(G: IsoGraph, bits: number[]): number[] {
  const path = [0, G.adj[0][0]];
  for (const b of bits) {
    const cur = path[path.length - 1], prev = path[path.length - 2];
    const opts = G.adj[cur].slice();
    const back = opts.indexOf(prev); if (back >= 0) opts.splice(back, 1);
    path.push(opts[Math.min(b, opts.length - 1)]);
  }
  return path;
}

/* ------------------------------------------------------------------ CSIDH (p = 419) */

export const CSIDH_P = 419;
export const CSIDH_ELLS = [3, 5, 7];
type XZ = [number, number];

function xDBL(P: XZ, A: number, p: number): XZ {
  const [X, Z] = P, s = md(X + Z, p), d = md(X - Z, p), s2 = mulp(s, s, p), d2 = mulp(d, d, p), t = md(s2 - d2, p);
  const a24 = mulp(md(A + 2, p), invp(4, p), p);
  return [mulp(s2, d2, p), mulp(t, md(d2 + mulp(a24, t, p), p), p)];
}
function xADD(P: XZ, Q: XZ, D: XZ, p: number): XZ {
  const u = mulp(md(P[0] - P[1], p), md(Q[0] + Q[1], p), p), v = mulp(md(P[0] + P[1], p), md(Q[0] - Q[1], p), p);
  const sp = md(u + v, p), sm = md(u - v, p);
  return [mulp(D[1], mulp(sp, sp, p), p), mulp(D[0], mulp(sm, sm, p), p)];
}
/** 몽고메리 사다리: [k]P (x-좌표만) */
export function xMUL(P: XZ, k: number, A: number, p: number): XZ {
  if (k === 0) return [1, 0];
  let R0: XZ = P, R1: XZ = xDBL(P, A, p);
  const bits = k.toString(2);
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] === '1') { R0 = xADD(R1, R0, P, p); R1 = xDBL(R1, A, p); }
    else { R1 = xADD(R0, R1, P, p); R0 = xDBL(R0, A, p); }
  }
  return R0;
}
const isSquare = (a: number, p: number) => a === 0 || powp(a, (p - 1) / 2, p) === 1;
const affineX = (P: XZ, p: number) => mulp(P[0], invp(P[1], p), p);

/**
 * 홀수 차수 ℓ = 2d + 1 의 동종사상 (핵 = ⟨R⟩): xᵢ = x([i]R), i = 1..d 에 대해
 * τ = ∏ xᵢ,  σ = Σ (xᵢ − 1/xᵢ),  A′ = τ²(A − 6σ)   (Montgomery 곡선 사이의 Vélu 공식)
 */
export function oddIsogeny(A: number, R: XZ, ell: number, p: number): number {
  const d = (ell - 1) / 2;
  let tau = 1, sigma = 0, cur: XZ = R, prev: XZ = [1, 0];
  for (let i = 1; i <= d; i++) {
    const x = affineX(cur, p);
    tau = mulp(tau, x, p); sigma = md(sigma + x - invp(x, p), p);
    const nxt: XZ = i === 1 ? xDBL(R, A, p) : xADD(cur, R, prev, p);
    prev = cur; cur = nxt;
  }
  return mulp(mulp(tau, tau, p), md(A - 6 * sigma, p), p);
}

/** 이데알 lᵢ^{eᵢ} 들의 작용 (부호 + 는 곡선 위의 점, − 는 꼬임 곡선 위의 점으로 핵을 고름) */
export function csidhAction(A0: number, e: number[], seed = 1, p = CSIDH_P): number {
  const r: Rng = mulberry32(seed), left = e.slice();
  let A = A0, guard = 0;
  while (left.some((x) => x !== 0) && guard++ < 10000) {
    const x = Math.floor(r() * p);
    const rhs = md(mulp(x, md(mulp(x, x, p) + mulp(A, x, p) + 1, p), p), p);
    if (rhs === 0) continue;
    const s = isSquare(rhs, p) ? 1 : -1;
    const i = left.findIndex((v) => v !== 0 && Math.sign(v) === s);
    if (i < 0) continue;
    const ell = CSIDH_ELLS[i];
    const R = xMUL([x, 1], (p + 1) / ell, A, p);
    if (R[1] === 0) continue;                 // 위수가 ℓ 의 배수가 아님
    A = oddIsogeny(A, R, ell, p);
    left[i] -= s;
  }
  return A;
}

/** #E_A(F_p) = Σ_x (1 + (x³+Ax²+x | p)) + 1 */
export function countPoints(A: number, p = CSIDH_P): number {
  let n = 1;
  for (let x = 0; x < p; x++) {
    const rhs = md(mulp(x, md(mulp(x, x, p) + mulp(A, x, p) + 1, p), p), p);
    n += rhs === 0 ? 1 : isSquare(rhs, p) ? 2 : 0;
  }
  return n;
}
export const jInvariant = (A: number, p = CSIDH_P) => { const a2 = mulp(A, A, p); const num = mulp(256, powp(md(a2 - 3, p), 3, p), p); return mulp(num, invp(md(a2 - 4, p), p), p); };

/** A = 0 에서 l₃, l₅, l₇ 과 그 역으로 갈 수 있는 곡선 전부 (군 작용의 궤도) */
export function csidhOrbit(p = CSIDH_P) {
  const idx = new Map<number, number>([[0, 0]]), nodes = [0], edges: { from: number; to: number; ell: number }[] = [];
  for (let k = 0; k < nodes.length; k++) {
    CSIDH_ELLS.forEach((ell, i) => {
      const e = [0, 0, 0]; e[i] = 1;
      const B = csidhAction(nodes[k], e, 7 + k, p);
      if (!idx.has(B)) { idx.set(B, nodes.length); nodes.push(B); }
      edges.push({ from: k, to: idx.get(B)!, ell });
    });
  }
  return { nodes, edges };
}
