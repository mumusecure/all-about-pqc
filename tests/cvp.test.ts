import { describe, expect, it } from 'vitest';
import { babaiNearestPlane, babaiRound, closestVector2D, gramSchmidt, latticeContains, lll, norm, sub } from '../src/lib/lattice';
import { mulberry32 } from '../src/lib/lwe';

const good = [[3, 1], [-1, 2]];
const bad = [[11, 6], [19, 11]];

describe('Babai 알고리즘', () => {
  it('본문 예제: t = (2.5, 2.4) 에서 좋은 기저는 정답 (2,3), 나쁜 기저 반올림은 (5,4)', () => {
    expect(closestVector2D(good, [2.5, 2.4])).toEqual([2, 3]);
    expect(babaiRound(good, [2.5, 2.4])).toEqual([2, 3]);
    expect(babaiRound(bad, [2.5, 2.4])).toEqual([5, 4]);
  });
  it('출력은 항상 격자점', () => {
    const r = mulberry32(5);
    for (let k = 0; k < 50; k++) {
      const t = [r() * 40 - 20, r() * 40 - 20];
      for (const B of [good, bad]) {
        expect(latticeContains(B, babaiRound(B, t))).toBe(true);
        expect(latticeContains(B, babaiNearestPlane(B, t))).toBe(true);
      }
    }
  });
  it('최근접 평면: t − v 의 GSO 좌표는 모두 |c| ≤ 1/2', () => {
    const r = mulberry32(9);
    const B = [[7, 2, 1], [3, 8, 2], [1, 4, 9]];
    const { bstar, Bn } = gramSchmidt(B);
    for (let k = 0; k < 100; k++) {
      const t = [r() * 30, r() * 30, r() * 30];
      const e = sub(t, babaiNearestPlane(B, t));
      bstar.forEach((b, i) => expect(Math.abs(e.reduce((s, x, j) => s + x * b[j], 0) / Bn[i])).toBeLessThanOrEqual(0.5 + 1e-9));
    }
  });
  it('BDD: ‖e‖ < ½·min‖b*ᵢ‖ 이면 최근접 평면이 정확히 복호한다 (LLL 기저에서)', () => {
    const r = mulberry32(21);
    const B0 = [[97, 0, 0, 0], [0, 97, 0, 0], [31, 55, 1, 0], [12, 80, 0, 1]];
    const B = lll(B0, 0.99).basis;
    const minGs = Math.min(...gramSchmidt(B).Bn.map(Math.sqrt));
    for (let k = 0; k < 50; k++) {
      const c = [3, -2, 5, 1].map((x) => x + Math.floor(r() * 7) - 3);
      const v = B[0].map((_, j) => c.reduce((s, ci, i) => s + ci * B[i][j], 0));
      const dir = [r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5];
      const e = dir.map((x) => (x / norm(dir)) * 0.49 * minGs);
      expect(babaiNearestPlane(B, v.map((x, j) => x + e[j]))).toEqual(v);
    }
  });
});
