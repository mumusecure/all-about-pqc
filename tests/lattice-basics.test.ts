import { describe, expect, it } from 'vitest';
import {
  detInt, dot, dualBasis, latticeContains, polygonArea, sameLattice, shortVectors2D, successiveMinima2D, voronoiCell2D, volume,
} from '../src/lib/lattice';

describe('기저와 소속', () => {
  it('유니모듈러 변환이면 같은 격자, 아니면 다른 격자', () => {
    expect(sameLattice([[1, 0], [0, 1]], [[2, 3], [3, 5]])).toBe(true); // det = 1
    expect(sameLattice([[1, 0], [0, 1]], [[1, 2], [3, 4]])).toBe(false); // det = −2 → 지표 2 인 부분격자
    expect(sameLattice([[11, 6], [19, 11]], [[3, 1], [-1, 2]])).toBe(true); // 9장의 나쁜/좋은 기저
  });
  it('소속 판정', () => {
    const B = [[2, 0], [1, 3]];
    expect(latticeContains(B, [3, 3])).toBe(true);
    expect(latticeContains(B, [1, 0])).toBe(false);
  });
});

describe('쌍대 격자', () => {
  it('⟨b_i, d_j⟩ = δ_ij, vol(L*) = 1/vol(L), (L*)* = L', () => {
    const B = [[2, 0, 1], [1, 3, 0], [0, 1, 4]];
    const D = dualBasis(B)!;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(dot(B[i], D[j])).toBeCloseTo(i === j ? 1 : 0, 10);
    expect(volume(D)).toBeCloseTo(1 / Math.abs(detInt(B)), 10);
    const DD = dualBasis(D)!;
    DD.forEach((r, i) => r.forEach((x, j) => expect(x).toBeCloseTo(B[i][j], 9)));
  });
  it('q-ary 쌍대성: Λ_13((1,5))* = (1/13)·Λ⊥_13((1,5))', () => {
    const Lq = [[1, 5], [0, 13]];
    const Lperp = [[13, 0], [-5, 1]];
    const D = dualBasis(Lq)!.map((r) => r.map((x) => 13 * x));
    expect(sameLattice(D, Lperp)).toBe(true);
    expect(Math.abs(detInt(Lq))).toBe(13); // q^{m−n} = 13^1
    expect(Math.abs(detInt(Lperp))).toBe(13); // q^n = 13^1
    // Λ⊥ 의 모든 벡터 y 는 y₁ + 5y₂ ≡ 0 (mod 13)
    for (const y of Lperp) expect(((y[0] + 5 * y[1]) % 13 + 13) % 13).toBe(0);
  });
});

describe('연속 최소값과 보로노이 셀', () => {
  it('ℤ² 의 λ₁ = λ₂ = 1, 육각 격자의 λ₁ = λ₂', () => {
    const z = successiveMinima2D([[1, 0], [0, 1]]);
    expect(z.l1).toBeCloseTo(1);
    expect(z.l2).toBeCloseTo(1);
    const h = successiveMinima2D([[2, 0], [1, Math.sqrt(3)]]);
    expect(h.l1).toBeCloseTo(h.l2, 9);
  });
  it('2D 연속 최소값은 전수조사 결과와 일치', () => {
    const B = [[11, 6], [19, 11]];
    const { l1 } = successiveMinima2D(B);
    expect(l1).toBeCloseTo(Math.sqrt(5), 9);
    expect(Math.sqrt(Math.min(...shortVectors2D(B, 10).map((v) => dot(v, v))))).toBeCloseTo(l1, 9);
  });
  it('보로노이 셀의 넓이 = 격자의 부피 (기본 영역은 모두 부피가 같다)', () => {
    for (const B of [[[1, 0], [0, 1]], [[3, 1], [-1, 2]], [[11, 6], [19, 11]], [[2, 0], [1, Math.sqrt(3)]]]) {
      expect(polygonArea(voronoiCell2D(B))).toBeCloseTo(Math.abs(B[0][0] * B[1][1] - B[0][1] * B[1][0]), 6);
    }
  });
  it('Minkowski: 넓이가 4·vol 보다 큰 원(볼록·대칭) 안에는 0 아닌 격자점이 있다', () => {
    for (const B of [[[3, 1], [-1, 2]], [[11, 6], [19, 11]], [[5, 0], [2, 7]]]) {
      const vol = Math.abs(B[0][0] * B[1][1] - B[0][1] * B[1][0]);
      const r = Math.sqrt((4 * vol) / Math.PI) * 1.0001;
      expect(shortVectors2D(B, r).length).toBeGreaterThan(0);
    }
  });
});
