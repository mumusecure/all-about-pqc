#!/usr/bin/env python3
"""
Lab 4. BKZ 와 체(sieve)를 직접 돌려 보기  —  10장

    python3 lab04_bkz_sieve.py                          # 빠른 데모 (수십 초 안)
    python3 lab04_bkz_sieve.py --bkz --d 40 --betas 2,6,10,14,18 --seeds 3
    python3 lab04_bkz_sieve.py --sieve --nmin 16 --nmax 28
    python3 lab04_bkz_sieve.py --bkz --fpylll           # fpylll 이 있으면 같은 표를 fpylll 로

표준 라이브러리만 쓴다(Python 3.9+). LLL 은 Lab 1 의 구현을 가져다 쓴다.
⚠️ 교육용. 연구 규모의 실험은 fplll / fpylll / G6K 를 쓰세요.
"""
from __future__ import annotations

import argparse
import math
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lab01_lll_lwe_attack import gram_schmidt, lll  # noqa: E402

Basis = list[list[int]]


# ----------------------------------------------------------------- 격자와 품질
def qary_lattice(d: int, q: int, seed: int) -> Basis:
    """[[q I_k, 0], [A, I]] (k = d/2). 부피 q^k."""
    k, rng = d // 2, random.Random(seed)
    B = []
    for i in range(d):
        row = [0] * d
        if i < k:
            row[i] = q
        else:
            for j in range(k):
                row[j] = rng.randrange(q)
            row[i] = 1
        B.append(row)
    return B


def norm2(v) -> int:
    return sum(x * x for x in v)


def log2_volume(B: Basis) -> float:
    _, Bn = gram_schmidt(B)
    return sum(0.5 * math.log2(x) for x in Bn)


def root_hermite(B: Basis) -> float:
    d = len(B)
    return (math.sqrt(norm2(B[0])) / 2 ** (log2_volume(B) / d)) ** (1 / d)


def gaussian_heuristic(d: int, log2_vol: float) -> float:
    log2_ball = (d / 2) * math.log2(math.pi) - math.lgamma(d / 2 + 1) / math.log(2)
    return 2 ** ((log2_vol - log2_ball) / d)


def delta_beta(beta: int) -> float:
    """δ_β ≈ ((β/2πe)(πβ)^{1/β})^{1/(2(β−1))}  — β ≥ 50 에서만 믿을 것"""
    return ((beta / (2 * math.pi * math.e)) * (math.pi * beta) ** (1 / beta)) ** (1 / (2 * (beta - 1)))


# ----------------------------------------------------------------- 열거 (Schnorr–Euchner)
def enum_block(mu, Bn, k: int, d: int, R2: float):
    """사영 블록 π_k(L(b_k..b_{k+d-1})) 에서 제곱 노름 < R2 인 최단 벡터의 계수 (없으면 None)."""
    x, c, r, t, s = [0] * d, [0.0] * d, [0] * d, [0] * d, [1] * d
    l = [0.0] * (d + 1)
    best, nodes = None, 0

    def set_level(i):
        ci = -sum(x[j] * mu[k + j][k + i] for j in range(i + 1, d))
        c[i], r[i] = ci, round(ci)
        s[i] = 1 if ci >= r[i] else -1
        t[i], x[i] = 0, r[i]

    def advance(i):
        if l[i + 1] == 0:          # 위가 모두 0: ±v 중복을 피해 한 방향만
            x[i] += 1
            return
        t[i] += 1
        step = (t[i] + 1) // 2
        x[i] = r[i] + (s[i] * step if t[i] % 2 == 1 else -s[i] * step)

    i = d - 1
    set_level(i)
    while True:
        nodes += 1
        diff = x[i] - c[i]
        l[i] = l[i + 1] + diff * diff * Bn[k + i]
        if l[i] < R2:
            if i == 0:
                if l[0] > 1e-9:
                    R2, best = l[0], x[:]
                advance(0)
            else:
                i -= 1
                set_level(i)
        else:
            i += 1
            if i == d:
                break
            advance(i)
    return best, R2, nodes


def insert_vector(B: Basis, k: int, x) -> Basis:
    """v = Σ x_i b_{k+i} 를 위치 k 에. 계수의 유클리드 호제법으로 기저를 유지한다(정수만)."""
    C = [row[:] for row in B]
    y = list(x)
    while True:
        nz = sorted((abs(v), i) for i, v in enumerate(y) if v)
        if len(nz) == 1:
            break
        j = nz[0][1]
        for _, i in nz[1:]:
            q = round(y[i] / y[j])
            if q:
                y[i] -= q * y[j]        # x_i b_i + x_j b_j = (x_i − q x_j) b_i + x_j (b_j + q b_i)
                C[k + j] = [a + q * b for a, b in zip(C[k + j], C[k + i])]
    j = next(i for i, v in enumerate(y) if v)
    v = C.pop(k + j)
    if y[j] < 0:
        v = [-a for a in v]
    C.insert(k, v)
    return C


def bkz(B: Basis, beta: int, max_tours: int = 6, delta: float = 0.99, verbose: bool = False):
    B, _ = lll(B, delta)
    n, total_nodes = len(B), 0
    for tour in range(max_tours):
        ins = 0
        for k in range(n - 1):
            d = min(beta, n - k)
            mu, Bn = gram_schmidt(B)
            x, _, nodes = enum_block(mu, Bn, k, d, delta * Bn[k])
            total_nodes += nodes
            if x is not None:
                B, _ = lll(insert_vector(B, k, x), delta)
                ins += 1
        if verbose:
            print(f'    tour {tour + 1}: 삽입 {ins}, δ = {root_hermite(B):.5f}')
        if ins == 0:
            break
    return B, total_nodes


