import { describe, expect, it } from 'vitest';
import {
  detInt, gaussReduce, gramSchmidt, isLLLReduced, lll, norm, norm2, dot, volume,
} from '../src/lib/lattice';
import { mulberry32 } from '../src/lib/lwe';

const randBasis = (d: number, bound: number, seed: number) => {
  const rng = mulberry32(seed);
  for (;;) {
    const B = Array.from({ length: d }, () => Array.from({ length: d }, () => Math.floor(rng() * (2 * bound + 1)) - bound));
    if (detInt(B) !== 0) return B;
  }
};

/** 브루트포스로 2차원 격자의 최단 벡터 길이 (작은 계수 탐색) */
const shortest2D = (b1: number[], b2: number[], R = 60) => {
  let best = Infinity;
  for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) {
    if (x === 0 && y === 0) continue;
    const v = [x * b1[0] + y * b2[0], x * b1[1] + y * b2[1]];
    best = Math.min(best, norm2(v));
  }
  return Math.sqrt(best);
};

describe('Gram-Schmidt', () => {
  it('b*_i 들은 서로 직교하고 부피는 |det| 와 같다', () => {
    const B = randBasis(5, 9, 1);
    const { bstar } = gramSchmidt(B);
    for (let i = 0; i < 5; i++) for (let j = 0; j < i; j++) expect(Math.abs(dot(bstar[i], bstar[j]))).toBeLessThan(1e-6);
    expect(volume(B)).toBeCloseTo(Math.abs(detInt(B)), 3);
  });
});

describe('Lagrange–Gauss 2D 축소', () => {
  it('결과 b1 은 최단 벡터이고 부피는 보존된다', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const [b1, b2] = randBasis(2, 40, seed);
      const steps = gaussReduce(b1, b2);
      const last = steps[steps.length - 1];
      expect(last.kind).toBe('done');
      expect(norm(last.b1)).toBeCloseTo(shortest2D(b1, b2), 6);
      expect(Math.abs(detInt([last.b1, last.b2]))).toBe(Math.abs(detInt([b1, b2])));
    }
  });
});

describe('LLL', () => {
  it('출력은 LLL-축소 조건을 만족하고 같은 격자를 생성한다(|det| 보존, 정수)', () => {
    for (const d of [3, 6, 10, 15]) {
      const B = randBasis(d, 50, d * 7);
      const { basis } = lll(B, 0.99);
      expect(isLLLReduced(basis, 0.99)).toBe(true);
      expect(basis.flat().every(Number.isInteger)).toBe(true);
      expect(Math.abs(detInt(basis))).toBe(Math.abs(detInt(B)));
    }
  });

  it('LLL 보장: ||b1|| ≤ 2^{(d−1)/4} · vol^{1/d}  (δ = 3/4)', () => {
    for (const d of [4, 8, 12]) {
      const B = randBasis(d, 30, 100 + d);
      const { basis } = lll(B, 0.75);
      const vol = Math.abs(detInt(B));
      expect(norm(basis[0])).toBeLessThanOrEqual(2 ** ((d - 1) / 4) * vol ** (1 / d) + 1e-9);
    }
  });

  it('고전 예제: 숨은 짧은 관계 찾기', () => {
    // 기저 (1,0,0,N·a1), (0,1,0,N·a2), (0,0,1,N·a3) 에서 a1 x + a2 y + a3 z = 0 의 작은 해를 찾는다.
    const a = [1234, 2345, 3579]; // 1234 + 2345 − 3579 = 0
    const N = 10000;
    const B = [[1, 0, 0, N * a[0]], [0, 1, 0, N * a[1]], [0, 0, 1, N * a[2]]];
    const { basis } = lll(B);
    const v = basis[0];
    expect(v[3]).toBe(0);
    expect(v[0] * a[0] + v[1] * a[1] + v[2] * a[2]).toBe(0);
    expect(norm(v)).toBeLessThanOrEqual(Math.sqrt(3) + 1e-9);
  });
});
