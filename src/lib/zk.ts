/**
 * 21장: 격자 기반 영지식 증명 (교육용).
 * - Stern 식 3-이동 프로토콜: s ∈ {0,1}^m, 무게 w, A s = t (mod q) 를 안다. 건전성 오차 2/3.
 * - Lyubashevsky 식 Σ-프로토콜 (R_q 위, FS with aborts) 과 되감기 추출: 얻는 것은 (s̄, c̄) 로 A s̄ = c̄ t (완화된 건전성)
 * - 도전 차이 c − c′ 의 가역성 (Lyubashevsky–Seiler 2018)
 * - Johnson–Lindenstrauss 사영 ‖Πw‖² ≈ 128‖w‖² (LNP22 식 근사 노름 증명)
 * ⚠️ 해시는 32비트 토이 해시. 원리를 보기 위한 것.
 */
import { type Rng, mulberry32 } from './lwe';

const md = (x: number, q: number) => ((x % q) + q) % q;
function h32(tag: number, xs: number[]): number {
  let h = (0x811c9dc5 ^ tag) >>> 0;
  for (const x of xs) { h = Math.imul(h ^ (x >>> 0), 0x01000193) >>> 0; h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; }
  return h >>> 0;
}

/* ------------------------------------------------------------------ Stern */

export interface SternInst { m: number; nRows: number; q: number; w: number; A: number[][]; t: number[]; s: number[]; }

