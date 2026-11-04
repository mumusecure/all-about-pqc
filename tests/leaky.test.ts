import { describe, expect, it } from 'vitest';
import { dualAttack, primalUSVP, sigmaCBD } from '../src/lib/estimator';
import { hintedGroups, leakyBeta } from '../src/lib/leaky';

const lq = Math.log2(3329), s = sigmaCBD(3);
const none = { perfect: 0, modular: 0, modK: 2, approx: 0, sigmaH: 1 };

describe('힌트가 있는 LWE (논문 읽기 3)', () => {
  it('힌트가 없으면 18장 추정기와 같다 (ML-KEM-512 β = 406)', () => {
    expect(leakyBeta(512, lq, s, s, 512, none, 4)!.beta).toBe(primalUSVP({ n: 512, logq: lq, sigmaS: s, sigmaE: s, mMax: 512 }, 4)!.beta);
  });
  it('완전 힌트가 늘수록 β 가 줄고, 350 개면 100 아래', () => {
    const bs = [0, 100, 200, 300, 350].map((k) => leakyBeta(512, lq, s, s, 512, { ...none, perfect: k }, 8)!.beta);
    for (let i = 1; i < bs.length; i++) expect(bs[i]).toBeLessThan(bs[i - 1]);
    expect(bs[4]).toBeLessThan(100);
  });
  it('mod 1 힌트와 아주 부정확한 근사 힌트는 효과가 없다', () => {
    const base = leakyBeta(512, lq, s, s, 512, none, 8)!.beta;
    expect(leakyBeta(512, lq, s, s, 512, { ...none, modular: 512, modK: 1 }, 8)!.beta).toBe(base);
    expect(leakyBeta(512, lq, s, s, 512, { ...none, approx: 512, sigmaH: 1e6 }, 8)!.beta).toBe(base);
  });
  it('근사 힌트의 사후 분산은 두 분산의 조화 결합', () => {
    const g = hintedGroups(10, 2, { ...none, approx: 10, sigmaH: 2 });
    expect(g[2].sigma).toBeCloseTo(Math.sqrt(2), 10);
  });
});

describe('ADPS16 재계산 (논문 읽기 2)', () => {
  it('NewHope (n = 1024, q = 12289, σ = √8, m ≤ 2n): primal·dual β 가 960 대, 양자 core-SVP 약 255', () => {
    const P = { n: 1024, logq: Math.log2(12289), sigmaS: Math.sqrt(8), sigmaE: Math.sqrt(8), mMax: 2048 };
    const p = primalUSVP(P, 8)!, d = dualAttack(P, 8)!;
    expect(p.beta).toBeGreaterThan(955); expect(p.beta).toBeLessThan(980);
    expect(d.beta).toBeGreaterThan(950); expect(d.beta).toBeLessThan(975);
    expect(0.265 * p.beta).toBeGreaterThan(252); expect(0.265 * p.beta).toBeLessThan(260);
  });
});
