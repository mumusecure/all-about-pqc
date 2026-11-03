import { describe, expect, it } from 'vitest';
import { convergents, factorFromOrder, groverAmplitudes, groverOptimal, groverSuccess, orderFromMeasurement, orderMod, shorDistribution } from '../src/lib/quantum';

describe('그로버', () => {
  it('상태 벡터 시뮬레이션 = 닫힌 꼴 sin²((2k+1)θ)', () => {
    for (const [N, M] of [[16, 1], [64, 1], [64, 3], [256, 2]]) {
      const marked = new Set(Array.from({ length: M }, (_, i) => i * 7 % N));
      for (let k = 0; k <= 12; k++) {
        const a = groverAmplitudes(N, marked, k);
        const p = [...marked].reduce((s, i) => s + a[i] ** 2, 0);
        expect(p).toBeCloseTo(groverSuccess(N, M, k), 10);
        expect(a.reduce((s, x) => s + x * x, 0)).toBeCloseTo(1, 10); // 노름 보존(유니터리)
      }
    }
  });
  it('최적 반복 ≈ (π/4)√N, 그때 성공 확률이 높다', () => {
    expect(groverOptimal(1024, 1)).toBe(25);
    expect(groverSuccess(1024, 1, 25)).toBeGreaterThan(0.99);
    expect(groverSuccess(1024, 1, 50)).toBeLessThan(0.1); // 너무 많이 돌리면 오히려 떨어진다
  });
});

describe('쇼어', () => {
  it('N = 15, a = 7: 위수 4, 인수 3 × 5', () => {
    expect(orderMod(7, 15)).toBe(4);
    expect(factorFromOrder(7, 4, 15)).toEqual([3, 5]);
  });
  it('측정 분포는 Q/r 의 배수에 몰리고, 합은 1', () => {
    const { Q, r, P } = shorDistribution(7, 15, 8);
    expect(P.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 10);
    for (let j = 0; j < r; j++) expect(P[(j * Q) / r]).toBeCloseTo(1 / r, 10); // r | Q 이면 정확히 1/r
  });
  it('N = 21 (r 가 Q 를 나누지 않는 경우): 봉우리의 측정값에서 연분수로 위수 6 을 찾고 인수 3 × 7', () => {
    const a = 2, N = 21;
    const { Q, r, P } = shorDistribution(a, N, 9);
    expect(r).toBe(6);
    // 가장 확률이 큰 0 이 아닌 측정값들
    const peaks = P.map((p, y) => [p, y]).filter(([, y]) => y > 0).sort((u, v) => v[0] - u[0]).slice(0, 4).map(([, y]) => y);
    const found = peaks.map((y) => orderFromMeasurement(y, Q, a, N)).filter((x) => x !== null);
    expect(found).toContain(6);
    expect(factorFromOrder(2, 6, 21)).toEqual([7, 3]);
  });
  it('연분수: 427/512 의 근사분수에 5/6 이 나온다', () => {
    expect(convergents(427, 512, 21).map(([, d]) => d)).toContain(6);
  });
});
