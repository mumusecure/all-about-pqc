/**
 * 22장: 동형암호 토이 (교육용, BigInt).  R_q = ℤ_q[x]/(xⁿ+1), n 작음, q ≈ 2⁶⁰ 소수.
 * - BFV: 암호화·덧셈·곱셈(텐서 → t/q 배 반올림 → 재선형화), 잡음 예산
 * - CKKS 식 복호 결과에서 비밀키 복원 (Li–Micciancio 2021) 과 잡음 범람(flooding)
 * - 문턱 복호: 가산 비밀 분산, 부분 복호, smudging 잡음
 * ⚠️ 파라미터가 안전하지 않다(n = 16). 원리를 보기 위한 것.
 */
import { type Rng, mulberry32 } from './lwe';

export type P = bigint[];

/* ------------------------------------------------------------------ 기본 산술 */

export const modq = (x: bigint, q: bigint) => { const r = x % q; return r < 0n ? r + q : r; };
export const cen = (x: bigint, q: bigint) => { const r = modq(x, q); return r > q / 2n ? r - q : r; };
const abs = (x: bigint) => (x < 0n ? -x : x);
export const infNorm = (p: P) => p.reduce((m, x) => (abs(x) > m ? abs(x) : m), 0n);

export function mulZ(a: P, b: P): P {
  const n = a.length, h: P = new Array(n).fill(0n);
  for (let i = 0; i < n; i++) if (a[i] !== 0n) for (let j = 0; j < n; j++) {
    const k = i + j, v = a[i] * b[j];
    if (k < n) h[k] += v; else h[k - n] -= v;
  }
  return h;
}
export const mulq = (a: P, b: P, q: bigint) => mulZ(a, b).map((x) => modq(x, q));
export const addq = (a: P, b: P, q: bigint) => a.map((x, i) => modq(x + b[i], q));
export const subq = (a: P, b: P, q: bigint) => a.map((x, i) => modq(x - b[i], q));

function powmod(b: bigint, e: bigint, m: bigint) { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; }
function isPrime(n: bigint): boolean {
  if (n < 4n) return n >= 2n;
  if (n % 2n === 0n) return false;
  let d = n - 1n, s = 0; while (d % 2n === 0n) { d /= 2n; s++; }
  for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    let x = powmod(a, d, n); if (x === 1n || x === n - 1n) continue;
    let ok = false; for (let r = 1; r < s; r++) { x = (x * x) % n; if (x === n - 1n) { ok = true; break; } }
    if (!ok) return false;
  }
  return true;
}
export function nextPrime(x: bigint) { let p = x | 1n; while (!isPrime(p)) p += 2n; return p; }

const rand64 = (r: Rng) => (BigInt(Math.floor(r() * 2 ** 32)) << 32n) | BigInt(Math.floor(r() * 2 ** 32));
export const uniform = (n: number, q: bigint, r: Rng): P => Array.from({ length: n }, () => rand64(r) % q);
export const ternary = (n: number, r: Rng): P => Array.from({ length: n }, () => BigInt(Math.floor(r() * 3) - 1));
export const smallErr = (n: number, r: Rng, B = 3): P => Array.from({ length: n }, () => BigInt(Math.floor(r() * (2 * B + 1)) - B));
export const uniformBounded = (n: number, B: bigint, r: Rng): P => Array.from({ length: n }, () => (B === 0n ? 0n : (rand64(r) % (2n * B + 1n)) - B));

/** R_q 에서 a 의 역원 (곱셈 행렬을 가우스 소거, q 소수). 없으면 null */
export function invq(a: P, q: bigint): P | null {
  const n = a.length;
  const cols: P[] = []; let cur = a.map((x) => modq(x, q));
  for (let j = 0; j < n; j++) { cols.push(cur); cur = [modq(-cur[n - 1], q), ...cur.slice(0, n - 1)]; }
  const M = Array.from({ length: n }, (_, i) => [...cols.map((c) => c[i]), i === 0 ? 1n : 0n]);
  for (let c = 0; c < n; c++) {
    const p = M.findIndex((row, i) => i >= c && row[c] !== 0n); if (p < 0) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const iv = powmod(M[c][c], q - 2n, q); M[c] = M[c].map((v) => (v * iv) % q);
    for (let i = 0; i < n; i++) if (i !== c && M[i][c] !== 0n) { const f = M[i][c]; M[i] = M[i].map((v, j) => modq(v - f * M[c][j], q)); }
  }
  return M.map((row) => row[n]);
}

/* ------------------------------------------------------------------ BFV */

export interface BFVParams { n: number; q: bigint; t: bigint; logw: number; }
export const BFV_DEFAULT: BFVParams = { n: 16, q: nextPrime(1n << 60n), t: 17n, logw: 10 };
export interface BFVKeys { P: BFVParams; s: P; pk: [P, P]; rlk: [P, P][]; }
export interface CT { c0: P; c1: P; m: bigint[]; }       // m: 기대 평문(검증용, 비밀 아님 — 교육용 추적)

