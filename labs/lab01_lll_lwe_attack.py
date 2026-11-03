#!/usr/bin/env python3
"""
Lab 1. LLL 로 토이 LWE 공격하기
==============================

All About PQC 교과서 9장(LLL)과 14장(LWE)의 실습 스크립트.
표준 라이브러리만 사용한다 (Python 3.9+).

    python3 lab01_lll_lwe_attack.py                 # 기본: n=16 한 번 공격
    python3 lab01_lll_lwe_attack.py --n 24 --sigma 2
    python3 lab01_lll_lwe_attack.py --sweep         # n 을 키워가며 성공률 표
    python3 lab01_lll_lwe_attack.py --sweep --fpylll  # fpylll 이 있으면 비교

⚠️ 교육용 코드다. 실제 보안 목적으로 쓰지 말 것.
"""
from __future__ import annotations

import argparse
import math
import random
import time
from dataclasses import dataclass

Vec = list[int]
Basis = list[list[int]]


# --------------------------------------------------------------------------
# 1. LLL (교과서 9장 4절의 의사코드를 그대로 옮김)
# --------------------------------------------------------------------------

def dot(a, b) -> float:
    return sum(x * y for x, y in zip(a, b))


def gram_schmidt(B: Basis) -> tuple[list[list[float]], list[float]]:
    """mu[i][j], Bn[i] = ||b*_i||^2 를 돌려준다."""
    n = len(B)
    bstar: list[list[float]] = []
    mu = [[0.0] * n for _ in range(n)]
    Bn = [0.0] * n
    for i in range(n):
        v = [float(x) for x in B[i]]
        for j in range(i):
            mu[i][j] = dot(B[i], bstar[j]) / Bn[j] if Bn[j] else 0.0
            v = [vi - mu[i][j] * bj for vi, bj in zip(v, bstar[j])]
        mu[i][i] = 1.0
        bstar.append(v)
        Bn[i] = dot(v, v)
    return mu, Bn


def lll(B: Basis, delta: float = 0.99) -> tuple[Basis, int]:
    """부동소수점 GSO + 교환 시 O(n) 갱신 (Cohen Alg. 2.6.3). (축소된 기저, 교환 횟수)."""
    B = [row[:] for row in B]
    n = len(B)
    mu, Bn = gram_schmidt(B)
    k, swaps = 1, 0
    while k < n:
        # 크기 축소
        for j in range(k - 1, -1, -1):
            q = round(mu[k][j])
            if q:
                B[k] = [x - q * y for x, y in zip(B[k], B[j])]
                for i in range(j):
                    mu[k][i] -= q * mu[j][i]
                mu[k][j] -= q
        # Lovász 조건
        if Bn[k] >= (delta - mu[k][k - 1] ** 2) * Bn[k - 1]:
            k += 1
            continue
        # 교환 + GSO 갱신
        B[k], B[k - 1] = B[k - 1], B[k]
        swaps += 1
        m = mu[k][k - 1]
        Bnew = Bn[k] + m * m * Bn[k - 1]
        mu[k][k - 1] = m * Bn[k - 1] / Bnew
        Bn[k] = Bn[k - 1] * Bn[k] / Bnew
        Bn[k - 1] = Bnew
        for j in range(k - 1):
            mu[k][j], mu[k - 1][j] = mu[k - 1][j], mu[k][j]
        for i in range(k + 1, n):
            t = mu[i][k]
            mu[i][k] = mu[i][k - 1] - m * t
            mu[i][k - 1] = t + mu[k][k - 1] * mu[i][k]
        k = max(k - 1, 1)
    return B, swaps


def is_lll_reduced(B: Basis, delta: float = 0.99, eps: float = 1e-9) -> bool:
    mu, Bn = gram_schmidt(B)
    for i in range(1, len(B)):
        if any(abs(mu[i][j]) > 0.5 + eps for j in range(i)):
            return False
        if Bn[i] < (delta - mu[i][i - 1] ** 2) * Bn[i - 1] - eps * max(1.0, Bn[i - 1]):
            return False
    return True


# --------------------------------------------------------------------------
# 2. LWE 인스턴스 (짧은 비밀 = 정규형)
# --------------------------------------------------------------------------

@dataclass
class LWE:
    n: int
    m: int
    q: int
    sigma: float
    A: list[list[int]]
    s: Vec
    e: Vec
    b: Vec


def center(x: int, q: int) -> int:
    r = x % q
    return r - q if r > q // 2 else r


def sample_lwe(n: int, m: int, q: int, sigma: float, rng: random.Random) -> LWE:
    A = [[rng.randrange(q) for _ in range(n)] for _ in range(m)]
    s = [round(rng.gauss(0, sigma)) for _ in range(n)]
    e = [round(rng.gauss(0, sigma)) for _ in range(m)]
    b = [(sum(a * x for a, x in zip(row, s)) + ei) % q for row, ei in zip(A, e)]
    return LWE(n, m, q, sigma, A, s, e, b)


# --------------------------------------------------------------------------
# 3. 임베딩 공격 (교과서 14장 4.2절)
# --------------------------------------------------------------------------

