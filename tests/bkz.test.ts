import { describe, expect, it } from 'vitest';
import { bkz, deltaBeta, enumBlock, enumLevelsGSA, gaussSieve, insertVector, log2Sum, norm2, qaryLattice, rootHermite } from '../src/lib/bkz';
import { gramSchmidt, lll, sameLattice } from '../src/lib/lattice';

/** 작은 차원에서 계수 범위 전수조사로 λ₁² */
function bruteLambda1(B: number[][], R = 3): number {
  const n = B.length;
  let best = Infinity;
  const x = new Array(n).fill(-R);
  for (;;) {
    if (x.some((v) => v !== 0)) {
      const v = B[0].map((_, t) => x.reduce((s, xi, i) => s + xi * B[i][t], 0));
      best = Math.min(best, norm2(v));
    }
    let i = 0;
    while (i < n && x[i] === R) { x[i] = -R; i++; }
    if (i === n) break;
    x[i]++;
  }
  return best;
}

describe('열거', () => {
  it('전체 블록 열거 = 최단 벡터 (LLL 축소된 6차원 격자, 전수조사와 비교)', () => {
    for (const seed of [1, 2, 3]) {
      const B = lll(qaryLattice(6, 101, seed), 0.99).basis;
      const { mu, Bn } = gramSchmidt(B);
      const r = enumBlock(mu, Bn, 0, 6, Bn[0] + 1);
      expect(Math.round(r.norm2)).toBe(Math.min(bruteLambda1(B), Math.round(Bn[0])));
    }
  });
  it('삽입: gcd 소거 후에도 같은 격자이고 첫 벡터가 v', () => {
    const B = lll(qaryLattice(8, 97, 5), 0.99).basis;
    const x = [3, -2, 0, 5, 0, 0, 0, 0];
    const v = B[0].map((_, t) => x.reduce((s, xi, i) => s + xi * B[i][t], 0));
    const C = insertVector(B, 0, x);
    expect(C[0]).toEqual(v);
    expect(sameLattice(B, C)).toBe(true);
  });
});

describe('BKZ', () => {
  it('같은 격자를 유지하고, 첫 블록에서 더 짧은 벡터가 없다(BKZ 축소의 정의), 평균 δ 는 LLL 보다 작다', () => {
    let dL = 0, d20 = 0;
    for (const seed of [7, 8, 9]) {
      const B0 = qaryLattice(40, 65537, seed);
      const L = lll(B0, 0.99).basis, B = bkz(B0, 20, 4).basis;
      expect(sameLattice(B0, B)).toBe(true);
      const { mu, Bn } = gramSchmidt(B);
      expect(enumBlock(mu, Bn, 0, 20, 0.999 * Bn[0]).x).toBeNull();
      dL += rootHermite(L); d20 += rootHermite(B);
    }
    expect(d20).toBeLessThan(dL);
  });
  it('β = n (작은 차원) 이면 b₁ 이 최단 벡터', () => {
    const B0 = qaryLattice(8, 211, 3);
    const B = bkz(B0, 8, 6).basis;
    expect(norm2(B[0])).toBe(bruteLambda1(lll(B0, 0.99).basis));
  });
});

describe('Gauss sieve', () => {
  it('20차원에서 최단 벡터를 찾는다 (BKZ-20 결과 이하)', () => {
    const B0 = qaryLattice(20, 1009, 11);
    const s = gaussSieve(B0, 300, 1);
    const ref = bkz(B0, 20, 6).basis;
    expect(s.norm2).toBeLessThanOrEqual(norm2(ref[0]));
  });
});

describe('비용 모델', () => {
  it('δ_β 공식: β 가 크면 δ 가 1 로 줄어든다', () => {
    expect(deltaBeta(50)).toBeGreaterThan(deltaBeta(100));
    expect(deltaBeta(100)).toBeGreaterThan(deltaBeta(400));
    expect(deltaBeta(400)).toBeGreaterThan(1);
  });
  it('열거 노드 수: 기저가 좋을수록(δ 작을수록) 적다', () => {
    const a = log2Sum(enumLevelsGSA(80, 1.0219)), b = log2Sum(enumLevelsGSA(80, 1.0128));
    expect(a).toBeGreaterThan(b);
  });
});