export function bfvKeyGen(Pm: BFVParams, seed: number): BFVKeys {
  const r = mulberry32(seed), { n, q } = Pm;
  const s = ternary(n, r), a = uniform(n, q, r), e = smallErr(n, r);
  const pk: [P, P] = [subq(new Array(n).fill(0n), addq(mulq(a, s, q), e, q), q), a];
  const s2 = mulq(s, s, q), L = Math.ceil(Number(q.toString(2).length) / Pm.logw), rlk: [P, P][] = [];
  for (let i = 0; i < L; i++) {
    const ai = uniform(n, q, r), ei = smallErr(n, r), wi = 1n << BigInt(i * Pm.logw);
    rlk.push([addq(subq(new Array(n).fill(0n), addq(mulq(ai, s, q), ei, q), q), s2.map((x) => modq(x * wi, q)), q), ai]);
  }
  return { P: Pm, s, pk, rlk };
}
const delta = (Pm: BFVParams) => Pm.q / Pm.t;
const plainMul = (a: bigint[], b: bigint[], t: bigint) => mulZ(a, b).map((x) => modq(x, t));

export function bfvEncrypt(K: BFVKeys, m: bigint[], seed: number): CT {
  const r = mulberry32(seed), { n, q } = K.P;
  const u = ternary(n, r), e1 = smallErr(n, r), e2 = smallErr(n, r), D = delta(K.P);
  return { c0: addq(addq(mulq(K.pk[0], u, q), e1, q), m.map((x) => modq(D * x, q)), q), c1: addq(mulq(K.pk[1], u, q), e2, q), m: m.map((x) => modq(x, K.P.t)) };
}
export const phase = (K: BFVKeys, c: CT) => addq(c.c0, mulq(c.c1, K.s, K.P.q), K.P.q);
export function bfvDecrypt(K: BFVKeys, c: CT): bigint[] {
  const { q, t } = K.P, v = phase(K, c);
  return v.map((x) => modq((2n * t * x + q) / (2n * q), t));
}
/** 잡음 = (c0 + c1 s) − Δ·m (중심), 예산(비트) = log₂(Δ/2) − log₂‖잡음‖∞ */
export function noiseBudget(K: BFVKeys, c: CT) {
  const { q } = K.P, D = delta(K.P);
  const e = phase(K, c).map((x, i) => cen(x - D * c.m[i], q));
  const ne = infNorm(e);
  return { noiseBits: ne === 0n ? 0 : Math.log2(Number(ne)), budget: Math.log2(Number(D / 2n)) - (ne === 0n ? 0 : Math.log2(Number(ne))) };
}
export const bfvAdd = (K: BFVKeys, a: CT, b: CT): CT => ({ c0: addq(a.c0, b.c0, K.P.q), c1: addq(a.c1, b.c1, K.P.q), m: a.m.map((x, i) => modq(x + b.m[i], K.P.t)) });
export const bfvMulPlain = (K: BFVKeys, a: CT, p: bigint[]): CT => ({ c0: mulq(a.c0, p, K.P.q), c1: mulq(a.c1, p, K.P.q), m: plainMul(a.m, p, K.P.t) });

/** ⌈(t/q)·x⌋ (부호 있는 정수) */
const scaleRound = (x: bigint, t: bigint, q: bigint) => { const num = 2n * t * x + (x >= 0n ? q : -q); return num / (2n * q); };

export function bfvMul(K: BFVKeys, a: CT, b: CT): CT {
  const { q, t } = K.P;
  const A0 = a.c0.map((x) => cen(x, q)), A1 = a.c1.map((x) => cen(x, q)), B0 = b.c0.map((x) => cen(x, q)), B1 = b.c1.map((x) => cen(x, q));
  const d0 = mulZ(A0, B0).map((x) => modq(scaleRound(x, t, q), q));
  const d1 = addq(mulZ(A0, B1).map((x) => scaleRound(x, t, q)), mulZ(A1, B0).map((x) => scaleRound(x, t, q)), q);
  const d2 = mulZ(A1, B1).map((x) => modq(scaleRound(x, t, q), q));
  // 재선형화: d2 를 밑 w 로 분해해 rlk 로 (1, s) 아래의 암호문으로 바꾼다
  let c0 = d0, c1 = d1;
  const w = 1n << BigInt(K.P.logw);
  K.rlk.forEach(([r0, r1], i) => {
    const digit = d2.map((x) => (x >> BigInt(i * K.P.logw)) % w);
    c0 = addq(c0, mulq(digit, r0, q), q); c1 = addq(c1, mulq(digit, r1, q), q);
  });
  return { c0, c1, m: plainMul(a.m, b.m, t) };
}

