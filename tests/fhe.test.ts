import { describe, expect, it } from 'vitest';
import {
  BFV_DEFAULT, bfvAdd, bfvDecrypt, bfvEncrypt, bfvKeyGen, bfvMul, bfvMulPlain, ckksDecrypt, ckksEncrypt, ckksKeyGen, ckksKeyRecovery,
  combine, invq, mulq, noiseBudget, partialDecrypt, shareRecovery, thresholdEncrypt, thresholdKeyGen,
} from '../src/lib/fhe';
import { mulberry32 } from '../src/lib/lwe';

const n = BFV_DEFAULT.n, t = BFV_DEFAULT.t;
const rnd = (seed: number) => { const r = mulberry32(seed); return Array.from({ length: n }, () => BigInt(Math.floor(r() * Number(t)))); };

describe('BFV', () => {
  const K = bfvKeyGen(BFV_DEFAULT, 1);
  it('암호화·복호, 덧셈, 평문 곱', () => {
    const m1 = rnd(2), m2 = rnd(3);
    const c1 = bfvEncrypt(K, m1, 4), c2 = bfvEncrypt(K, m2, 5);
    expect(bfvDecrypt(K, c1)).toEqual(c1.m);
    expect(bfvDecrypt(K, bfvAdd(K, c1, c2))).toEqual(bfvAdd(K, c1, c2).m);
    expect(bfvDecrypt(K, bfvMulPlain(K, c1, m2))).toEqual(bfvMulPlain(K, c1, m2).m);
  });
  it('곱셈(재선형화 포함)이 맞고, 곱할 때마다 잡음 예산이 줄다가 결국 틀린다', () => {
    let c = bfvEncrypt(K, rnd(6), 7);
    const budgets = [noiseBudget(K, c).budget];
    let firstWrong = -1;
    for (let d = 1; d <= 8; d++) {
      c = bfvMul(K, c, bfvEncrypt(K, rnd(10 + d), 20 + d));
      budgets.push(noiseBudget(K, c).budget);
      const ok = bfvDecrypt(K, c).every((x, i) => x === c.m[i]);
      if (!ok && firstWrong < 0) firstWrong = d;
      if (budgets[d] > 0) expect(ok).toBe(true);
    }
    for (let d = 1; d < budgets.length; d++) if (budgets[d - 1] > 0) expect(budgets[d]).toBeLessThan(budgets[d - 1]);
    expect(firstWrong).toBeGreaterThan(1);
  });
});

describe('CKKS 식 복호 결과로 키 복원 (Li–Micciancio)', () => {
  const K = ckksKeyGen(16, 3);
  const z = Array.from({ length: 16 }, (_, i) => Math.sin(i) * 3);
  const c = ckksEncrypt(K, z, 4);
  it('복호 값은 z 에 가깝다(근사)', () => {
    const zp = ckksDecrypt(K, c, 0n, 5);
    zp.forEach((x, i) => expect(Math.abs(x - z[i])).toBeLessThan(1e-4));
  });
  it('잡음 범람이 없으면 복호 결과 하나로 s 가 정확히 나오고, 범람하면 실패', () => {
    expect(ckksKeyRecovery(K, c, ckksDecrypt(K, c, 0n, 6))!.correct).toBe(true);
    expect(ckksKeyRecovery(K, c, ckksDecrypt(K, c, 1n << 30n, 7))!.correct).toBe(false);
  });
});

describe('문턱 복호', () => {
  const T = thresholdKeyGen(3, 8);
  const m = rnd(9), c = thresholdEncrypt(T, m, 10);
  it('세 부분 복호를 합치면 평문', () => {
    const parts = [0, 1, 2].map((i) => partialDecrypt(T, c, i, 1n << 20n, 11 + i));
    expect(combine(T, c, parts)).toEqual(m);
  });
  it('smudging 이 없으면 부분 복호 하나로 그 몫이 드러나고, 있으면 안 드러난다', () => {
    expect(shareRecovery(T, c, partialDecrypt(T, c, 0, 0n, 20), 0)).toBe(true);
    expect(shareRecovery(T, c, partialDecrypt(T, c, 0, 1n << 20n, 21), 0)).toBe(false);
  });
  it('smudging 이 너무 크면 복호가 틀린다', () => {
    const parts = [0, 1, 2].map((i) => partialDecrypt(T, c, i, 1n << 57n, 30 + i));
    expect(combine(T, c, parts)).not.toEqual(m);
  });
  it('역원 계산', () => {
    const a = c.c1, inv = invq(a, T.q)!;
    expect(mulq(a, inv, T.q)).toEqual([1n, ...new Array(15).fill(0n)]);
  });
});
