import { describe, expect, it } from 'vitest';
import { PRESETS, costModels, dropHybrid, dualAttack, primalSides, primalUSVP } from '../src/lib/estimator';

describe('primal uSVP (ADPS16 조건)', () => {
  it('ML-KEM 의 core-SVP 를 Kyber 3라운드 명세(118 / 182 / 256)와 ±3 비트 안에서 재현', () => {
    const want: Record<string, number> = { 'ML-KEM-512': 118, 'ML-KEM-768': 182, 'ML-KEM-1024': 256 };
    for (const [k, w] of Object.entries(want)) {
      const r = primalUSVP(PRESETS[k])!;
      expect(Math.abs(costModels(r.beta, r.d).classical - w)).toBeLessThan(3);
    }
  });
  it('β 를 키우면 조건이 성립하는 쪽으로 간다 (오른쪽 − 왼쪽 증가)', () => {
    const P = PRESETS['ML-KEM-512'];
    const a = primalSides(P, 472, 300), b = primalSides(P, 472, 450);
    expect(b.rhs - b.lhs).toBeGreaterThan(a.rhs - a.lhs);
  });
  it('오차가 클수록 β 가 커진다', () => {
    const P = PRESETS['ML-KEM-768'];
    expect(primalUSVP({ ...P, sigmaE: 2 * P.sigmaE, sigmaS: 2 * P.sigmaS })!.beta).toBeGreaterThan(primalUSVP(P)!.beta);
  });
});

describe('dual 과 하이브리드', () => {
  it('ML-KEM 에서 단순 dual 비용이 primal 과 비슷하다 (±10 비트)', () => {
    for (const k of ['ML-KEM-512', 'ML-KEM-768']) {
      const p = primalUSVP(PRESETS[k])!, d = dualAttack(PRESETS[k])!;
      expect(Math.abs(d.cost - 0.292 * p.beta)).toBeLessThan(10);
    }
  });
  it('희소 비밀(h = 64): 좌표를 버리는 하이브리드가 순수 primal 보다 싸다', () => {
    const pure = dropHybrid(1024, 64, 27, 3.2, 0, 2048)!;
    const hyb = dropHybrid(1024, 64, 27, 3.2, 200, 2048)!;
    expect(hyb.cost).toBeLessThan(pure.cost);
  });
  it('반복을 넣은 모델은 core-SVP 보다 크다 (HE 예: 100 대 130 비트 근처)', () => {
    const r = primalUSVP(PRESETS['HE-1024'])!;
    const c = costModels(r.beta, r.d);
    expect(c.classical).toBeGreaterThan(95); expect(c.classical).toBeLessThan(106);
    expect(c.withTours - c.classical).toBeGreaterThan(25);
  });
});
