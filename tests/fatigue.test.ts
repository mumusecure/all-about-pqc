import { describe, expect, it } from 'vitest';
import { fatigueLadder, fatigueLattice, isMonomial, keyCoeff, ternaryKeyGen } from '../src/lib/fatigue';
import { crossingLog2q } from '../src/lib/kf17';
import { mulberry32 } from '../src/lib/lwe';
import { rotate } from '../src/lib/ntru';
import { CROSS, FATIGUE_NS } from '../src/components/FatigueLines';

const SIG = Math.sqrt(2 / 3);

describe('L_key 멤버십', () => {
  const key = ternaryKeyGen(24, 257, mulberry32(7));
  it('키와 회전, 그 결합은 L_key, q-벡터는 아님', () => {
    expect(isMonomial(keyCoeff([...key.g, ...key.f], key)!)).toBe(true);
    const r3 = [...rotate(key.g, 3), ...rotate(key.f, 3)].map((x) => -x);
    expect(isMonomial(keyCoeff(r3, key)!)).toBe(true);
    const comb = [...key.g, ...key.f].map((x, i) => x + r3[i] * 2);
    const a = keyCoeff(comb, key);
    expect(a).not.toBeNull();
    expect(isMonomial(a!)).toBe(false);
    expect(keyCoeff(fatigueLattice(key)[0], key)).toBeNull();
  });
});

describe('작은 n 의 사다리', () => {
  it('n = 24: q = 13 은 바늘, q = 17 은 다발 (DvW q* ≈ 10.7)', () => {
    expect(fatigueLadder(ternaryKeyGen(24, 13, mulberry32(24 * 100000 + 13 * 10 + 2)), 30, 2).event).toBe('SKR');
    const r = fatigueLadder(ternaryKeyGen(24, 17, mulberry32(24 * 100000 + 17 * 10 + 1)), 30, 2);
    expect(r.event).toBe('DSD');
    expect(r.beta).toBe(2);
  });
});

describe('KF 충분조건 표', () => {
  it('위젯의 KF 교차점 표가 라이브러리와 같다 (n ≤ 512)', () => {
    for (const [i, n] of FATIGUE_NS.entries()) {
      if (n > 512) continue;
      expect(crossingLog2q(n, SIG)).toBe(CROSS.tern.kf[i]);
      expect(crossingLog2q(n, 4)).toBe(CROSS.wide.kf[i]);
    }
  });
  it('KF 충분조건은 DvW 예측기보다 위 (보수적)', () => {
    for (const i of FATIGUE_NS.keys()) {
      expect(CROSS.tern.dvw[i]).toBeLessThan(CROSS.tern.kf[i]);
      expect(CROSS.wide.dvw[i]).toBeLessThan(CROSS.wide.kf[i]);
    }
  });
});