# ----------------------------------------------------------------- Gauss sieve
def gauss_sieve(B: Basis, max_collisions: int, seed: int, max_iter: int = 200000):
    B, _ = lll(B, 0.99)
    rng = random.Random(seed)
    L: list[list[int]] = []
    S = [b[:] for b in B]
    coll = it = max_list = 0

    def sample():
        v = [0] * len(B[0])
        for b in B:
            u = rng.random()
            if u < 0.2:
                v = [a + c for a, c in zip(v, b)]
            elif u < 0.4:
                v = [a - c for a, c in zip(v, b)]
        return v

    def dot(a, b):
        return sum(p * q for p, q in zip(a, b))

    while coll < max_collisions and it < max_iter:
        it += 1
        v = S.pop() if S else sample()
        changed = True
        nv = norm2(v)
        while changed:                       # v 를 목록으로 줄이기
            changed = False
            for w in L:
                ip, nw = dot(v, w), norm2(w)
                if nw <= nv and 2 * abs(ip) > nw:
                    v = [a - b for a, b in zip(v, w)] if ip > 0 else [a + b for a, b in zip(v, w)]
                    nv, changed = norm2(v), True
        if nv == 0:
            coll += 1
            continue
        keep = []
        for w in L:                          # 목록을 v 로 줄이기
            ip, nw = dot(v, w), norm2(w)
            if nw > nv and 2 * abs(ip) > nv:
                S.append([a - b for a, b in zip(w, v)] if ip > 0 else [a + b for a, b in zip(w, v)])
            else:
                keep.append(w)
        keep.append(v)
        L = keep
        max_list = max(max_list, len(L))
    best = min(L, key=norm2)
    return best, max_list, it


# ----------------------------------------------------------------- 실험
def bkz_table(d: int, betas, seeds: int, use_fpylll: bool):
    print(f'BKZ: q-ary 격자 d = {d}, q = 65537, 격자 {seeds} 개 평균')
    print(f'  {"β":>4} {"δ (측정)":>10} {"δ (공식)":>10} {"‖b1‖/GH":>9} {"노드":>10} {"시간":>8}')
    for beta in betas:
        ds, rs, ns, ts = [], [], [], []
        for s in range(seeds):
            B0 = qary_lattice(d, 65537, s + 1)
            t0 = time.time()
            if use_fpylll:
                from fpylll import BKZ, IntegerMatrix, LLL
                A = IntegerMatrix.from_matrix(B0)
                LLL.reduction(A)
                if beta > 2:
                    BKZ.reduction(A, BKZ.Param(block_size=beta))
                B = [list(A[i]) for i in range(A.nrows)]
                nodes = 0
            else:
                B, nodes = (lll(B0, 0.99)[0], 0) if beta == 2 else bkz(B0, beta)
            ts.append(time.time() - t0)
            ds.append(root_hermite(B))
            rs.append(math.sqrt(norm2(B[0])) / gaussian_heuristic(d, log2_volume(B0)))
            ns.append(nodes)
        formula = f'{delta_beta(beta):.5f}' if beta >= 50 else '(β<50)'
        print(f'  {beta:>4} {sum(ds) / seeds:>10.5f} {formula:>10} {sum(rs) / seeds:>9.2f} {sum(ns) // seeds:>10} {sum(ts) / seeds:>7.1f}s')
    print('  참고 (Gama–Nguyen 2008, 큰 차원): LLL 1.0219, BKZ-20 1.0128, BKZ-28 1.0109')


def sieve_table(nmin: int, nmax: int):
    print('Gauss sieve: q-ary 격자 (q = 1009), 충돌 300 번에서 멈춤')
    print(f'  {"n":>3} {"최대 목록":>9} {"log2":>6} {"(4/3)^(n/2)":>12} {"찾은 ‖v‖":>9} {"GH":>7} {"시간":>7}')
    pts = []
    for n in range(nmin, nmax + 1, 2):
        B0 = qary_lattice(n, 1009, 3)
        t0 = time.time()
        v, mx, _ = gauss_sieve(B0, 300, 1)
        dt = time.time() - t0
        pts.append((n, math.log2(mx)))
        print(f'  {n:>3} {mx:>9} {math.log2(mx):>6.2f} {(4 / 3) ** (n / 2):>12.1f} {math.sqrt(norm2(v)):>9.1f} '
              f'{gaussian_heuristic(n, log2_volume(B0)):>7.1f} {dt:>6.1f}s')
    if len(pts) >= 2:
        k = len(pts)
        mx_, my = sum(p[0] for p in pts) / k, sum(p[1] for p in pts) / k
        slope = sum((p[0] - mx_) * (p[1] - my) for p in pts) / sum((p[0] - mx_) ** 2 for p in pts)
        print(f'  log2(목록) 의 기울기 ≈ {slope:.3f}  (이론 0.2075)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--bkz', action='store_true')
    ap.add_argument('--sieve', action='store_true')
    ap.add_argument('--d', type=int, default=40)
    ap.add_argument('--betas', default='2,6,10,14')
    ap.add_argument('--seeds', type=int, default=2)
    ap.add_argument('--nmin', type=int, default=16)
    ap.add_argument('--nmax', type=int, default=24)
    ap.add_argument('--fpylll', action='store_true')
    a = ap.parse_args()
    if a.bkz:
        bkz_table(a.d, [int(b) for b in a.betas.split(',')], a.seeds, a.fpylll)
    elif a.sieve:
        sieve_table(a.nmin, a.nmax)
    else:   # 빠른 데모 (CI 에서도 돌린다)
        bkz_table(40, [2, 10, 16], 1, False)
        print()
        sieve_table(16, 20)
