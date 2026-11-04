import { describe, expect, it } from 'vitest';
import { hex, lamportForge, lamportKeyGen, lamportKnowledge, lamportSign, lamportVerify, sha256, utf8, wotsParams } from '../src/lib/hashsig';
import { publicEval, uovKeyGen, uovSign } from '../src/lib/uov';

describe('SHA-256', () => {
  it('표준 시험 벡터', () => {
    expect(hex(sha256(utf8('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(hex(sha256(utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hex(sha256(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });
});

describe('Lamport', () => {
  const K = lamportKeyGen('seed');
  it('서명·검증, 다른 메시지는 거부', () => {
    const s = lamportSign(K, 'hello');
    expect(lamportVerify(K.pk, 'hello', s)).toBe(true);
    expect(lamportVerify(K.pk, 'hellp', s)).toBe(false);
  });
  it('서명 k 개를 보면 위조 작업량 ≈ 2^{256/2^{k−1}}', () => {
    const msgs = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'];
    expect(lamportKnowledge(msgs.slice(0, 1)).log2Work).toBe(256);
    const w2 = lamportKnowledge(msgs.slice(0, 2)).log2Work;
    expect(w2).toBeGreaterThan(100); expect(w2).toBeLessThan(156);
    const w6 = lamportKnowledge(msgs).log2Work;
    expect(w6).toBeLessThan(20);
  });
  it('여섯 번 재사용하면 실제로 위조가 된다', () => {
    const msgs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const f = lamportForge(K, msgs, 1 << 15);
    expect(f).not.toBeNull();
    expect(lamportVerify(K.pk, f!.message, f!.sig)).toBe(true);
  });
});

describe('W-OTS', () => {
  it('w = 16 이면 체인 67 개, 서명 2144 바이트 (SPHINCS+ 와 같은 값)', () => {
    const p = wotsParams(16);
    expect(p.len).toBe(67);
    expect(p.sigBytes).toBe(2144);
  });
});

describe('UOV 토이', () => {
  it('서명이 공개키 식을 만족', () => {
    const K = uovKeyGen(31, 8, 4, 1);
    for (let s = 0; s < 5; s++) {
      const t = [3, 1, 4, 1].map((x) => (x + s) % 31);
      const sig = uovSign(K, t, s + 10)!;
      expect(publicEval(K, sig.x)).toEqual(t);
    }
  });
});
