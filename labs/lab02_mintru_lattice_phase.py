#!/usr/bin/env python3
"""
Lab 2. MiNTRU 격자 단계 재현 (Lee–Wallet, ePrint 2020/230 의 §3.2·표 1, 작은 파라미터)
All About PQC 교과서 Lab 2 (labs/lab02-mintru) 의 실습 스크립트. 해설은 "논문 읽기 1".

  python3 lab02_mintru_lattice_phase.py            # n=2^6 (2k=24), n=2^7 (2k=50) 재현
  python3 lab02_mintru_lattice_phase.py 8 32 50    # n=2^8, q=2^32, k=50 (2k=100) — LLL 은 시드당 약 12초, 인스턴스 생성 포함 수 분

논문의 부분행렬 B' = [[q I_k, 0], [C01, I_k]] 를 LLL(δ=0.99)로 축소하고,
축소 기저의 앞 k 개 벡터의 '마지막 k 좌표'(S 블록)를 0 으로 채워 S 의 행 격자 L(S) 에 속하는지 검사한다.
표준 라이브러리만 사용. 교육용 코드.
"""
from __future__ import annotations
import sys, random, math, time
from fractions import Fraction

Vec = list[int]
Basis = list[list[int]]

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



def det_parity_ok(S):
    # det S odd <=> S invertible mod 2^k
    n=len(S); A=[r[:] for r in S]
    for c in range(n):
        p=next((r for r in range(c,n) if A[r][c]%2),None)
        if p is None: return False
        A[c],A[p]=A[p],A[c]
        for r in range(c+1,n):
            if A[r][c]%2: A[r]=[(x+y)%2 for x,y in zip(A[r],A[c])]
    return True
def inv_mod(M,q):
    n=len(M); A=[[x%q for x in row]+[int(i==j) for j in range(n)] for i,row in enumerate(M)]
    for c in range(n):
        p=next(r for r in range(c,n) if A[r][c]%2)
        A[c],A[p]=A[p],A[c]; iv=pow(A[c][c],-1,q); A[c]=[x*iv%q for x in A[c]]
        for r in range(n):
            if r!=c and A[r][c]: f=A[r][c]; A[r]=[(x-f*y)%q for x,y in zip(A[r],A[c])]
    return [row[n:] for row in A]
def inv_Q(M):
    n=len(M); A=[[Fraction(x) for x in row]+[Fraction(int(i==j)) for j in range(n)] for i,row in enumerate(M)]
    for c in range(n):
        p=next(r for r in range(c,n) if A[r][c]!=0); A[c],A[p]=A[p],A[c]
        iv=1/A[c][c]; A[c]=[x*iv for x in A[c]]
        for r in range(n):
            if r!=c and A[r][c]!=0: f=A[r][c]; A[r]=[x-f*y for x,y in zip(A[r],A[c])]
    return [row[n:] for row in A]

def run(logn, logq, k, seed):
    rnd=random.Random(seed); n=2**logn; q=2**logq
    while True:
        S=[[rnd.randint(0,1) for _ in range(n)] for _ in range(n)]
        if det_parity_ok(S): break
    E0=[[rnd.randint(0,1) for _ in range(n)] for _ in range(n)]
    Si=inv_mod(S,q)
    ImE0=[[int(i==j)-E0[i][j] for j in range(n)] for i in range(n)]
    C0=[[sum(Si[i][t]*ImE0[t][j] for t in range(n))%q for j in range(n)] for i in range(n)]
    C01=[row[n-k:n] for row in C0[:k]]
    Bp=[[q if j==i else 0 for j in range(2*k)] for i in range(k)] + [C01[i]+[int(j==i) for j in range(k)] for i in range(k)]
    t0=time.time(); R,_=lll(Bp,0.99); dt=time.time()-t0
    SiQ=inv_Q(S)
    def in_LS(w):
        wp=w+[0]*(n-k)
        x=[sum(Fraction(wp[t])*SiQ[t][j] for t in range(n)) for j in range(n)]
        return all(v.denominator==1 for v in x) and any(wp)
    hits=[in_LS(row[k:]) for row in R]
    norms=[math.log2(math.sqrt(sum(x*x for x in row))) for row in R]
    return dt, sum(hits[:k]), k, norms[0], norms[k-1], norms[k]

if __name__ == "__main__":
    if len(sys.argv) == 4:
        cases = [tuple(int(x) for x in sys.argv[1:4])]
    else:
        cases = [(6, 22, 12), (7, 27, 25)]
    for (logn, logq, k) in cases:
        for seed in (1, 2):
            dt, h, kk, n0, nk1, nk = run(logn, logq, k, seed)
            print(f"n=2^{logn} q=2^{logq} 2k={2*k} seed={seed}: LLL {dt:.1f}s, 앞 k개 중 L(S)에 속한 벡터 {h}/{kk}, "
                  f"log2 norms b1={n0:.1f}, b_k={nk1:.1f}, b_(k+1)={nk:.1f}")
