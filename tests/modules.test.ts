import { describe, expect, it } from 'vitest';
import {
  conj, cycloUnit, fromEmbedding, herm, idealSieve, l2, lllFirstLen, log2AbsNorm, logProfile, moduleGauss, negamul,
  principalIdeal, randomModule, roundingNormStats, timesUnitPower, zBasis,
} from '../src/lib/modules';
import { embed } from '../src/lib/numfield';
import { latticeContains, sameLattice } from '../src/lib/lattice';
import { mulberry32 } from '../src/lib/lwe';

describe('임베딩과 단원', () => {
  it('역변환: fromEmbedding(embed(f)) = f', () => {
    const f = [3, -1, 0, 2, 5, 0, -2, 1];
    expect(fromEmbedding(embed(f)).map(Math.round)).toEqual(f);
  });
  it('켤레는 임베딩의 복소켤레', () => {
    const f = [1, 2, 0, -1], e = embed(f), c = embed(conj(f));
    e.forEach((z, j) => { expect(c[j][0]).toBeCloseTo(z[0], 9); expect(c[j][1]).toBeCloseTo(-z[1], 9); });
  });
  it('원분 단원 1 + x + … + x^{a−1} (a 홀수) 의 노름은 ±1, 곱해도 노름은 그대로', () => {
    for (const a of [3, 5, 7]) expect(Math.abs(log2AbsNorm(cycloUnit(16, a)))).toBeLessThan(1e-9);
    const g = [3, -1, 4, 1, -5, 9, 2, -6, 5, 3, -5, 8, 9, -7, 9, 3];
    const h = timesUnitPower(g, cycloUnit(16, 3), 2);
    expect(log2AbsNorm(h)).toBeCloseTo(log2AbsNorm(g), 6);
    expect(logProfile(h).reduce((s, x) => s + x, 0) * 2).toBeCloseTo(log2AbsNorm(g), 6);
  });
});

describe('반올림의 유클리드성', () => {
  it('작은 n 에서는 계수 반올림 오차의 노름이 거의 항상 1 미만, 큰 n 에서는 거의 항상 1 초과', () => {
    expect(roundingNormStats(4, 2000, mulberry32(1)).frac).toBeGreaterThan(0.99);
    expect(roundingNormStats(64, 2000, mulberry32(2)).frac).toBeLessThan(0.01);
  });
});

describe('랭크 2 모듈', () => {
  it('ℤ-기저는 R-모듈과 같은 격자이고 에르미트 내적은 켤레 대칭', () => {
    const [b1, b2] = randomModule(4, 3, 1);
    const B = zBasis(b1, b2);
    const v = [...negamul([1, 2, 0, 0], b1[0]).map((x, i) => x + b2[0][i]), ...negamul([1, 2, 0, 0], b1[1]).map((x, i) => x + b2[1][i])];
    expect(latticeContains(B, v)).toBe(true);
    expect(herm(b1, b2)).toEqual(conj(herm(b2, b1)));
  });
  it('모듈 가우스 축소 결과가 같은 격자이고, n = 2 (ℤ[i]) 에서는 LLL 과 같은 길이', () => {
    const [b1, b2] = randomModule(2, 3, 5, 6);
    const r = moduleGauss(b1, b2);
    expect(sameLattice(zBasis(b1, b2), zBasis(r.out[0], r.out[1]))).toBe(true);
    expect(r.firstLen).toBeCloseTo(lllFirstLen(b1, b2), 6);
  });
});

describe('회전을 쓰는 체', () => {
  it('이데알 격자에서 같은 최단 벡터를 찾고, 목록은 몇 배 작다', () => {
    const r = mulberry32(23), g = Array.from({ length: 16 }, () => Math.floor(r() * 41) - 20);
    const B = principalIdeal(g);
    const a = idealSieve(B, false, 200, 1), b = idealSieve(B, true, 200, 1);
    expect(latticeContains(B, a.best)).toBe(true);
    expect(latticeContains(B, b.best)).toBe(true);
    expect(b.norm).toBeCloseTo(a.norm, 6);
    expect(b.maxList * 4).toBeLessThan(a.maxList);
    expect(l2(b.best)).toBeLessThanOrEqual(l2(g) + 1e-9);
  });
});
