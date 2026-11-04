#!/usr/bin/env python3
"""
Lab 7. 평문 확인 오라클로 ML-KEM 비밀키 읽기  —  20장

    python3 lab07_pc_oracle.py                 # ML-KEM-512, 잡음 없는 오라클 (몇 초)
    python3 lab07_pc_oracle.py --param 768
    python3 lab07_pc_oracle.py --noise 0.05 --votes 5     # 부채널처럼 가끔 틀리는 오라클 + 다수결

Lab 3 의 FIPS 203 구현(바이트 단위)을 그대로 쓴다. 오라클은 "K-PKE.Decrypt(dk, c) 가 0 비트열인가?" 만 답한다.
현실에서 이런 오라클은 (1) CPA 용 K-PKE 를 정적 키로 재사용하는 설계 실수, (2) Decaps 의 재암호화·비교 단계에서
새는 부채널(전력, 시간)에서 생긴다. 정상적인 ML-KEM 의 Decaps 출력만으로는 생기지 않는다.

⚠️ 교육용. 공부와 방어 목적의 재현 실험이다.
"""
from __future__ import annotations

import argparse
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lab03_mlkem as K  # noqa: E402


def craft(P, i, j, z):
    """u_i = Decompress(2^(du-4)) ≈ 208 (상수 다항식), 나머지 u 는 0, v = Decompress_dv(z)·x^j."""
    k, du, dv = P['k'], P['du'], P['dv']
    us = []
    for t in range(k):
        y = [0] * K.N
        if t == i:
            y[0] = 2 ** (du - 4)
        us.append(K.byte_encode(y, du))
    v = [0] * K.N
    v[j] = z
    return b''.join(us) + K.byte_encode(v, dv)


def bit_table(P):
    """후보 s 와 질의 z 에서 복호 비트가 1 인가 (공격자가 미리 계산할 수 있음)"""
    c = K.decompress(2 ** (P['du'] - 4), P['du'])
    eta = P['eta1']
    cands = list(range(-eta, eta + 1))
    tab = {(z, s): K.compress((K.decompress(z, P['dv']) - c * s) % K.Q, 1) for z in range(2 ** P['dv']) for s in cands}
    return cands, tab


def recover(P, oracle):
    cands, tab = bit_table(P)
    zs = range(2 ** P['dv'])
    secret, queries = [], 0
    for i in range(P['k']):
        poly = []
        for j in range(K.N):
            left = cands[:]
            while len(left) > 1:
                best = min((z for z in zs if 0 < sum(tab[z, s] for s in left) < len(left)),
                           key=lambda z: abs(2 * sum(tab[z, s] for s in left) - len(left)), default=None)
                if best is None:
                    break
                is_zero = oracle(craft(P, i, j, best))
                queries += 1
                left = [s for s in left if (tab[best, s] == 0) == is_zero]
            poly.append(left[0] if len(left) == 1 else None)
        secret.append(poly)
    return secret, queries


def true_secret(dk_pke, P):
    s_hat = [K.byte_decode(dk_pke[384 * i:384 * (i + 1)], 12) for i in range(P['k'])]
    return [[x - K.Q if x > K.Q // 2 else x for x in K.ntt_inv(p)] for p in s_hat]


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--param', type=int, choices=[512, 768, 1024], default=512)
    ap.add_argument('--noise', type=float, default=0.0, help='오라클이 틀릴 확률')
    ap.add_argument('--votes', type=int, default=1, help='같은 질의를 몇 번 물어 다수결할지 (홀수)')
    a = ap.parse_args()
    P = K.PARAMS[a.param]
    rng = random.Random(2026)
    ek, dk = K.keygen_internal(rng.randbytes(32), rng.randbytes(32), P)
    dk_pke = dk[:384 * P['k']]
    zero = bytes(32)
    calls = 0

    def oracle(c):
        global calls
        yes = 0
        for _ in range(a.votes):
            calls += 1
            ans = K.kpke_decrypt(dk_pke, c, P) == zero
            yes += (not ans) if rng.random() < a.noise else ans
        return 2 * yes > a.votes

    t0 = time.time()
    got, _ = recover(P, oracle)
    truth = true_secret(dk_pke, P)
    ok = sum(g == t for gp, tp in zip(got, truth) for g, t in zip(gp, tp))
    total = P['k'] * K.N
    print(f'ML-KEM-{a.param}: 비밀 계수 {total} 개 중 {ok} 개 복원 ({100 * ok / total:.1f}%), '
          f'오라클 호출 {calls} 번 (계수당 {calls / total:.2f}), {time.time() - t0:.1f}s')
    if ok == total:
        # 복원한 s 로 실제 ML-KEM 공유키를 풀 수 있는지 확인: ŝ 를 다시 만들어 Decaps
        s_hat = b''.join(K.byte_encode(K.ntt([x % K.Q for x in p]), 12) for p in got)
        K_true, c = K.encaps_internal(ek, rng.randbytes(32), P)
        forged_dk = s_hat + dk[384 * P['k']:]
        print('복원한 비밀키로 Decaps:', '공유키 일치 ✅' if K.decaps_internal(forged_dk, c, P) == K_true else '불일치 ❌')
    if ok != total and a.noise == 0:
        sys.exit(1)
