import { describe, expect, it } from 'vitest';
import { boostingCurve, recoverCoeff, secretOf, tvla, zeroOracle } from '../src/lib/sidechannel';
import { FIPS_LOG2_DELTA, PARAMS, kpkeKeyGen } from '../src/lib/mlkem';
import { mulberry32 } from '../src/lib/lwe';

describe('failure boosting 모델', () => {
  it('부스팅 없이 평균한 δ 가 FIPS 값과 4 비트 안 (가우시안 근사)', () => {
    for (const k of ['ML-KEM-512', 'ML-KEM-768'] as const) {
      const r = boostingCurve(PARAMS[k]);
      expect(Math.abs(r.log2Delta - FIPS_LOG2_DELTA[k])).toBeLessThan(4);
    }
  });
  it('임계값을 올리면 질의 수는 줄고 총 작업량은 는다', () => {
    const { pts } = boostingCurve(PARAMS['ML-KEM-768']);
    const lo = pts[0], hi = pts[pts.length - 1];
    expect(hi.log2Q).toBeLessThan(lo.log2Q);
    expect(hi.log2Work).toBeGreaterThan(lo.log2Work);
    // 질의 2^64 로 실패를 하나 얻으려면 작업량이 천문학적
    const feasible = pts.filter((p) => p.log2Q <= 64);
    expect(feasible.every((p) => p.log2Work > 400)).toBe(true);
  });
});

describe('평문 확인 오라클 공격 (실제 크기 K-PKE)', () => {
  it('ML-KEM-512 의 비밀 다항식 하나(256 계수)를 계수당 3 질의 이하로 정확히 복원', () => {
    const P = PARAMS['ML-KEM-512'];
    const key = kpkeKeyGen(P, mulberry32(5));
    const truth = secretOf(key), o = zeroOracle(key);
    let q = 0;
    for (let j = 0; j < 256; j++) {
      const r = recoverCoeff(P, o, 0, j);
      expect(r.s).toBe(truth[0][j]);
      q += r.queries;
    }
    expect(q).toBeLessThanOrEqual(3 * 256);
  });
  it('ML-KEM-768 (η = 2) 에서도', () => {
    const P = PARAMS['ML-KEM-768'];
    const key = kpkeKeyGen(P, mulberry32(6));
    const truth = secretOf(key), o = zeroOracle(key);
    for (let j = 0; j < 40; j++) expect(recoverCoeff(P, o, 2, j).s).toBe(truth[2][j]);
  });
});

describe('TVLA t-검정', () => {
  it('누출이 있으면 표본이 늘수록 |t| 가 4.5 를 넘고, 없으면 넘지 않는다', () => {
    const r = mulberry32(7);
    expect(Math.abs(tvla(r, 50000, 0.1, 1))).toBeGreaterThan(4.5);
    expect(Math.abs(tvla(r, 50000, 0, 1))).toBeLessThan(4.5);
  });
});
