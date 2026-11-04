import { describe, expect, it } from 'vitest';
import { NTRU_SCHEMES, log2Fatigue, normDown, normDown2, subfieldMargin, ternaryPoly, usvpBetaNTRU } from '../src/lib/ntruattack';
import { mulberry32 } from '../src/lib/lwe';

/** f(x) 를 xⁿ = −1 인 원시 2n 제곱근 ζ = e^{iπ(2k+1)/n} 에서 계산 */
function evalAt(f: number[], k: number): [number, number] {
  const n = f.length, th = (Math.PI * (2 * k + 1)) / n;
  let re = 0, im = 0;
  f.forEach((c, j) => { re += c * Math.cos(th * j); im += c * Math.sin(th * j); });
  return [re, im];
}

describe('노름 사상', () => {
  it('N(f)(ζ²) = f(ζ)·f(−ζ) (정규 임베딩에서 확인)', () => {
    const f = ternaryPoly(16, mulberry32(1));
    const N = normDown2(f);
    for (const k of [0, 3, 5]) {
      const [a, b] = evalAt(f, k), [c, d] = evalAt(f.map((x, i) => (i % 2 ? -x : x)), k);
      const prod = [a * c - b * d, a * d + b * c];
      const [e, g] = evalAt(N, k);                 // y = x² 에서 (ζ²) 는 n/2 차 원분체의 원시근
      expect(e).toBeCloseTo(prod[0], 6); expect(g).toBeCloseTo(prod[1], 6);
    }
  });
  it('곱셈적: N(fg) = N(f)·N(g)', () => {
    const r = mulberry32(2), f = ternaryPoly(32, r), g = ternaryPoly(32, r);
    const n2 = 32;
    const mul = (a: number[], b: number[]) => { const n = a.length, h = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i + j < n) h[i + j] += a[i] * b[j]; else h[i + j - n] -= a[i] * b[j]; } return h; };
    expect(normDown(mul(f, g), 4)).toEqual(mul(normDown(f, 4), normDown(g, 4)));
    expect(normDown(f, 4).length).toBe(n2 / 4);
  });
});

describe('부분체 gap', () => {
  it('gap 자체는 부분체에서 작아지지만(‖N f‖ ≈ ‖f‖^r), 차원이 줄어 필요한 축소가 약해진다', () => {
    const r = mulberry32(3), f = ternaryPoly(1024, r), g = ternaryPoly(1024, r);
    const a = subfieldMargin(f, g, 1, 100), b = subfieldMargin(f, g, 4, 100);
    expect(b.log2Gap).toBeLessThan(a.log2Gap);
    expect(a.margin).toBeLessThan(0);          // 원래 격자: LLL 로는 부족
    expect(b.margin).toBeGreaterThan(0);       // 지수 4 부분체: LLL 로 충분
    expect(subfieldMargin(f, g, 4, 12).margin).toBeLessThan(0);   // 작은 q 에서는 아무 소용 없음
  });
});

describe('fatigue point 와 uSVP', () => {
  it('DvW21: n = 512 에서 log₂ q* ≈ 14.4, 실제 스킴은 모두 그 아래', () => {
    expect(log2Fatigue(512)).toBeCloseTo(14.39, 1);
    for (const s of NTRU_SCHEMES) expect(Math.log2(s.q)).toBeLessThan(log2Fatigue(s.n));
  });
  it('NTRU-HPS-2048-677 의 uSVP β 가 수백 단위', () => {
    const b = usvpBetaNTRU(677, 11, Math.sqrt(2 / 3))!;
    expect(b).toBeGreaterThan(300); expect(b).toBeLessThan(700);
  });
});
