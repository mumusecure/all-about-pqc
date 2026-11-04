import { describe, expect, it } from 'vitest';
import { isInvertible, jlRatios, nonInvertibleRate, rewindExtract, sigmaKey, sternInstance, sternRound } from '../src/lib/zk';
import { mulberry32 } from '../src/lib/lwe';

describe('Stern 식 프로토콜', () => {
  const I = sternInstance(64, 16, 257, 12, 1);
  it('정직한 증명자는 세 도전 모두 통과', () => {
    const r = mulberry32(2);
    for (const ch of [1, 2, 3]) for (let t = 0; t < 5; t++) expect(sternRound(I, 'honest', r, ch).ok).toBe(true);
  });
  it('가짜 이진 비밀: 도전 1, 3 통과 / 2 실패. 식만 맞는 비밀: 2, 3 통과 / 1 실패', () => {
    const r = mulberry32(3);
    expect(sternRound(I, 'cheat-weight', r, 1).ok).toBe(true);
    expect(sternRound(I, 'cheat-weight', r, 3).ok).toBe(true);
    expect(sternRound(I, 'cheat-weight', r, 2).ok).toBe(false);
    expect(sternRound(I, 'cheat-equation', r, 2).ok).toBe(true);
    expect(sternRound(I, 'cheat-equation', r, 3).ok).toBe(true);
    expect(sternRound(I, 'cheat-equation', r, 1).ok).toBe(false);
  });
  it('속이는 증명자의 통과율 ≈ 2/3', () => {
    const r = mulberry32(4);
    let pass = 0; const T = 3000;
    for (let t = 0; t < T; t++) pass += sternRound(I, 'cheat-weight', r).ok ? 1 : 0;
    expect(pass / T).toBeGreaterThan(0.62); expect(pass / T).toBeLessThan(0.71);
  });
});

describe('Lyubashevsky Σ 와 되감기 추출', () => {
  it('추출한 (s̄, c̄) 가 a·s̄₁ + s̄₂ = c̄·t 를 만족하고, s̄ = c̄·s 라 짧다', () => {
    const K = sigmaKey(64, 12289, 5);
    const e = rewindExtract(K, 2000, 16, 6)!;
    expect(e.relationHolds).toBe(true);
    expect(e.sbInf).toBeLessThanOrEqual(2 * 16);
    expect(e.sbInf).toBeLessThan(e.guarantee);
  });
});

describe('도전 차이의 가역성', () => {
  it('q = 257 (64 개로 완전 분해) 에서는 비가역 차이가 흔하고, q = 4093 (≡ 5 mod 8, 2 개로 분해) 에서는 없다', () => {
    expect(nonInvertibleRate(64, 257, 8, 400, 1)).toBeGreaterThan(0.05);
    expect(nonInvertibleRate(64, 4093, 8, 400, 2)).toBe(0);
    expect(isInvertible([1, 1, ...new Array(62).fill(0)], 12289)).toBe(true);
  });
});

describe('JL 사영', () => {
  it('‖Πw‖² / ‖w‖² 의 평균 ≈ 128', () => {
    const w = Array.from({ length: 256 }, (_, i) => ((i * 37) % 11) - 5);
    const rs = jlRatios(w, 200, 7);
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
    expect(mean).toBeGreaterThan(120); expect(mean).toBeLessThan(136);
    expect(Math.min(...rs)).toBeGreaterThan(30);
  });
});
