import { describe, expect, it } from 'vitest';
import { mod, polyMulNegacyclic, isPrime } from '../src/lib/algebra';
import { mulberry32 } from '../src/lib/lwe';
import { isRotationOfKey, ntruAttack, ntruDecrypt, ntruEncrypt, ntruKeyGen, ntruLattice, polyInverse, rotate, ternary } from '../src/lib/ntru';
import { detInt } from '../src/lib/lattice';

describe('토이 NTRU', () => {
  it('역원: f·f⁻¹ = 1 in ℤ_q[x]/(xⁿ+1)', () => {
    const rng = mulberry32(3);
    for (let t = 0; t < 10; t++) {
      const f = ternary(16, rng);
      const fi = polyInverse(f, 769);
      if (!fi) continue;
      expect(polyMulNegacyclic(f.map((x) => mod(x, 769)), fi, 769)).toEqual([1, ...new Array(15).fill(0)]);
    }
  });
  it('회전 xⁱ·f: n 번 회전하면 부호만 바뀐다', () => {
    expect(rotate([1, 2, 3, 4], 1)).toEqual([-4, 1, 2, 3]);
    expect(rotate([1, 2, 3, 4], 4)).toEqual([-1, -2, -3, -4]);
  });
  it('충분히 큰 q 에서 항상 올바르게 복호된다', () => {
    const rng = mulberry32(11);
    const key = ntruKeyGen(32, 769, rng);
    for (let t = 0; t < 50; t++) {
      const m = ternary(32, rng);
      const { c } = ntruEncrypt(key, m, rng);
      expect(ntruDecrypt(key, c).m).toEqual(m);
    }
  });
  it('q 가 너무 작으면 복호 실패가 생긴다', () => {
    const rng = mulberry32(12);
    const key = ntruKeyGen(64, 97, rng);
    let fail = 0;
    for (let t = 0; t < 30; t++) {
      const m = ternary(64, rng);
      const { c } = ntruEncrypt(key, m, rng);
      if (ntruDecrypt(key, c).m.some((x, i) => x !== m[i])) fail++;
    }
    expect(fail).toBeGreaterThan(10);
  });
});

describe('NTRU 격자', () => {
  it('부피는 qⁿ 이고 비밀 (g, f) 와 그 회전이 격자에 속한다', () => {
    const rng = mulberry32(5);
    const small = ntruKeyGen(4, 17, rng);
    expect(Math.abs(detInt(ntruLattice(small)))).toBe(17 ** 4);
    const key = ntruKeyGen(8, 257, rng);
    // (g, f) 가 격자에 속함: f·h′ ≡ g (mod q)
    const inv3 = polyInverse([3, 0, 0, 0, 0, 0, 0, 0], 257)!;
    const hp = polyMulNegacyclic(key.h, inv3, 257);
    expect(polyMulNegacyclic(key.f.map((x) => mod(x, 257)), hp, 257)).toEqual(key.g.map((x) => mod(x, 257)));
    expect(isRotationOfKey([...rotate(key.g, 3), ...rotate(key.f, 3)], key)).toBe(true);
  });
  it('작은 n 에서는 LLL 이 비밀키의 회전을 찾는다', () => {
    let ok = 0;
    for (let s = 1; s <= 5; s++) if (ntruAttack(ntruKeyGen(16, 257, mulberry32(s))).b1IsKey) ok++;
    expect(ok).toBeGreaterThanOrEqual(4);
  });
  it('1048583 은 소수 (overstretched 실험용 q)', () => expect(isPrime(1048583)).toBe(true));
});
