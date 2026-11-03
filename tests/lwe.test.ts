import { describe, expect, it } from 'vitest';
import {
  centerMod, embeddingAttack, embeddingBasis, mod, mulberry32, regevDecrypt, regevEncrypt, regevKeyGen, sampleLWE,
} from '../src/lib/lwe';
import { detInt } from '../src/lib/lattice';

describe('mod 유틸', () => {
  it('centerMod 는 (−q/2, q/2] 범위', () => {
    for (let x = -300; x <= 300; x++) {
      const c = centerMod(x, 97);
      expect(c).toBeGreaterThan(-97 / 2);
      expect(c).toBeLessThanOrEqual(97 / 2);
      expect(mod(c - x, 97)).toBe(0);
    }
  });
});

describe('Regev 암호', () => {
  it('작은 오차에서는 항상 올바르게 복호된다', () => {
    const rng = mulberry32(42);
    const params = { n: 16, m: 64, q: 3329, sigma: 1.5 };
    const { pk, sk } = regevKeyGen(params, rng);
    for (let t = 0; t < 400; t++) {
      const bit = (t % 2) as 0 | 1;
      expect(regevDecrypt(sk, regevEncrypt(pk, bit, rng), params.q)).toBe(bit);
    }
  });

  it('오차가 크면 복호 실패가 생긴다', () => {
    const rng = mulberry32(7);
    const params = { n: 16, m: 64, q: 97, sigma: 8 };
    const { pk, sk } = regevKeyGen(params, rng);
    let fail = 0;
    for (let t = 0; t < 400; t++) {
      const bit = (t % 2) as 0 | 1;
      if (regevDecrypt(sk, regevEncrypt(pk, bit, rng), params.q) !== bit) fail++;
    }
    expect(fail).toBeGreaterThan(40);
  });
});

describe('임베딩 공격', () => {
  it('기저는 정방·정칙이고 부피는 q^m', () => {
    const rng = mulberry32(3);
    const inst = sampleLWE({ n: 3, m: 4, q: 17, sigma: 1 }, rng);
    const B = embeddingBasis(inst, 17);
    expect(B.length).toBe(8);
    expect(Math.abs(detInt(B))).toBe(17 ** 4);
  });

  it('작은 n 에서는 LLL 만으로 비밀을 복구한다', () => {
    let ok = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const inst = sampleLWE({ n: 10, m: 20, q: 97, sigma: 1 }, mulberry32(seed));
      if (embeddingAttack(inst).success) ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(9);
  });
});
