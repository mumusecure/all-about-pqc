import { describe, expect, it } from 'vitest';
import { betaKF, crossingLog2q, log2VolKey2, marginKF } from '../src/lib/kf17';
import { deltaBeta } from '../src/lib/bkz';
import { log2Fatigue } from '../src/lib/ntruattack';

const s = Math.sqrt(2 / 3);
function bruteBeta(n: number, lq: number) {
  const v2 = log2VolKey2(n, s);
  for (let b = 50; b <= 2 * n; b++) for (let k = 2; k <= n; k++) if (marginKF(lq, k, deltaBeta(b), v2) >= 0) return b;
  return null;
}

describe('KF17 충분조건 (논문 읽기 4)', () => {
  it('빠른 탐색이 전수 탐색과 같은 β 를 준다', () => {
    for (const lq of [16, 20, 26, 32]) expect(betaKF(256, lq, s)?.beta ?? null).toBe(bruteBeta(256, lq));
  });
  it('q 가 커질수록 필요한 β 가 줄어든다', () => {
    const bs = [20, 24, 28].map((lq) => betaKF(512, lq, s)!.beta);
    expect(bs[1]).toBeLessThan(bs[0]); expect(bs[2]).toBeLessThan(bs[1]);
  });
  it('uSVP 와 같아지는 log q 는 DvW 피로점보다 위 (충분조건은 보수적)', () => {
    const c512 = crossingLog2q(512, s)!, c1024 = crossingLog2q(1024, s)!;
    expect(c512).toBeGreaterThan(22); expect(c512).toBeLessThan(24.5);
    expect(c1024).toBeGreaterThan(25.5); expect(c1024).toBeLessThan(27.5);
    expect(c512 - log2Fatigue(512)).toBeGreaterThan(7);
  });
});
