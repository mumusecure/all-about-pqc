import { describe, expect, it } from 'vitest';
import { cabs, cmul, embed, fieldNorm, galois, quadIdeals, trace } from '../src/lib/numfield';
import { polyMulNegacyclic } from '../src/lib/algebra';
import { rotate } from '../src/lib/ntru';
import { detInt } from '../src/lib/lattice';
import { mulberry32 } from '../src/lib/lwe';

const rnd = (n: number, s: number) => { const r = mulberry32(s); return Array.from({ length: n }, () => Math.floor(r() * 7) - 3); };
// 정수 위의 negacyclic 곱 (mod 없이): 큰 소수로 계산 후 중심화
const mulZ = (a: number[], b: number[]) => {
  const n = a.length, h = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const k = i + j; if (k < n) h[k] += a[i] * b[j]; else h[k - n] -= a[i] * b[j]; }
  return h;
};

describe('정규 임베딩 (xⁿ+1)', () => {
  it('곱셈은 좌표별 곱: σ(ab) = σ(a)⊙σ(b)', () => {
    for (const n of [4, 8, 16]) {
      const a = rnd(n, n), b = rnd(n, n + 1);
      const ab = embed(mulZ(a, b)), ea = embed(a), eb = embed(b);
      ab.forEach((z, j) => { const w = cmul(ea[j], eb[j]); expect(z[0]).toBeCloseTo(w[0], 8); expect(z[1]).toBeCloseTo(w[1], 8); });
    }
  });
  it('기하: ‖σ(a)‖₂ = √n·‖a‖₂ (2의 거듭제곱 원분체)', () => {
    for (const n of [4, 8, 32]) {
      const a = rnd(n, 3 * n);
      const lhs = Math.sqrt(embed(a).reduce((s, z) => s + cabs(z) ** 2, 0));
      expect(lhs).toBeCloseTo(Math.sqrt(n) * Math.hypot(...a), 8);
    }
  });
  it('노름 N(a) = ∏σ_j(a) = det(곱셈 행렬) 이고 곱셈적', () => {
    for (const n of [4, 8]) {
      const a = rnd(n, 5 * n), b = rnd(n, 5 * n + 1);
      const M = Array.from({ length: n }, (_, i) => rotate(a, i));
      expect(Math.round(fieldNorm(a))).toBe(detInt(M));
      expect(Math.round(fieldNorm(mulZ(a, b)))).toBe(Math.round(fieldNorm(a)) * Math.round(fieldNorm(b)));
    }
  });
  it('대각합 Tr(a) = n·a₀', () => {
    const a = rnd(8, 99);
    expect(trace(a)).toBeCloseTo(8 * a[0], 8);
  });
  it('갈루아 자기동형 x ↦ x^k 는 임베딩을 치환하고 노름을 보존', () => {
    const a = rnd(8, 7);
    for (const k of [3, 5, 7, 15]) {
      expect(Math.round(fieldNorm(galois(a, k)))).toBe(Math.round(fieldNorm(a)));
      const s1 = embed(a).map(cabs).sort(), s2 = embed(galois(a, k)).map(cabs).sort();
      s1.forEach((v, i) => expect(v).toBeCloseTo(s2[i], 8));
    }
  });
  it('mod q 곱셈과 정수 곱셈의 일관성', () => {
    const a = rnd(8, 1), b = rnd(8, 2), q = 257;
    expect(polyMulNegacyclic(a.map((x) => (x + q) % q), b.map((x) => (x + q) % q), q)).toEqual(mulZ(a, b).map((x) => ((x % q) + q) % q));
  });
});

describe('2차 수체의 이데알', () => {
  it('이데알 격자의 지표 = 이데알의 노름 (|det 기저| = N(I))', () => {
    for (const I of quadIdeals) expect(Math.abs(I.basis[0][0] * I.basis[1][1] - I.basis[0][1] * I.basis[1][0])).toBe(I.norm);
  });
  it('ℤ[√−5] 에는 노름 2 인 원소가 없다 → (2, 1+√−5) 는 주이데알이 아님', () => {
    let found = false;
    for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) if (x * x + 5 * y * y === 2) found = true;
    expect(found).toBe(false);
  });
  it('6 = 2·3 = (1+√−5)(1−√−5)', () => {
    // (1+√−5)(1−√−5) = 1 + 5
    expect(1 * 1 + 5 * 1 * 1).toBe(6);
  });
});
