import { describe, expect, it } from 'vitest';
import {
  N, PARAMS, Q, decompose, expectedRepetitions, highBits, keyGen, lowBits, makeHint, ntt, nttInv, power2Round,
  sampleInBall, sign, sizes, useHint, verify,
} from '../src/lib/mldsa';
import { modPow } from '../src/lib/algebra';
import { mulberry32 } from '../src/lib/lwe';

const md = (x: number) => ((x % Q) + Q) % Q;
function schoolbook(f: number[], g: number[]): number[] {
  const h = new Array(N).fill(0);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const p = md(f[i] * g[j]);
    if (i + j < N) h[i + j] = md(h[i + j] + p); else h[i + j - N] = md(h[i + j - N] - p);
  }
  return h;
}

describe('환과 NTT (q = 8380417)', () => {
  it('q = 2²³ − 2¹³ + 1, 1753 은 원시 512 제곱근', () => {
    expect(Q).toBe(2 ** 23 - 2 ** 13 + 1);
    expect((Q - 1) % 512).toBe(0);
    expect(modPow(1753, 256, Q)).toBe(Q - 1);
  });
  it('NTT⁻¹(NTT(f)) = f, NTT 곱 = negacyclic 곱', () => {
    const r = mulberry32(3);
    const f = Array.from({ length: N }, () => Math.floor(r() * Q)), g = Array.from({ length: N }, () => Math.floor(r() * Q));
    expect(nttInv(ntt(f))).toEqual(f);
    const fg = nttInv(ntt(f).map((x, i) => md(x * ntt(g)[i])));
    expect(fg).toEqual(schoolbook(f, g));
  });
});

describe('반올림 도구', () => {
  it('Power2Round: r = r₁·2¹³ + r₀', () => {
    const r = mulberry32(4);
    for (let t = 0; t < 1000; t++) {
      const x = Math.floor(r() * Q), [r1, r0] = power2Round(x);
      expect(md(r1 * 8192 + r0)).toBe(x);
      expect(Math.abs(r0)).toBeLessThanOrEqual(4096);
    }
  });
  it('Decompose: 본문 예 r = 1000000 (γ₂ = (q−1)/32) → (2, −47552)', () => {
    expect(decompose(1000000, (Q - 1) / 32)).toEqual([2, -47552]);
  });
  it('|LowBits(w − v)| < γ₂ − β, ‖v‖ ≤ β 이면 HighBits(w − v) = HighBits(w) 가 되도록 하는 조건 확인', () => {
    const g2 = (Q - 1) / 88, b = 78, r = mulberry32(5);
    let checked = 0;
    for (let t = 0; t < 5000; t++) {
      const w = Math.floor(r() * Q), v = Math.floor(r() * (2 * b + 1)) - b;
      if (Math.abs(lowBits(md(w - v), g2)) < g2 - b) { expect(highBits(md(w - v), g2)).toBe(highBits(w, g2)); checked++; }
    }
    expect(checked).toBeGreaterThan(4000);
  });
  it('UseHint(MakeHint(z, r), r) = HighBits(r + z)  (|z| ≤ γ₂)', () => {
    for (const g2 of [(Q - 1) / 88, (Q - 1) / 32]) {
      const r = mulberry32(6);
      for (let t = 0; t < 3000; t++) {
        const x = Math.floor(r() * Q), z = Math.floor(r() * (2 * g2 + 1)) - g2;
        expect(useHint(makeHint(md(z), x, g2), x, g2)).toBe(highBits(md(x + z), g2));
      }
    }
  });
  it('SampleInBall: 정확히 τ 개의 ±1', () => {
    const c = sampleInBall(123, 39);
    expect(c.filter((x) => x !== 0).length).toBe(39);
    expect(c.every((x) => x === 0 || x === 1 || x === Q - 1)).toBe(true);
  });
});

describe('크기와 반복 횟수', () => {
  it('FIPS 204 표의 pk / sk / sig 바이트 수', () => {
    expect(sizes(PARAMS['ML-DSA-44'])).toEqual({ pk: 1312, sk: 2560, sig: 2420 });
    expect(sizes(PARAMS['ML-DSA-65'])).toEqual({ pk: 1952, sk: 4032, sig: 3309 });
    expect(sizes(PARAMS['ML-DSA-87'])).toEqual({ pk: 2592, sk: 4896, sig: 4627 });
  });
  it('기대 반복 횟수 4.25 / 5.1 / 3.85', () => {
    expect(expectedRepetitions(PARAMS['ML-DSA-44'])).toBeCloseTo(4.25, 1);
    expect(expectedRepetitions(PARAMS['ML-DSA-65'])).toBeCloseTo(5.1, 1);
    expect(expectedRepetitions(PARAMS['ML-DSA-87'])).toBeCloseTo(3.85, 1);
  });
});

describe('서명 · 검증 (토이 해시, 실제 산술)', () => {
  it('세 파라미터 모두 서명이 검증되고, 메시지나 z 를 바꾸면 거부된다', () => {
    for (const P of Object.values(PARAMS)) {
      const r = mulberry32(P.k * 10 + P.l);
      const key = keyGen(P, r);
      const { sig } = sign(key, 42, r);
      expect(verify(key, 42, sig)).toBe(true);
      expect(verify(key, 43, sig)).toBe(false);
      const z2 = sig.z.map((p) => p.slice()); z2[0][0] = md(z2[0][0] + 1);
      expect(verify(key, 42, { ...sig, z: z2 })).toBe(false);
    }
  });
  it('관측한 평균 반복 횟수가 이론값 근처 (ML-DSA-44, 서명 60 개)', () => {
    const P = PARAMS['ML-DSA-44'], r = mulberry32(77), key = keyGen(P, r);
    let tot = 0;
    for (let i = 0; i < 60; i++) tot += sign(key, i, r).attempts.length + 1;
    const avg = tot / 60;
    expect(avg).toBeGreaterThan(expectedRepetitions(P) * 0.65);
    expect(avg).toBeLessThan(expectedRepetitions(P) * 1.45);
  });
});
