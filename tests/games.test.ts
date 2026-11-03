import { describe, expect, it } from 'vitest';
import { birthdayTrial, playIND, solveNoiseless } from '../src/lib/games';
import { mulberry32, sampleLWE } from '../src/lib/lwe';

describe('IND 게임', () => {
  it('결정적 암호화는 재암호화 공격에 이득 1/2 (IND-CPA 불가능)', () => {
    expect(playIND('det', 'reencrypt', 'cpa', 300, 1).advantage).toBeCloseTo(0.5, 5);
  });
  it('Regev(노이즈 있음)에 대한 무작위 추측·재암호화·가우스 소거는 이득 ≈ 0', () => {
    for (const adv of ['guess', 'reencrypt', 'solve'] as const) {
      const r = playIND('regev', adv, 'cpa', 400, 7);
      expect(r.advantage).toBeLessThan(3 * r.ci95);
    }
  });
  it('노이즈 없는 Regev 는 가우스 소거로 완전히 깨진다', () => {
    expect(playIND('regev0', 'solve', 'cpa', 200, 3).advantage).toBeCloseTo(0.5, 5);
  });
  it('Regev 는 IND-CCA 가 아니다: 변조 공격이 이득 1/2', () => {
    expect(playIND('regev', 'maul', 'cca', 200, 5).advantage).toBeCloseTo(0.5, 5);
    // 같은 공격도 CPA 게임(복호 오라클 없음)에서는 쓸 수 없다
    expect(playIND('regev', 'maul', 'cpa', 400, 5).advantage).toBeLessThan(0.15);
  });
  it('가우스 소거는 노이즈가 있으면 실패(null)하고, 없으면 비밀을 정확히 찾는다', () => {
    const noisy = sampleLWE({ n: 8, m: 24, q: 257, sigma: 1.5, secret: 'uniform' }, mulberry32(1));
    expect(solveNoiseless(noisy.A, noisy.b, 257)).toBeNull();
    const clean = sampleLWE({ n: 8, m: 24, q: 257, sigma: 0, secret: 'uniform' }, mulberry32(2));
    expect(solveNoiseless(clean.A, clean.b, 257)).toEqual(clean.s.map((x) => ((x % 257) + 257) % 257));
  });
});

describe('생일 공격', () => {
  it('t 비트 해시의 충돌까지 평균 질의 수 ≈ √(π/2 · 2^t)', () => {
    for (const t of [12, 16, 20]) {
      const T = 200;
      let s = 0;
      for (let i = 0; i < T; i++) s += birthdayTrial(t, i + 1);
      const avg = s / T, pred = Math.sqrt((Math.PI / 2) * 2 ** t);
      expect(avg / pred).toBeGreaterThan(0.85);
      expect(avg / pred).toBeLessThan(1.15);
    }
  });
});
