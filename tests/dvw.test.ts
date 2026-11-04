import { describe, expect, it } from 'vitest';
import { chi2CDF, combined, digamma, fatiguePoint, gammaP, lgamma, zetaPrimeOverZeta, zshape } from '../src/lib/dvw';
import { qStarDvW } from '../src/lib/fatigue';
import { CROSS, FATIGUE_NS } from '../src/components/FatigueLines';

describe('수치 루틴', () => {
  it('lgamma, digamma, 불완전 감마, ζ′/ζ', () => {
    expect(lgamma(10)).toBeCloseTo(Math.log(362880), 10);
    expect(digamma(1)).toBeCloseTo(-0.5772156649, 9);
    expect(gammaP(3, 2)).toBeCloseTo(0.3233235838, 9);
    expect(chi2CDF(2, 2)).toBeCloseTo(1 - Math.exp(-1), 9);
    expect(zetaPrimeOverZeta(2)).toBeCloseTo(-0.5699609931, 7); // ζ′(2)/ζ(2)
  });
});

describe('DvW 예측기 이식', () => {
  it('Z 모양 프로파일은 [0, ln q] 안에 있고 부피 n ln q 를 지킨다', () => {
    const p = zshape(257, 64, 20);
    expect(p.reduce((s, x) => s + x, 0)).toBeCloseTo(64 * Math.log(257), 6);
    expect(Math.min(...p)).toBeGreaterThanOrEqual(0);
  });
  it('fatigue point 가 DvW 의 맞춤식 0.004·n^2.484 와 0.2 비트 안에서 맞는다 (n = 128, 256)', () => {
    for (const n of [128, 256]) {
      const f = fatiguePoint(n, 2 / 3, 'circulant');
      expect(Math.abs(Math.log2(f) - Math.log2(qStarDvW(n)))).toBeLessThan(0.2);
      expect(Math.log2(f)).toBeCloseTo(CROSS.tern.dvw[FATIGUE_NS.indexOf(n)], 1);
    }
  });
  it('넓은 비밀은 경계를 위로 민다', () => {
    expect(Math.log2(fatiguePoint(128, 16, 'circulant'))).toBeCloseTo(CROSS.wide.dvw[0], 1);
  });
  it('표준 NTRU 파라미터는 SKR 쪽 (HPS-2048-509)', () => {
    const r = combined(2048, 509, 2 / 3, 'circulant');
    expect(r.pSKR).toBeGreaterThan(0.99);
  });
  it('작은 n 에서는 맞춤식보다 위: n = 40 → 60', () => {
    const f = fatiguePoint(40, 2 / 3, 'circulant');
    expect(f).toBe(60); // FatigueExperiment 위젯의 Q_EST
    expect(f).toBeGreaterThan(1.5 * qStarDvW(40));
  });
});
