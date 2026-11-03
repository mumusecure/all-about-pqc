import { describe, expect, it } from 'vitest';
import {
  FIPS_LOG2_DELTA, N, PARAMS, Q, compress, compressError, decompress, decryptionNoise, kpkeDecrypt, kpkeEncrypt,
  kpkeKeyGen, log2FailureProb, mulNTT, noisePMF, noiseVariance, ntt, nttInv, sizes,
} from '../src/lib/mlkem';
import { modPow, polyMulNegacyclic } from '../src/lib/algebra';
import { mulberry32 } from '../src/lib/lwe';
import { variance } from '../src/lib/prob';

describe('환과 NTT', () => {
  it('17 은 원시 256 제곱근: 17¹²⁸ ≡ −1 (mod 3329), 512 제곱근은 없다', () => {
    expect(modPow(17, 128, Q)).toBe(Q - 1);
    expect((Q - 1) % 256).toBe(0);
    expect((Q - 1) % 512).not.toBe(0);
  });
  it('NTT⁻¹(NTT(f)) = f', () => {
    const r = mulberry32(1);
    const f = Array.from({ length: N }, () => Math.floor(r() * Q));
    expect(nttInv(ntt(f))).toEqual(f);
  });
  it('NTT 곱 = X²⁵⁶ + 1 에서의 교과서식 곱', () => {
    const r = mulberry32(2);
    const f = Array.from({ length: N }, () => Math.floor(r() * Q)), g = Array.from({ length: N }, () => Math.floor(r() * Q));
    expect(nttInv(mulNTT(ntt(f), ntt(g)))).toEqual(polyMulNegacyclic(f, g, Q));
  });
});

describe('압축', () => {
  it('왕복 오차 ≤ ⌈q / 2^{d+1}⌋', () => {
    for (let d = 1; d <= 11; d++) {
      let mx = 0;
      for (let x = 0; x < Q; x++) mx = Math.max(mx, Math.abs(compressError(x, d)));
      expect(mx).toBe(Math.round(Q / 2 ** (d + 1)));
    }
  });
  it('본문 예: Compress₄(1000) = 5, Decompress₄(5) = 1040', () => {
    expect(compress(1000, 4)).toBe(5);
    expect(decompress(5, 4)).toBe(1040);
    expect(decompress(1, 1)).toBe(1665);
  });
});

describe('크기', () => {
  it('FIPS 203 의 ek / dk / ct 바이트 수', () => {
    expect(sizes(PARAMS['ML-KEM-512'])).toEqual({ ek: 800, dk: 1632, ct: 768 });
    expect(sizes(PARAMS['ML-KEM-768'])).toEqual({ ek: 1184, dk: 2400, ct: 1088 });
    expect(sizes(PARAMS['ML-KEM-1024'])).toEqual({ ek: 1568, dk: 3168, ct: 1568 });
  });
});

describe('K-PKE (토이 난수, 실제 산술)', () => {
  it('세 파라미터 모두 복호가 정확하고 잡음이 q/4 보다 훨씬 작다', () => {
    for (const P of Object.values(PARAMS)) {
      const r = mulberry32(P.k);
      const key = kpkeKeyGen(P, r);
      for (let t = 0; t < 3; t++) {
        const bits = Array.from({ length: N }, () => (r() < 0.5 ? 1 : 0));
        const { w, bits: out } = kpkeDecrypt(key, kpkeEncrypt(key, bits, r));
        expect(out).toEqual(bits);
        expect(Math.max(...decryptionNoise(w, bits).map(Math.abs))).toBeLessThan(Q / 8);
      }
    }
  });
  it('잡음을 키우면(η₁ = 20, dv = 3) 복호가 실제로 틀린다', () => {
    const P = { k: 3, eta1: 20, eta2: 2, du: 10, dv: 3 };
    const r = mulberry32(9);
    const key = kpkeKeyGen(P, r);
    let wrong = 0;
    for (let t = 0; t < 4; t++) {
      const bits = Array.from({ length: N }, () => (r() < 0.5 ? 1 : 0));
      const out = kpkeDecrypt(key, kpkeEncrypt(key, bits, r)).bits;
      wrong += out.filter((b, i) => b !== bits[i]).length;
    }
    expect(wrong).toBeGreaterThan(0);
  });
});

describe('복호 실패 확률', () => {
  it('정확 계산이 FIPS 203 의 값과 0.6 비트 안에서 일치', () => {
    for (const [name, P] of Object.entries(PARAMS)) {
      const l = log2FailureProb(P);
      expect(Math.abs(l - FIPS_LOG2_DELTA[name as keyof typeof FIPS_LOG2_DELTA])).toBeLessThan(0.6);
    }
  });
  it('이론 분산 = PMF 의 분산', () => {
    const P = PARAMS['ML-KEM-768'];
    expect(variance(noisePMF(P)) / noiseVariance(P)).toBeCloseTo(1, 4);
  });
});
