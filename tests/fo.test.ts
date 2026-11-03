import { describe, expect, it } from 'vitest';
import { P, decaps, decrypt, encaps, encrypt, foDecrypt, foEncrypt, keyGen, maul } from '../src/lib/fo';
import { mulberry32 } from '../src/lib/lwe';

const randMsg = (rng: () => number) => Array.from({ length: P.k }, () => (rng() < 0.5 ? 0 : 1));

describe('다중 비트 Regev 와 FO', () => {
  it('정직한 암호화·복호화는 항상 맞는다 (세 방식 모두)', () => {
    const rng = mulberry32(1);
    const { pk, sk } = keyGen(rng);
    for (let t = 0; t < 30; t++) {
      const m = randMsg(rng);
      expect(decrypt(sk, encrypt(pk, m, t + 1))).toEqual(m);
      expect(foDecrypt(pk, sk, foEncrypt(pk, m))).toEqual(m);
      const { c, K } = encaps(pk, rng);
      const d = decaps(pk, sk, c);
      expect(d.rejected).toBe(false);
      expect(d.K).toBe(K);
    }
  });
  it('FO 없는 Regev: 변조 질의 한 번으로 도전 평문 전체를 복구', () => {
    const rng = mulberry32(2);
    const { pk, sk } = keyGen(rng);
    for (let t = 0; t < 20; t++) {
      const m = randMsg(rng);
      const leaked = decrypt(sk, maul(encrypt(pk, m, 99 + t), 0));
      const recovered = leaked.map((x, i) => (i === 0 ? 1 - x : x));
      expect(recovered).toEqual(m);
    }
  });
  it('FO-PKE: 변조된 암호문은 재암호화 검사에서 거부(⊥)된다', () => {
    const rng = mulberry32(3);
    const { pk, sk } = keyGen(rng);
    for (let t = 0; t < 20; t++) {
      const c = foEncrypt(pk, randMsg(rng));
      for (let j = 0; j < 4; j++) expect(foDecrypt(pk, sk, maul(c, j))).toBeNull();
    }
  });
  it('FO-KEM(암묵적 거부): 변조 질의는 거부되고, 돌려받는 키는 진짜 키와 무관하며 같은 입력엔 같은 값', () => {
    const rng = mulberry32(4);
    const { pk, sk } = keyGen(rng);
    const { c, K } = encaps(pk, rng);
    const c2 = maul(c, 3);
    const r1 = decaps(pk, sk, c2), r2 = decaps(pk, sk, c2);
    expect(r1.rejected).toBe(true);
    expect(r1.K).not.toBe(K);
    expect(r1.K).toBe(r2.K); // 결정적: 거부 여부가 타이밍 외의 출력으로 드러나지 않게
  });
});