export function sternInstance(m: number, nRows: number, q: number, w: number, seed: number): SternInst {
  const r = mulberry32(seed);
  const A = Array.from({ length: nRows }, () => Array.from({ length: m }, () => Math.floor(r() * q)));
  const idx = Array.from({ length: m }, (_, i) => i);
  for (let i = m - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const s = new Array(m).fill(0); idx.slice(0, w).forEach((i) => (s[i] = 1));
  return { m, nRows, q, w, A, s, t: mulVec(A, s, q) };
}
const mulVec = (A: number[][], v: number[], q: number) => A.map((row) => md(row.reduce((a, x, j) => a + x * v[j], 0), q));
const perm = (p: number[], v: number[]) => p.map((i) => v[i]);
function randPerm(m: number, r: Rng) { const p = Array.from({ length: m }, (_, i) => i); for (let i = m - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p; }

export type SternStrategy = 'honest' | 'cheat-weight' | 'cheat-equation';

/**
 * 한 라운드. 정직한 증명자는 늘 통과. 속이는 증명자는 미리 '두 도전에만 답할 수 있는' 가짜 비밀을 준비한다:
 *  cheat-weight  : 무게 w 인 이진 s′ (A s′ ≠ t)  → 도전 1, 3 통과
 *  cheat-equation: A s″ = t 인 임의의 s″ (이진 아님) → 도전 2, 3 통과
 */
/** A s″ ≡ t (mod q) 인 아무 해 (이진이 아님): 뒤쪽 좌표를 무작위로 두고 앞 nRows 좌표를 가우스 소거로 푼다 */
export function solveAny(I: SternInst, r: Rng): number[] | null {
  const { nRows: k, m, q, A, t } = I;
  const x = new Array(m).fill(0);
  for (let j = k; j < m; j++) x[j] = Math.floor(r() * q);
  const rhs = t.map((ti, i) => md(ti - A[i].slice(k).reduce((a, v, j) => a + v * x[k + j], 0), q));
  const M = A.map((row, i) => [...row.slice(0, k), rhs[i]]);
  const inv = (a: number) => { let res = 1, e = q - 2, b = a; while (e) { if (e & 1) res = (res * b) % q; b = (b * b) % q; e >>= 1; } return res; };
  for (let c = 0; c < k; c++) {
    const p = M.findIndex((row, i) => i >= c && row[c] !== 0);
    if (p < 0) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const iv = inv(M[c][c]); M[c] = M[c].map((v) => (v * iv) % q);
    for (let i = 0; i < k; i++) if (i !== c && M[i][c]) { const f = M[i][c]; M[i] = M[i].map((v, j) => md(v - f * M[c][j], q)); }
  }
  for (let i = 0; i < k; i++) x[i] = M[i][k];
  return x;
}

/**
 * 한 라운드. 정직한 증명자는 늘 통과. 비밀을 모르는 증명자는 '두 도전에만 답할 수 있는' 가짜를 준비한다:
 *  cheat-weight  : 무게 w 인 이진 s′ (A s′ ≠ t)      → 도전 1, 3 통과, 2 실패
 *  cheat-equation: A s″ = t 인 이진이 아닌 s″         → 도전 2, 3 통과, 1 실패
 */
export function sternRound(I: SternInst, strat: SternStrategy, r: Rng, ch = 1 + Math.floor(r() * 3)) {
  const { m, q } = I;
  let sec = I.s;
  if (strat === 'cheat-weight') sec = sternInstance(m, I.nRows, q, I.w, Math.floor(r() * 1e9)).s;
  if (strat === 'cheat-equation') sec = solveAny(I, r) ?? I.s;
  const pi = randPerm(m, r), rv = Array.from({ length: m }, () => Math.floor(r() * q));
  const rs = rv.map((x, i) => md(x + sec[i], q));
  const c1 = h32(1, [...pi, ...mulVec(I.A, rv, q)]), c2 = h32(2, perm(pi, rv)), c3 = h32(3, perm(pi, rs));
  let ok: boolean;
  if (ch === 1) {
    const ps = perm(pi, sec), pr = perm(pi, rv);
    const binary = ps.every((x) => x === 0 || x === 1) && ps.reduce((a, b) => a + b, 0) === I.w;
    ok = binary && c2 === h32(2, pr) && c3 === h32(3, pr.map((x, i) => md(x + ps[i], q)));
  } else if (ch === 2) {
    const lhs = mulVec(I.A, rs, q).map((x, i) => md(x - I.t[i], q));
    ok = c1 === h32(1, [...pi, ...lhs]) && c3 === h32(3, perm(pi, rs));
  } else {
    ok = c1 === h32(1, [...pi, ...mulVec(I.A, rv, q)]) && c2 === h32(2, perm(pi, rv));
  }
  return { ch, ok };
}

/** 라운드당 통신량 (비트): 커밋 3 개(각 256) + 응답(순열 시드 256 + 길이 m 벡터 m·log q) 의 대략 */
export const sternRoundBits = (m: number, q: number) => 3 * 256 + 256 + m * Math.ceil(Math.log2(q)) + m;

/* ------------------------------------------------------------------ R_q 위의 Lyubashevsky Σ */

export function negamulq(f: number[], g: number[], q: number): number[] {
  const n = f.length, h = new Array(n).fill(0);
  for (let i = 0; i < n; i++) if (f[i]) for (let j = 0; j < n; j++) {
    const k = i + j, p = f[i] * g[j];
    if (k < n) h[k] = (h[k] + p) % q; else h[k - n] = (h[k - n] - p) % q;
  }
  return h.map((x) => md(x, q));
}
const cen = (x: number, q: number) => { const r = md(x, q); return r > q / 2 ? r - q : r; };
const infn = (v: number[], q: number) => v.reduce((s, x) => Math.max(s, Math.abs(cen(x, q))), 0);

export interface SigmaKey { n: number; q: number; a: number[]; s1: number[]; s2: number[]; t: number[]; }
export function sigmaKey(n: number, q: number, seed: number): SigmaKey {
  const r = mulberry32(seed), tern = () => Array.from({ length: n }, () => Math.floor(r() * 3) - 1);
  const a = Array.from({ length: n }, () => Math.floor(r() * q)), s1 = tern(), s2 = tern();
  const t = negamulq(a, s1.map((x) => md(x, q)), q).map((x, i) => md(x + s2[i], q));
  return { n, q, a, s1, s2, t };
}
export function sparseChallenge(n: number, tau: number, r: Rng): number[] {
  const c = new Array(n).fill(0); let k = 0;
  while (k < tau) { const i = Math.floor(r() * n); if (!c[i]) { c[i] = r() < 0.5 ? 1 : -1; k++; } }
  return c;
}

/**
 * 같은 마스크 y 로 두 도전 c, c′ 에 답하게 한 뒤(되감기) 추출: s̄ = z − z′, c̄ = c − c′.
 * 검증식 a·z₁ + z₂ − c·t = w 두 개를 빼면 a·s̄₁ + s̄₂ = c̄·t.
 */
export function rewindExtract(K: SigmaKey, B: number, tau: number, seed: number) {
  const { n, q } = K, r = mulberry32(seed);
  for (let tries = 0; tries < 200; tries++) {
    const y1 = Array.from({ length: n }, () => Math.floor(r() * (2 * B + 1)) - B), y2 = Array.from({ length: n }, () => Math.floor(r() * (2 * B + 1)) - B);
    const resp = (c: number[]) => {
      const z1 = y1.map((x, i) => x + cen(negamulq(c.map((v) => md(v, q)), K.s1.map((v) => md(v, q)), q)[i], q));
      const z2 = y2.map((x, i) => x + cen(negamulq(c.map((v) => md(v, q)), K.s2.map((v) => md(v, q)), q)[i], q));
      const okk = Math.max(...z1.map(Math.abs), ...z2.map(Math.abs)) <= B - tau;    // 거절 샘플링
      return { z1, z2, okk };
    };
    const c = sparseChallenge(n, tau, r), c2 = sparseChallenge(n, tau, r);
    const A1 = resp(c), A2 = resp(c2);
    if (!A1.okk || !A2.okk || c.every((x, i) => x === c2[i])) continue;
    const sb1 = A1.z1.map((x, i) => x - A2.z1[i]), sb2 = A1.z2.map((x, i) => x - A2.z2[i]);
    const cb = c.map((x, i) => x - c2[i]);
    const lhs = negamulq(K.a, sb1.map((v) => md(v, q)), q).map((x, i) => md(x + sb2[i], q));
    const rhs = negamulq(cb.map((v) => md(v, q)), K.t, q);
    return { sb1, sb2, cb, relationHolds: lhs.every((x, i) => x === rhs[i]), sbInf: Math.max(infn(sb1, q), infn(sb2, q)), guarantee: 2 * (B - tau), tries };
  }
  return null;
}

/* ------------------------------------------------------------------ 가역성 */

/** F_q[x] 의 다항식 최대공약수 차수 (q 소수). 계수는 낮은 차수부터. */
function polyGcdDeg(a0: number[], b0: number[], q: number): number {
  const trim = (p: number[]) => { const r = p.slice(); while (r.length && r[r.length - 1] === 0) r.pop(); return r; };
  let a = trim(a0.map((x) => md(x, q))), b = trim(b0.map((x) => md(x, q)));
  const inv = (x: number) => { let r = 1, e = q - 2, bb = x; while (e) { if (e & 1) r = (r * bb) % q; bb = (bb * bb) % q; e >>= 1; } return r; };
  while (b.length) {
    const ib = inv(b[b.length - 1]);
    while (a.length >= b.length) {
      const f = (a[a.length - 1] * ib) % q, sh = a.length - b.length;
      for (let i = 0; i < b.length; i++) a[sh + i] = md(a[sh + i] - f * b[i], q);
      a = trim(a);
      if (!a.length) break;
    }
    [a, b] = [b, a];
  }
  return a.length - 1;
}
/** c 가 Z_q[x]/(xⁿ+1) 에서 가역인가 ⇔ gcd(c, xⁿ+1) = 1 */
export const isInvertible = (c: number[], q: number) => polyGcdDeg(c, [1, ...new Array(c.length - 1).fill(0), 1], q) === 0;

/** 무작위 도전 쌍의 차이가 비가역일 비율 */
export function nonInvertibleRate(n: number, q: number, tau: number, trials: number, seed: number) {
  const r = mulberry32(seed);
  let bad = 0;
  for (let t = 0; t < trials; t++) {
    const c = sparseChallenge(n, tau, r), c2 = sparseChallenge(n, tau, r);
    if (c.every((x, i) => x === c2[i])) continue;
    if (!isInvertible(c.map((x, i) => x - c2[i]), q)) bad++;
  }
  return bad / trials;
}

/* ------------------------------------------------------------------ JL 사영 */

/** Π ∈ {−1, 0, 1}^{256×m} (Pr = 1/4, 1/2, 1/4) 에 대한 ‖Πw‖² / ‖w‖² 표본 */
export function jlRatios(w: number[], samples: number, seed: number, rows = 256): number[] {
  const r = mulberry32(seed), nw = w.reduce((s, x) => s + x * x, 0), out: number[] = [];
  for (let s = 0; s < samples; s++) {
    let tot = 0;
    for (let i = 0; i < rows; i++) {
      let acc = 0;
      for (let j = 0; j < w.length; j++) { const u = r(); if (u < 0.25) acc += w[j]; else if (u < 0.5) acc -= w[j]; }
      tot += acc * acc;
    }
    out.push(tot / nw);
  }
  return out;
}
