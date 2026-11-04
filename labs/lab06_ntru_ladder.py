#!/usr/bin/env python3
"""
Lab 6. NTRU 키 복구에 필요한 블록 크기 재기  —  19장

    python3 lab06_ntru_ladder.py                        # n = 32, q 를 바꿔 가며 (몇 분)
    python3 lab06_ntru_ladder.py --n 40 --qs 37,67,131,257 --seeds 2
    python3 lab06_ntru_ladder.py --n 20 --qs 67,257     # 빠른 확인 (CI)

NTRU 격자 Λ = {(u, v) : u ≡ v·h (mod q)} (차원 2n, 부피 qⁿ) 에 LLL, BKZ-4, 6, … 을 차례로 돌리며
기저의 앞 n 개에 비밀키의 회전 ±xⁱ(g, f) 가 나타나는 첫 β 를 기록한다.
BKZ 는 Lab 4 의 구현을 쓴다. 순수 Python 이라 n = 40 이상은 느리다(교과서 위젯은 같은 실험을 TS 로 돈다).
"""
from __future__ import annotations

import argparse
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lab01_lll_lwe_attack import lll  # noqa: E402
from lab04_bkz_sieve import bkz  # noqa: E402


def negamul(a, b, q=None):
    """a·b mod (xⁿ + 1)"""
    n, h = len(a), [0] * len(a)
    for i, x in enumerate(a):
        if x:
            for j, y in enumerate(b):
                if i + j < n:
                    h[i + j] += x * y
                else:
                    h[i + j - n] -= x * y
    return [v % q for v in h] if q else h


def inv_mod(f, q):
    """ℤ_q[x]/(xⁿ+1) 에서 f⁻¹ (q 소수). 곱셈 행렬에 가우스 소거. 없으면 None."""
    n = len(f)
    cols, cur = [], f[:]
    for _ in range(n):
        cols.append(cur[:])
        cur = [-cur[-1]] + cur[:-1]
    A = [[cols[j][i] % q for j in range(n)] + [1 if i == 0 else 0] for i in range(n)]
    for c in range(n):
        p = next((r for r in range(c, n) if A[r][c]), None)
        if p is None:
            return None
        A[c], A[p] = A[p], A[c]
        iv = pow(A[c][c], -1, q)
        A[c] = [v * iv % q for v in A[c]]
        for r in range(n):
            if r != c and A[r][c]:
                t = A[r][c]
                A[r] = [(a - t * b) % q for a, b in zip(A[r], A[c])]
    return [A[i][n] for i in range(n)]


def keygen(n, q, rng):
    while True:
        f = [rng.choice((-1, 0, 1)) for _ in range(n)]
        g = [rng.choice((-1, 0, 1)) for _ in range(n)]
        fi = inv_mod(f, q)
        if fi:
            return f, g, negamul(g, fi, q)


def ntru_lattice(h, q):
    """행: (q·eᵢ, 0) 과 (xⁱ·h, eᵢ).  (x^i g, x^i f) 가 짧은 격자 벡터."""
    n, B = len(h), []
    for i in range(n):
        r = [0] * (2 * n)
        r[i] = q
        B.append(r)
    cur = h[:]
    for i in range(n):
        r = [0] * (2 * n)
        r[:n] = cur
        r[n + i] = 1
        B.append(r)
        cur = [(-cur[-1]) % q] + cur[:-1]
    return B


def rotations(f, g):
    out, a, b = set(), g[:], f[:]
    for _ in range(len(f)):
        out.add(tuple(a + b))
        out.add(tuple(-x for x in a + b))
        a, b = [-a[-1]] + a[:-1], [-b[-1]] + b[:-1]
    return out


def ladder(n, q, seed, beta_max):
    rng = random.Random(seed)
    f, g, h = keygen(n, q, rng)
    R = rotations(f, g)
    B, _ = lll(ntru_lattice(h, q), 0.99)
    cnt = sum(tuple(v) in R for v in B[:n])
    if cnt:
        return 2, cnt
    for beta in range(4, beta_max + 1, 2):
        B, _ = bkz(B, beta, max_tours=2)
        cnt = sum(tuple(v) in R for v in B[:n])
        if cnt:
            return beta, cnt
    return None, 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=32)
    ap.add_argument('--qs', default='17,37,67,131')
    ap.add_argument('--seeds', type=int, default=1)
    ap.add_argument('--beta-max', type=int, default=20)
    a = ap.parse_args()
    print(f'NTRU n = {a.n} (격자 차원 {2 * a.n}), β ≤ {a.beta_max}, 키 {a.seeds} 개')
    print(f'  {"q":>6} {"필요한 β":>10} {"앞 n 개 중 회전":>14} {"시간":>8}')
    for q in [int(x) for x in a.qs.split(',')]:
        for s in range(a.seeds):
            t0 = time.time()
            beta, cnt = ladder(a.n, q, s + 1, a.beta_max)
            shown = '—' if beta is None else str(beta)
            print(f'  {q:>6} {shown:>10} {cnt:>14} {time.time() - t0:>7.1f}s', flush=True)
    print('  (q 는 소수여야 함. 회전이 n 개 가깝게 한꺼번에 나오면 밀집 부분격자가 드러난 것)')
