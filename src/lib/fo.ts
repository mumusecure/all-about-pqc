/**
 * 3장: Fujisaki–Okamoto 변환 실험용 토이 구현 (교육용).
 *
 * - 다중 비트 Regev PKE: 공개키 (A, B = AS + E), 암호문 (u = Aᵀr, v = Bᵀr + ⌊q/2⌋·m)
 * - FO-PKE (T 변환): 동전 r 을 G(m) 으로 결정하고, 복호 후 재암호화해 같은지 검사
 * - FO-KEM (암묵적 거부, ML-KEM 과 같은 구조): (K, coins) = G(m ‖ H(pk)), 검사 실패 시 K̄ = J(z ‖ c)
 *
 * ⚠️ 해시는 32비트 토이 해시(암호학적으로 안전하지 않음)이고, 파라미터도 작다.
 */
import { type Rng, centerMod, mod, mulberry32, roundedGaussian, uniformMod } from './lwe';

export const P = { n: 16, m: 64, q: 257, k: 16, sigma: 1.0 };

/** 토이 해시: 32비트 정수 열 → 32비트 (도메인 분리용 태그 포함) */
export function toyHash(tag: number, ...xs: number[]): number {
  let h = (0x811c9dc5 ^ tag) >>> 0;
  for (const x of xs) {
    h = Math.imul(h ^ (x >>> 0), 0x01000193) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = (h ^ (h >>> 12)) >>> 0;
  }
  return h;
}
const TAG = { G: 1, H: 2, J: 3, K: 4 };

export interface PK { A: number[][]; B: number[][]; }
export interface SK { S: number[][]; z: number; }
export interface CT { u: number[]; v: number[]; }

export function keyGen(rng: Rng): { pk: PK; sk: SK } {
  const { n, m, q, k, sigma } = P;
  const A = Array.from({ length: m }, () => Array.from({ length: n }, () => uniformMod(rng, q)));
  const S = Array.from({ length: n }, () => Array.from({ length: k }, () => uniformMod(rng, q)));
  const B = A.map((row) => Array.from({ length: k }, (_, j) => mod(row.reduce((s, a, t) => s + a * S[t][j], 0) + roundedGaussian(rng, sigma), q)));
  return { pk: { A, B }, sk: { S, z: Math.floor(rng() * 2 ** 32) } };
}

/** 동전 seed 로 결정적인 암호화 (seed 가 같으면 같은 암호문) */
export function encrypt(pk: PK, msg: number[], coinSeed: number): CT {
  const { n, m, q, k } = P;
  const rr = mulberry32(coinSeed);
  const r = Array.from({ length: m }, () => (rr() < 0.5 ? 0 : 1));
  const u = new Array(n).fill(0), v = new Array(k).fill(0);
  for (let i = 0; i < m; i++) {
    if (!r[i]) continue;
    for (let j = 0; j < n; j++) u[j] += pk.A[i][j];
    for (let j = 0; j < k; j++) v[j] += pk.B[i][j];
  }
  return { u: u.map((x) => mod(x, q)), v: v.map((x, j) => mod(x + msg[j] * Math.floor(q / 2), q)) };
}

export function decrypt(sk: SK, c: CT): number[] {
  const { q, k, n } = P;
  return Array.from({ length: k }, (_, j) => {
    let w = c.v[j];
    for (let t = 0; t < n; t++) w -= c.u[t] * sk.S[t][j];
    return Math.abs(centerMod(w, q)) < q / 4 ? 0 : 1;
  });
}

const ctEqual = (a: CT, b: CT) => a.u.every((x, i) => x === b.u[i]) && a.v.every((x, i) => x === b.v[i]);
const ctHash = (c: CT) => toyHash(TAG.H, ...c.u, ...c.v);
export const pkHash = (pk: PK) => toyHash(TAG.H, ...pk.A.flat(), ...pk.B.flat());
const bitsToInt = (b: number[]) => b.reduce((s, x, i) => s | (x << i), 0) >>> 0;

/** FO-PKE (T 변환): 동전 = G(m), 복호 시 재암호화 검사. 실패하면 null(⊥). */
export const foEncrypt = (pk: PK, msg: number[]) => encrypt(pk, msg, toyHash(TAG.G, bitsToInt(msg)));
export function foDecrypt(pk: PK, sk: SK, c: CT): number[] | null {
  const m2 = decrypt(sk, c);
  return ctEqual(foEncrypt(pk, m2), c) ? m2 : null;
}

/** FO-KEM (암묵적 거부): ML-KEM 과 같은 모양 */
export function encaps(pk: PK, rng: Rng): { c: CT; K: number; m: number[] } {
  const m = Array.from({ length: P.k }, () => (rng() < 0.5 ? 0 : 1));
  const h = pkHash(pk);
  const K = toyHash(TAG.K, bitsToInt(m), h);
  const coins = toyHash(TAG.G, bitsToInt(m), h);
  return { c: encrypt(pk, m, coins), K, m };
}
export function decaps(pk: PK, sk: SK, c: CT): { K: number; rejected: boolean } {
  const m2 = decrypt(sk, c);
  const h = pkHash(pk);
  const c2 = encrypt(pk, m2, toyHash(TAG.G, bitsToInt(m2), h));
  if (ctEqual(c2, c)) return { K: toyHash(TAG.K, bitsToInt(m2), h), rejected: false };
  return { K: toyHash(TAG.J, sk.z, ctHash(c)), rejected: true };
}

/** 변조: j 번째 메시지 비트를 뒤집는 암호문 (u, v + ⌊q/2⌋·e_j) */
export const maul = (c: CT, j: number): CT => ({ u: c.u.slice(), v: c.v.map((x, i) => (i === j ? mod(x + Math.floor(P.q / 2), P.q) : x)) });
