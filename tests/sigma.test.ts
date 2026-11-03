import { describe, expect, it } from 'vitest';
import { extract, keyGen, prove, sign, simulate, verify, verifySig, zDistribution, P_ORD } from '../src/lib/sigma';
import { mulberry32 } from '../src/lib/lwe';

describe('Schnorr Σ-프로토콜', () => {
  it('완전성: 정직한 대화록은 항상 검증을 통과한다', () => {
    const rng = mulberry32(1);
    for (let t = 0; t < 50; t++) {
      const { x, X } = keyGen(rng);
      expect(verify(X, prove(x, 1 + Math.floor(rng() * 232), Math.floor(rng() * P_ORD)))).toBe(true);
    }
  });
  it('특수 건전성: 같은 R, 다른 c 의 두 대화록에서 비밀 x 를 추출 (= 논스 재사용 공격)', () => {
    const rng = mulberry32(2);
    for (let t = 0; t < 30; t++) {
      const { x } = keyGen(rng);
      const k = 1 + Math.floor(rng() * 232);
      const c1 = Math.floor(rng() * P_ORD);
      let c2 = Math.floor(rng() * P_ORD); if (c2 === c1) c2 = (c1 + 1) % P_ORD;
      expect(extract(prove(x, k, c1), prove(x, k, c2))).toBe(x);
    }
  });
  it('HVZK: 시뮬레이터는 비밀 없이도 유효한 대화록을 만든다', () => {
    const rng = mulberry32(3);
    const { X } = keyGen(rng);
    for (let t = 0; t < 30; t++) expect(verify(X, simulate(X, Math.floor(rng() * P_ORD), Math.floor(rng() * P_ORD)))).toBe(true);
  });
  it('Fiat–Shamir 서명: 검증 통과, 메시지를 바꾸면 실패', () => {
    const rng = mulberry32(4);
    const { x, X } = keyGen(rng);
    const sig = sign(x, 77, 'hello');
    expect(verifySig(X, 'hello', sig)).toBe(true);
    expect(verifySig(X, 'hellp', sig)).toBe(false);
  });
});

describe('거절 샘플링', () => {
  it('거절하면 z 의 분포는 비밀 s 와 무관한 균등분포', () => {
    const B = 40, beta = 6;
    const d0 = zDistribution(0, B, beta, true).dist, d5 = zDistribution(5, B, beta, true).dist;
    for (let z = -(B - beta); z <= B - beta; z++) {
      expect(d0.get(z)!).toBeCloseTo(1 / (2 * (B - beta) + 1), 12);
      expect(d5.get(z)!).toBeCloseTo(1 / (2 * (B - beta) + 1), 12);
    }
  });
  it('거절하지 않으면 분포의 폭이 |s| 를 드러낸다', () => {
    const a = zDistribution(0, 40, 6, false).dist, b = zDistribution(5, 40, 6, false).dist;
    expect(Math.max(...a.keys())).toBe(40);
    expect(Math.max(...b.keys())).toBe(45);
  });
  it('수락 확률 ≈ (2(B−β)+1)/(2B+1)', () => {
    const { acceptRate } = zDistribution(6, 40, 6, true);
    expect(acceptRate).toBeCloseTo(69 / 81, 10);
  });
});
