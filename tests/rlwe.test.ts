import { describe, expect, it } from 'vitest';
import { evalAt, mulMatrix, ringMul, rootAttackScores, sampleRLWE, someRoot } from '../src/lib/rlwe';
import { mod } from '../src/lib/algebra';
import { mulberry32 } from '../src/lib/lwe';

describe('Ring-LWE 표본 = 구조화된 LWE 표본', () => {
  it('a·s 의 계수 = M_a · s (행렬은 a 의 n 개 수로 정해진다)', () => {
    const r = mulberry32(1);
    for (const kind of ['nega', 'cyclic'] as const) {
      const a = Array.from({ length: 8 }, () => Math.floor(r() * 97)), s = Array.from({ length: 8 }, () => Math.floor(r() * 97));
      const M = mulMatrix(a, 97, kind);
      expect(M.map((row) => mod(row.reduce((acc, x, j) => acc + x * s[j], 0), 97))).toEqual(ringMul(a, s, 97, kind));
    }
  });
  it('negacyclic 행렬: 각 열은 위 열을 한 칸 내리고 넘친 성분의 부호를 바꾼 것', () => {
    const a = [1, 2, 3, 4];
    const M = mulMatrix(a, 97, 'nega');
    expect(M.map((row) => row[1])).toEqual([mod(-4, 97), 1, 2, 3]);
  });
  it('평가 준동형: (a·b)(r) = a(r)·b(r) (r 이 변환 다항식의 근일 때)', () => {
    const r = mulberry32(2), q = 97, n = 16;
    const root = someRoot(n, q, 'nega')!;
    expect(mod(root ** 0, q)).toBe(1);
    const a = Array.from({ length: n }, () => Math.floor(r() * q)), b = Array.from({ length: n }, () => Math.floor(r() * q));
    expect(evalAt(ringMul(a, b, q, 'nega'), root, q)).toBe(mod(evalAt(a, root, q) * evalAt(b, root, q), q));
    expect(evalAt(ringMul(a, b, q, 'cyclic'), 1, q)).toBe(mod(evalAt(a, 1, q) * evalAt(b, 1, q), q));
  });
});

describe('근에서의 값 공격', () => {
  it('xⁿ − 1 에서는 s(1) 이 드러나고, xⁿ + 1 에서는 드러나지 않는다', () => {
    const n = 16, q = 97, sigma = 1, m = 40;
    let okCyc = 0, okNeg = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const c = sampleRLWE(n, q, sigma, m, 'cyclic', mulberry32(seed));
      const sc = rootAttackScores(c.samples, 1, q, 12);
      if (sc.indexOf(Math.max(...sc)) === mod(c.s.reduce((a, b) => a + b, 0), q)) okCyc++;
      const g = sampleRLWE(n, q, sigma, m, 'nega', mulberry32(seed + 100));
      const root = someRoot(n, q, 'nega')!;
      const sg = rootAttackScores(g.samples, root, q, 12);
      if (sg.indexOf(Math.max(...sg)) === evalAt(g.s.map((x) => mod(x, q)), root, q)) okNeg++;
    }
    expect(okCyc).toBeGreaterThanOrEqual(9);
    expect(okNeg).toBeLessThanOrEqual(2);
  });
});
