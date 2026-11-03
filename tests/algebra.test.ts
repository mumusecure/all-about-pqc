import { describe, expect, it } from 'vitest';
import {
  crt, egcd, egcdSteps, gcd, interpolate, isPrime, mod, modInverse, modPow, multOrder, negacyclicRoots,
  polyEval, polyMulFull, polyMulNegacyclic, reduceNegacyclic,
} from '../src/lib/algebra';
import { mulberry32 } from '../src/lib/lwe';

describe('유클리드 호제법', () => {
  it('각 행이 r = s·a + t·b 를 만족하고 마지막 비영 r 이 gcd', () => {
    for (const [a, b] of [[3329, 17], [240, 46], [1071, 462], [97, 1]]) {
      const rows = egcdSteps(a, b);
      rows.forEach((row) => expect(row.s * a + row.t * b).toBe(row.r));
      expect(rows[rows.length - 2].r).toBe(gcd(a, b));
    }
  });
  it('17⁻¹ mod 3329 = 1175 (본문 예제)', () => {
    expect(modInverse(17, 3329)).toBe(1175);
    const [g, s, t] = egcd(3329, 17);
    expect(g).toBe(1);
    expect(s * 3329 + t * 17).toBe(1);
  });
  it('gcd(a, q) ≠ 1 이면 역원이 없다', () => {
    expect(modInverse(6, 12)).toBeNull();
    expect(modInverse(5, 12)).toBe(5);
  });
});

describe('군과 위수', () => {
  it('ML-KEM 의 ζ = 17 은 mod 3329 에서 위수 256 (원시 256제곱근)', () => {
    expect(multOrder(17, 3329)).toBe(256);
    expect(modPow(17, 128, 3329)).toBe(3328);
  });
  it('라그랑주: 위수는 군의 크기(φ(q))를 나눈다', () => {
    for (const q of [17, 97, 101]) for (let a = 1; a < q; a++) expect((q - 1) % (multOrder(a, q) as number)).toBe(0);
  });
  it('isPrime', () => {
    expect([2, 3, 17, 97, 3329, 12289].every(isPrime)).toBe(true);
    expect([1, 4, 15, 3328].some(isPrime)).toBe(false);
  });
});

describe('중국인의 나머지 정리', () => {
  it('손자산경 예제: x ≡ 2 (3), 3 (5), 2 (7) → 23', () => {
    expect(crt([2, 3, 2], [3, 5, 7])).toBe(23);
  });
  it('ℤ_15 ≅ ℤ_3 × ℤ_5 는 덧셈·곱셈을 보존한다', () => {
    for (let a = 0; a < 15; a++)
      for (let b = 0; b < 15; b++) {
        expect(crt([mod(a + b, 3), mod(a + b, 5)], [3, 5])).toBe(mod(a + b, 15));
        expect(crt([mod(a * b, 3), mod(a * b, 5)], [3, 5])).toBe(mod(a * b, 15));
      }
  });
  it('서로소가 아니면 null', () => expect(crt([1, 1], [4, 6])).toBeNull());
});

describe('ℤ_q[x]/(x^n+1)', () => {
  const rand = (n: number, q: number, seed: number) => {
    const r = mulberry32(seed);
    return Array.from({ length: n }, () => Math.floor(r() * q));
  };
  it('negacyclic 곱 = 일반 곱 후 x^n+1 로 나눈 나머지', () => {
    for (let s = 1; s <= 20; s++) {
      const f = rand(8, 17, s), g = rand(8, 17, s + 100);
      expect(polyMulNegacyclic(f, g, 17)).toEqual(reduceNegacyclic(polyMulFull(f, g, 17), 8, 17));
    }
  });
  it('x 를 곱하면 계수가 한 칸 회전하고 넘친 계수는 부호가 바뀐다; x^{2n} = 1', () => {
    const n = 4, q = 17;
    const x = [0, 1, 0, 0];
    expect(polyMulNegacyclic([1, 2, 3, 4], x, q)).toEqual([mod(-4, q), 1, 2, 3]);
    let p = [1, 0, 0, 0];
    for (let k = 0; k < 2 * n; k++) p = polyMulNegacyclic(p, x, q);
    expect(p).toEqual([1, 0, 0, 0]);
  });
  it('x^4+1 mod 17 의 근은 2, 8, 9, 15 이고, x^8+1 은 8개 근', () => {
    expect(negacyclicRoots(4, 17)).toEqual([2, 8, 9, 15]);
    expect(negacyclicRoots(8, 17)).toEqual([3, 5, 6, 7, 10, 11, 12, 14]);
  });
  it('CRT(평가) 관점: 근에서의 값끼리 곱한 뒤 보간하면 negacyclic 곱과 같다', () => {
    for (const n of [4, 8]) {
      const q = 17;
      const roots = negacyclicRoots(n, q);
      const f = rand(n, q, n), g = rand(n, q, n + 7);
      const pointwise = roots.map((w) => mod(polyEval(f, w, q) * polyEval(g, w, q), q));
      expect(interpolate(roots, pointwise, q)).toEqual(polyMulNegacyclic(f, g, q));
    }
  });
});
