import { describe, expect, it } from 'vitest';
import {
  convolve, convolvePower, logBallVolume, mean, pmfBit, pmfCBD, pmfDiscreteGaussian, pmfProduct, pmfRoundedGaussian,
  pmfTernary, statDistance, tailAbs, variance, erf, gaussianTailApprox, hoeffdingBound,
} from '../src/lib/prob';

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('기본 분포', () => {
  it('CBD_η 는 합이 1, 평균 0, 분산 η/2', () => {
    for (const eta of [1, 2, 3, 5]) {
      const d = pmfCBD(eta);
      expect(sum(d.p)).toBeCloseTo(1, 12);
      expect(mean(d)).toBeCloseTo(0, 12);
      expect(variance(d)).toBeCloseTo(eta / 2, 12);
    }
  });
  it('CBD_2 의 확률은 (1, 4, 6, 4, 1)/16', () => {
    expect(pmfCBD(2).p.map((x) => x * 16)).toEqual([1, 4, 6, 4, 1]);
  });
  it('이산 가우시안 D_{Z,s} 의 표준편차 ≈ s/√(2π) (s 가 클 때)', () => {
    for (const s of [5, 10, 30]) expect(Math.sqrt(variance(pmfDiscreteGaussian(s)))).toBeCloseTo(s / Math.sqrt(2 * Math.PI), 4);
  });
  it('반올림 가우시안의 분산 ≈ σ² + 1/12', () => {
    expect(variance(pmfRoundedGaussian(4))).toBeCloseTo(16 + 1 / 12, 2);
  });
});

describe('합과 곱', () => {
  it('독립 합의 분산은 분산의 합', () => {
    const d = convolvePower(pmfCBD(2), 64);
    expect(sum(d.p)).toBeCloseTo(1, 10);
    expect(variance(d)).toBeCloseTo(64, 8);
    expect(variance(convolve(pmfCBD(3), pmfTernary()))).toBeCloseTo(1.5 + 2 / 3, 10);
  });
  it('e·r (e ← CBD_2, r ← {0,1}) 의 분산 = Var(e)·E[r] = 1/2', () => {
    expect(variance(pmfProduct(pmfCBD(2), pmfBit()))).toBeCloseTo(0.5, 12);
  });
  it('꼬리 확률: 정확값 ≤ Hoeffding 상한 (CBD_2 는 [−2, 2] 값)', () => {
    const d = convolvePower(pmfCBD(2), 256);
    for (const t of [10, 30, 60, 100, 200, 400]) expect(tailAbs(d, t)).toBeLessThanOrEqual(hoeffdingBound(t, 256, -2, 2));
  });
  it('주의: 가우시안 근사는 먼 꼬리에서 상한이 아니다 (본문 4절의 반례)', () => {
    const d = convolvePower(pmfProduct(pmfCBD(2), pmfBit()), 64);
    const sigma = Math.sqrt(variance(d)); // √32
    expect(tailAbs(d, 64.25)).toBeGreaterThan(gaussianTailApprox(64.25, sigma));
  });
});

describe('통계적 거리', () => {
  it('자기 자신과는 0, 서로소 지지집합이면 1, 대칭', () => {
    const a = pmfCBD(2), b = { min: 10, p: [1] };
    expect(statDistance(a, a)).toBe(0);
    expect(statDistance(a, b)).toBeCloseTo(1, 12);
    expect(statDistance(a, pmfTernary())).toBeCloseTo(statDistance(pmfTernary(), a), 12);
  });
  it('s 가 커질수록 반올림 가우시안과 이산 가우시안이 가까워진다', () => {
    const d = (s: number) => statDistance(pmfDiscreteGaussian(s), pmfRoundedGaussian(s / Math.sqrt(2 * Math.PI)));
    expect(d(20)).toBeLessThan(d(3));
  });
});

describe('기하', () => {
  it('단위 공 부피: V_2 = π, V_3 = 4π/3, V_n 은 n ≈ 5 에서 최대', () => {
    expect(Math.exp(logBallVolume(2))).toBeCloseTo(Math.PI, 8);
    expect(Math.exp(logBallVolume(3))).toBeCloseTo((4 * Math.PI) / 3, 8);
    const v = Array.from({ length: 20 }, (_, i) => logBallVolume(i + 1));
    expect(v.indexOf(Math.max(...v)) + 1).toBe(5);
  });
  it('erf 근사', () => {
    expect(erf(0)).toBeCloseTo(0, 6);
    expect(erf(1)).toBeCloseTo(0.8427007929, 6);
  });
});
