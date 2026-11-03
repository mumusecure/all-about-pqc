import { describe, expect, it } from 'vitest';
import { type B2, type V2, bimodalM, bimodalTry, covariance, nearestPlane, roundOff, solveAlpha, unimodalM, unimodalTry } from '../src/lib/sigs';
import { mulberry32 } from '../src/lib/lwe';

describe('가우시안 거절 샘플링', () => {
  it('Lyubashevsky 2012 의 고전적 예: α = 12 이면 M ≈ e^{1 + 1/288} ≈ 2.73', () => {
    expect(unimodalM(12)).toBeCloseTo(Math.exp(1 + 1 / 288), 6);
  });
  it('같은 M = 3 을 얻는 σ/‖v‖: 한쪽 이동 ≈ 11, 바이모달 ≈ 0.67', () => {
    expect(solveAlpha(unimodalM, 3)).toBeGreaterThan(10.5);
    expect(solveAlpha(unimodalM, 3)).toBeLessThan(11.5);
    expect(solveAlpha(bimodalM, 3)).toBeCloseTo(1 / Math.sqrt(2 * Math.log(3)), 3);
  });
  it('바이모달: 받아들인 표본은 평균 0, 분산 σ², 수락률 1/M', () => {
    const r = mulberry32(1), sigma = 1, v = 1.2;
    const acc: number[] = [];
    const T = 40000;
    for (let i = 0; i < T; i++) { const z = bimodalTry(r, sigma, v); if (z !== null) acc.push(z); }
    const mean = acc.reduce((s, x) => s + x, 0) / acc.length, vr = acc.reduce((s, x) => s + x * x, 0) / acc.length;
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(vr).toBeGreaterThan(0.95); expect(vr).toBeLessThan(1.05);
    expect(acc.length / T).toBeCloseTo(1 / bimodalM(sigma / v), 1);
  });
  it('한쪽 이동: 받아들인 표본의 평균이 0 근처 (이동 v 가 지워진다)', () => {
    const r = mulberry32(2), sigma = 12, v = 1;
    const acc: number[] = [];
    for (let i = 0; i < 40000; i++) { const z = unimodalTry(r, sigma, v); if (z !== null) acc.push(z); }
    expect(Math.abs(acc.reduce((s, x) => s + x, 0) / acc.length)).toBeLessThan(0.25);
  });
});

describe('2차원 hash-and-sign 의 누출', () => {
  const B: B2 = [[6, 1], [2, 5]];
  const targets = (n: number, seed: number): V2[] => { const r = mulberry32(seed); return Array.from({ length: n }, () => [r() * 200, r() * 200] as V2); };
  it('Babai 반올림: 공분산 ≈ BᵀB / 12 (비밀 기저의 모양이 샌다)', () => {
    const pts = targets(20000, 3).map((t) => { const v = roundOff(B, t); return [t[0] - v[0], t[1] - v[1]] as V2; });
    const c = covariance(pts);
    const G = [(36 + 4) / 12, (6 + 10) / 12, (1 + 25) / 12];
    expect(c.a).toBeCloseTo(G[0], 0); expect(c.b).toBeCloseTo(G[1], 0); expect(c.d).toBeCloseTo(G[2], 0);
  });
  it('Klein 샘플러: 공분산이 거의 등방 (고윳값 비 ≈ 1)', () => {
    const r = mulberry32(4);
    const pts = targets(8000, 5).map((t) => { const v = nearestPlane(B, t, r, 14); return [t[0] - v[0], t[1] - v[1]] as V2; });
    const c = covariance(pts);
    expect(c.l1 / c.l2).toBeLessThan(1.15);
  });
});
