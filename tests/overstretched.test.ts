import { describe, expect, it } from 'vitest';
import { deltaBKZ, kRange, margin32 } from '../src/lib/overstretched';

describe('식 (3.2) 계산기 (논문 읽기 1 의 재계산 수치)', () => {
  it('δ_20 (GSA 근사식) ≈ 1.00965', () => expect(deltaBKZ(20)).toBeCloseTo(1.00965, 4));
  it('n = 2^10, q = 2^42: δ_20 근사식으로 287 ≤ k ≤ 800, k = 280 은 경계 바로 밖', () => {
    expect(kRange(1024, 42, deltaBKZ(20))).toEqual([287, 800]);
    expect(Math.round(margin32(1024, 42, 280, deltaBKZ(20)))).toBe(-145);
  });
  it('실험적 δ (BKZ-20 ≈ 1.0128, LLL ≈ 1.0219) 로는 n = 2^10 에서 만족하는 k 가 없다', () => {
    expect(kRange(1024, 42, 1.0128)).toBeNull();
    expect(kRange(1024, 42, 1.0219)).toBeNull();
  });
  it('작은 파라미터의 최소 k', () => {
    expect(kRange(64, 22, 1.0219)![0]).toBe(16);
    expect(kRange(128, 27, 1.0128)![0]).toBe(30);
    expect(kRange(256, 32, 1.0128)![0]).toBe(61);
    expect(kRange(512, 37, 1.0219)).toBeNull();
    expect(kRange(512, 37, 1.0128)![0]).toBe(131);
  });
});