def embedding_basis(inst: LWE) -> Basis:
    """
        [ q I_m   0    0 ]
        [ A^T     I_n  0 ]
        [ b^T     0    1 ]       -> 격자 안에 짧은 벡터 (e, -s, 1) 이 있다.
    """
    m, n, q = inst.m, inst.n, inst.q
    d = m + n + 1
    B: Basis = []
    for i in range(m):
        row = [0] * d
        row[i] = q
        B.append(row)
    for j in range(n):
        row = [0] * d
        for i in range(m):
            row[i] = inst.A[i][j]
        row[m + j] = 1
        B.append(row)
    B.append(inst.b[:] + [0] * n + [1])
    return B


def gaussian_heuristic(d: int, log2_vol: float) -> float:
    return math.sqrt(d / (2 * math.pi * math.e)) * 2 ** (log2_vol / d)


@dataclass
class Result:
    success: bool
    target_norm: float
    gh: float
    seconds: float
    swaps: int


def attack(inst: LWE, reducer=lll) -> Result:
    B = embedding_basis(inst)
    t0 = time.perf_counter()
    R, swaps = reducer(B)
    dt = time.perf_counter() - t0
    m, n, q = inst.m, inst.n, inst.q
    success = False
    for row in R:
        if abs(row[-1]) != 1:
            continue
        sign = row[-1]
        cand = [-sign * x for x in row[m:m + n]]
        resid = [center(bi - sum(a * c for a, c in zip(r, cand)), q) for r, bi in zip(inst.A, inst.b)]
        if max(abs(x) for x in resid) <= max(6 * inst.sigma, 2):
            success = cand == inst.s
            break
    target = inst.e + [-x for x in inst.s] + [1]
    d = m + n + 1
    return Result(success, math.sqrt(dot(target, target)), gaussian_heuristic(d, m * math.log2(q)), dt, swaps)


# --------------------------------------------------------------------------
# 4. (선택) fpylll 비교
# --------------------------------------------------------------------------

def fpylll_reducer(B: Basis):
    from fpylll import IntegerMatrix, LLL  # type: ignore

    M = IntegerMatrix.from_matrix(B)
    LLL.reduction(M, delta=0.99)
    return [[M[i, j] for j in range(M.ncols)] for i in range(M.nrows)], -1


# --------------------------------------------------------------------------
# 5. 실행
# --------------------------------------------------------------------------

def run_once(args) -> None:
    rng = random.Random(args.seed)
    inst = sample_lwe(args.n, 2 * args.n, args.q, args.sigma, rng)
    print(f"LWE: n={inst.n}, m={inst.m}, q={inst.q}, sigma={inst.sigma}")
    print(f"비밀 s = {inst.s}")
    B = embedding_basis(inst)
    print(f"임베딩 격자 차원 d = {len(B)}, vol = q^m = {inst.q}^{inst.m}")
    r = attack(inst)
    print(f"LLL: {r.seconds:.3f}s, 교환 {r.swaps}회")
    print(f"‖(e,-s,1)‖ = {r.target_norm:.2f},  GH = {r.gh:.2f},  gap = {r.gh / r.target_norm:.2f}")
    print("결과:", "✅ 비밀 복구 성공" if r.success else "❌ 실패")


def run_sweep(args) -> None:
    reducers = [("ours", lll)]
    if args.fpylll:
        try:
            import fpylll  # noqa: F401
            reducers.append(("fpylll", fpylll_reducer))
        except ImportError:
            print("(fpylll 이 설치되어 있지 않아 비교를 건너뜁니다)")
    print(f"q={args.q}, sigma={args.sigma}, m=2n, 각 {args.trials}회")
    header = f"{'n':>4} {'d':>5} {'gap':>6} " + " ".join(f"{name:>14}" for name, _ in reducers)
    print(header)
    print("-" * len(header))
    for n in range(args.n_min, args.n_max + 1, args.n_step):
        cells, gaps = [], []
        for name, red in reducers:
            ok, secs = 0, 0.0
            for t in range(args.trials):
                inst = sample_lwe(n, 2 * n, args.q, args.sigma, random.Random(args.seed * 1000 + n * 31 + t))
                r = attack(inst, red)
                ok += r.success
                secs += r.seconds
                gaps.append(r.gh / r.target_norm)
            cells.append(f"{ok}/{args.trials} {secs / args.trials:6.2f}s")
        print(f"{n:>4} {3 * n + 1:>5} {sum(gaps) / len(gaps):>6.2f} " + " ".join(f"{c:>14}" for c in cells))


def main() -> None:
    p = argparse.ArgumentParser(description="LLL 로 토이 LWE 공격하기 (All About PQC Lab 1)")
    p.add_argument("--n", type=int, default=16)
    p.add_argument("--q", type=int, default=97)
    p.add_argument("--sigma", type=float, default=1.0)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--sweep", action="store_true", help="n 을 키워가며 성공률 표 출력")
    p.add_argument("--n-min", type=int, default=8)
    p.add_argument("--n-max", type=int, default=40)
    p.add_argument("--n-step", type=int, default=4)
    p.add_argument("--trials", type=int, default=5)
    p.add_argument("--fpylll", action="store_true", help="fpylll 과 비교 (설치된 경우)")
    args = p.parse_args()
    run_sweep(args) if args.sweep else run_once(args)


if __name__ == "__main__":
    main()