/* ------------------------------------------------------------------ CKKS 식 복호 결과로 키 복원 */

export interface CKKSToy { n: number; q: bigint; logDelta: number; s: P; pk: [P, P]; }
export function ckksKeyGen(n: number, seed: number, logDelta = 20): CKKSToy {
  const r = mulberry32(seed), q = nextPrime(1n << 50n);
  const s = ternary(n, r), a = uniform(n, q, r), e = smallErr(n, r);
  return { n, q, logDelta, s, pk: [subq(new Array(n).fill(0n), addq(mulq(a, s, q), e, q), q), a] };
}
/** 실수 벡터를 Δ 배해 계수로 (슬롯 인코딩은 생략한 계수 인코딩) 암호화 */
export function ckksEncrypt(K: CKKSToy, z: number[], seed: number) {
  const r = mulberry32(seed), D = 2 ** K.logDelta, { n, q } = K;
  const m = z.map((x) => BigInt(Math.round(x * D)));
  const u = ternary(n, r), e1 = smallErr(n, r), e2 = smallErr(n, r);
  return { c0: addq(addq(mulq(K.pk[0], u, q), e1, q), m.map((x) => modq(x, q)), q), c1: addq(mulq(K.pk[1], u, q), e2, q) };
}
/** 복호: (c0 + c1 s)/Δ. flood > 0 이면 출력 전에 [−flood, flood] 의 잡음을 더한다(대책) */
export function ckksDecrypt(K: CKKSToy, c: { c0: P; c1: P }, flood: bigint, seed: number): number[] {
  const r = mulberry32(seed), v = addq(c.c0, mulq(c.c1, K.s, K.q), K.q), f = uniformBounded(K.n, flood, r);
  return v.map((x, i) => Number(cen(x + f[i], K.q)) / 2 ** K.logDelta);
}
/** 공격: 복호 결과 z′ 와 암호문만으로 s = c1⁻¹(round(Δ z′) − c0) */
export function ckksKeyRecovery(K: CKKSToy, c: { c0: P; c1: P }, zPrime: number[]) {
  const mPrime = zPrime.map((x) => modq(BigInt(Math.round(x * 2 ** K.logDelta)), K.q));
  const inv = invq(c.c1, K.q);
  if (!inv) return null;
  const sGuess = mulq(subq(mPrime, c.c0, K.q), inv, K.q).map((x) => cen(x, K.q));
  return { sGuess, correct: sGuess.every((x, i) => x === K.s[i]) };
}

/* ------------------------------------------------------------------ 문턱 복호 */

export interface Threshold { n: number; q: bigint; t: bigint; shares: P[]; pk: [P, P]; }
/** 가산 분산 s = Σ sᵢ, 공통 a 로 bᵢ = −(a sᵢ + eᵢ), b = Σ bᵢ */
export function thresholdKeyGen(parties: number, seed: number, Pm: BFVParams = BFV_DEFAULT): Threshold {
  const r = mulberry32(seed), { n, q, t } = Pm, a = uniform(n, q, r);
  const shares = Array.from({ length: parties }, () => ternary(n, r));
  let b: P = new Array(n).fill(0n);
  shares.forEach((si) => { b = subq(b, addq(mulq(a, si, q), smallErr(n, r), q), q); });
  return { n, q, t, shares, pk: [b, a] };
}
export function thresholdEncrypt(T: Threshold, m: bigint[], seed: number) {
  const r = mulberry32(seed), u = ternary(T.n, r), D = T.q / T.t;
  return { c0: addq(addq(mulq(T.pk[0], u, T.q), smallErr(T.n, r), T.q), m.map((x) => modq(D * x, T.q)), T.q), c1: addq(mulq(T.pk[1], u, T.q), smallErr(T.n, r), T.q) };
}
/** 부분 복호 dᵢ = c1·sᵢ + (smudging 잡음, ‖·‖∞ ≤ B) */
export const partialDecrypt = (T: Threshold, c: { c1: P }, i: number, B: bigint, seed: number) => addq(mulq(c.c1, T.shares[i], T.q), uniformBounded(T.n, B, mulberry32(seed)), T.q);
export function combine(T: Threshold, c: { c0: P }, parts: P[]) {
  let v = c.c0; parts.forEach((d) => (v = addq(v, d, T.q)));
  return v.map((x) => modq((2n * T.t * x + T.q) / (2n * T.q), T.t));
}
/** 부분 복호 하나로 그 참여자의 몫을 복원하려는 시도: s̃ᵢ = c1⁻¹ dᵢ */
export function shareRecovery(T: Threshold, c: { c1: P }, d: P, i: number) {
  const inv = invq(c.c1, T.q); if (!inv) return false;
  const g = mulq(d, inv, T.q).map((x) => cen(x, T.q));
  return g.every((x, k) => x === T.shares[i][k]);
}
