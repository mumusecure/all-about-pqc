/**
 * 토이 NTRU (교육용). 환 R_q = ℤ_q[x]/(xⁿ + 1), q 는 소수, p = 3.
 *
 *  키 생성:  F, g ← {−1,0,1}ⁿ,  f = 1 + 3F (f ≡ 1 mod 3),  h = 3·g·f⁻¹ mod q
 *  암호화:   c = r·h + m mod q          (r ← {−1,0,1}ⁿ, m ∈ {−1,0,1}ⁿ)
 *  복호화:   a = f·c mod q = 3·g·r + f·m (중심 대표값),  m = a mod 3 (중심 대표값)
 *
 * ⚠️ 상수 시간이 아니고 안전한 난수를 쓰지 않으며 파라미터가 작다. 실제 보안에 쓰지 말 것.
 */
import { type Poly, mod, polyMulNegacyclic } from './algebra';
import { type Basis, lll, norm } from './lattice';
import { type Rng, centerMod } from './lwe';

export const ternary = (n: number, rng: Rng): Poly => Array.from({ length: n }, () => Math.floor(rng() * 3) - 1);
export const center = (p: Poly, q: number): Poly => p.map((c) => centerMod(c, q));

/** xⁱ·f 의 계수 (negacyclic 회전: 넘친 계수는 부호가 바뀐다) */
export function rotate(f: Poly, i: number): Poly {
  const n = f.length;
  const out = new Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    const k = j + i;
    const blk = Math.floor(k / n);
    out[k % n] += blk % 2 === 0 ? f[j] : -f[j];
  }
  return out;
}

/** f⁻¹ in ℤ_q[x]/(xⁿ+1) (q 소수): 곱셈 행렬로 선형방정식 f·u = 1 을 mod q 가우스 소거로 푼다. 없으면 null. */
export function polyInverse(f: Poly, q: number): Poly | null {
  const n = f.length;
  // 행렬 M (열 j = xʲ·f 의 계수) 에 대해 M u = e₀
  const cols = Array.from({ length: n }, (_, j) => rotate(f, j).map((c) => mod(c, q)));
  const A = Array.from({ length: n }, (_, i) => [...cols.map((col) => col[i]), i === 0 ? 1 : 0]);
  const inv = (a: number) => {
    let [r0, r1, s0, s1] = [q, mod(a, q), 0, 1];
    while (r1) { const t = Math.floor(r0 / r1); [r0, r1] = [r1, r0 - t * r1]; [s0, s1] = [s1, s0 - t * s1]; }
    return r0 === 1 ? mod(s0, q) : null;
  };
  const mulmod = (a: number, b: number) => Number((BigInt(a) * BigInt(b)) % BigInt(q));
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && A[p][c] === 0) p++;
    if (p === n) return null;
    [A[c], A[p]] = [A[p], A[c]];
    const iv = inv(A[c][c])!;
    A[c] = A[c].map((x) => mulmod(x, iv));
    for (let r = 0; r < n; r++) {
      if (r === c || A[r][c] === 0) continue;
      const fct = A[r][c];
      A[r] = A[r].map((x, j) => mod(x - mulmod(fct, A[c][j]), q));
    }
  }
  return A.map((row) => row[n]);
}

export interface NTRUKey { n: number; q: number; f: Poly; g: Poly; F: Poly; h: Poly; }

export function ntruKeyGen(n: number, q: number, rng: Rng): NTRUKey {
  for (;;) {
    const F = ternary(n, rng), g = ternary(n, rng);
    const f = F.map((c, i) => 3 * c + (i === 0 ? 1 : 0));
    const fi = polyInverse(f, q);
    if (!fi) continue;
    const h = polyMulNegacyclic(g.map((c) => mod(3 * c, q)), fi, q);
    return { n, q, f, g, F, h };
  }
}

export function ntruEncrypt(key: Pick<NTRUKey, 'h' | 'q'>, m: Poly, rng: Rng) {
  const r = ternary(m.length, rng);
  const c = polyMulNegacyclic(r.map((x) => mod(x, key.q)), key.h, key.q).map((x, i) => mod(x + m[i], key.q));
  return { c, r };
}

/** 복호화 중간값 a = f·c mod q (중심 대표값) 와 복호 결과 */
export function ntruDecrypt(key: Pick<NTRUKey, 'f' | 'q'>, c: Poly) {
  const a = center(polyMulNegacyclic(key.f.map((x) => mod(x, key.q)), c, key.q), key.q);
  const m = a.map((x) => centerMod(x, 3));
  return { a, m };
}

/**
 * NTRU 격자 Λ = {(u, v) : v·h′ ≡ u (mod q)},  h′ = h·3⁻¹ = g·f⁻¹.
 * 기저 행: (q·eᵢ, 0) 과 (xⁱ·h′, eᵢ).  비밀 (g, f) 와 그 회전 xⁱ·(g, f) 가 모두 짧은 격자 벡터다.
 */
export function ntruLattice(key: Pick<NTRUKey, 'h' | 'q' | 'n'>): Basis {
  const { n, q } = key;
  const inv3 = polyInverse([3, ...new Array(n - 1).fill(0)], q)!;
  const hp = polyMulNegacyclic(key.h, inv3, q);
  const B: Basis = [];
  for (let i = 0; i < n; i++) B.push([...new Array(n).fill(0).map((_, j) => (i === j ? q : 0)), ...new Array(n).fill(0)]);
  for (let i = 0; i < n; i++) B.push([...rotate(hp, i).map((c) => mod(c, q)), ...new Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))]);
  return B;
}

/** v 가 ±xⁱ·(g, f) 중 하나인가? */
export function isRotationOfKey(v: number[], key: Pick<NTRUKey, 'g' | 'f' | 'n'>): boolean {
  const { n } = key;
  for (let i = 0; i < n; i++) {
    const rg = rotate(key.g, i), rf = rotate(key.f, i);
    const w = [...rg, ...rf];
    if (w.every((x, j) => x === v[j]) || w.every((x, j) => -x === v[j])) return true;
  }
  return false;
}

export interface NTRUAttack {
  dim: number;
  ms: number;
  b1IsKey: boolean;
  /** 축소 기저의 앞 n 개 중 키의 회전인 벡터 수 */
  rotationsInFirstN: number;
  logNorms: number[];
  keyNorm: number;
  gh: number;
}

export function ntruAttack(key: NTRUKey, delta = 0.99): NTRUAttack {
  const B = ntruLattice(key);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { basis } = lll(B, delta);
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  const n = key.n;
  const d = 2 * n;
  return {
    dim: d,
    ms,
    b1IsKey: isRotationOfKey(basis[0], key),
    rotationsInFirstN: basis.slice(0, n).filter((v) => isRotationOfKey(v, key)).length,
    logNorms: basis.map((v) => Math.log2(norm(v))),
    keyNorm: norm([...key.g, ...key.f]),
    gh: Math.sqrt(d / (2 * Math.PI * Math.E)) * Math.sqrt(key.q),
  };
}
