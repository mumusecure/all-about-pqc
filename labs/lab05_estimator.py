#!/usr/bin/env python3
"""
Lab 5. 나만의 LWE 추정기 만들기  —  18장

    python3 lab05_estimator.py                      # ML-KEM 세 집합과 동형암호 예의 표
    python3 lab05_estimator.py --n 640 --logq 15 --sigma 2.8      # 임의의 파라미터
    python3 lab05_estimator.py --sparse 64          # 희소 비밀(h = 64)의 좌표 버리기 하이브리드
    sage -python lab05_estimator.py --compare       # lattice-estimator 가 있으면 나란히 비교

표준 라이브러리만 쓴다. 모델은 18장 본문과 같다:
  primal (ADPS16):  σ√β ≤ δ_β^{2β−d} · vol^{1/d},  d = m + n + 1,  vol = q^m (σ_e/σ_s)^n
  dual:             ε = exp(−2π²(ℓσ/q)²),  ℓ = δ_β^d vol^{1/d},  반복 = max(1, 1/(ε² 2^{0.2075β}))
  비용:             core-SVP 0.292β (양자 0.265β), 반복 포함 0.292β + 16.4 + log₂(8d)
⚠️ 교육용 근사. 실제 파라미터 결정에는 lattice-estimator 를 쓰세요.
"""
from __future__ import annotations

import argparse
import math

LOG2 = math.log2


def delta_beta(b: int) -> float:
    return ((b / (2 * math.pi * math.e)) * (math.pi * b) ** (1 / b)) ** (1 / (2 * (b - 1)))


def primal(n, logq, ss, se, m_max, step=8):
    best, nu = None, se / ss
    for m in range(max(8, n // 8), m_max + 1, step):
        d = m + n + 1
        lv = m * logq + n * LOG2(nu)
        for b in range(50, d + 1):
            if LOG2(se * math.sqrt(b)) <= (2 * b - d) * LOG2(delta_beta(b)) + lv / d:
                if best is None or b < best[0]:
                    best = (b, m, d)
                break
    return best


def dual(n, logq, ss, se, m_max, step=8):
    best, c = None, ss / se
    for m in range(max(8, n // 8), m_max + 1, step):
        d = m + n
        lv = n * logq + n * LOG2(c)
        for b in range(50, d + 1):
            x = se * 2 ** (d * LOG2(delta_beta(b)) + lv / d - logq)
            log2eps = -2 * math.pi ** 2 * x * x / math.log(2)
            reps = max(0.0, -2 * log2eps - 0.2075 * b)
            cost = 0.292 * b + reps
            if best is None or cost < best[0]:
                best = (cost, b, m, d, reps)
    return best


def log2_binom(a, b):
    return (math.lgamma(a + 1) - math.lgamma(b + 1) - math.lgamma(a - b + 1)) / math.log(2)


def drop_hybrid(n, h, logq, se, m_max):
    rows = []
    for g in range(0, n - h, 25):
        nn = n - g
        r = primal(nn, logq, math.sqrt(h / nn), se, m_max, step=32)
        if r is None:
            continue
        guess = log2_binom(n, g) - log2_binom(n - h, g)
        rows.append((0.292 * r[0] + guess, g, r[0], guess))
    return rows


def models(b, d):
    return 0.292 * b, 0.265 * b, 0.292 * b + 16.4 + LOG2(8 * d)


def report(name, n, logq, ss, se, m_max):
    p, du = primal(n, logq, ss, se, m_max), dual(n, logq, ss, se, m_max)
    print(f'{name}: n = {n}, log2 q = {logq:.2f}, σ_s = {ss:.3f}, σ_e = {se:.3f}, m ≤ {m_max}')
    if p:
        c, qn, t = models(p[0], p[2])
        print(f'  primal  β = {p[0]:4d} (m = {p[1]:4d}, d = {p[2]:4d})   core-SVP {c:6.1f}  양자 {qn:6.1f}  반복 포함 {t:6.1f}')
    if du:
        c, qn, t = models(du[1], du[3])
        print(f'  dual    β = {du[1]:4d} (m = {du[2]:4d}, 반복 2^{du[4]:.1f})  core-SVP {c + du[4]:6.1f}  양자 {qn + du[4]:6.1f}  반복 포함 {t + du[4]:6.1f}')
    if not p and not du:
        print('  β ≥ 50 범위에서 공격을 찾지 못함')


def compare_with_estimator():
    """lattice-estimator (https://github.com/malb/lattice-estimator) 가 있으면 같은 문제를 돌린다. Sage 필요."""
    try:
        from estimator import LWE, ND, RC, schemes   # type: ignore
    except ImportError:
        print('lattice-estimator 를 찾지 못했습니다. Sage 환경에서 저장소를 PYTHONPATH 에 넣고 다시 실행하세요.')
        return
    for s in (schemes.Kyber512, schemes.Kyber768, schemes.Kyber1024):
        print(s)
        print(LWE.primal_usvp(s, red_cost_model=RC.ADPS16))
        print(LWE.dual(s, red_cost_model=RC.ADPS16))
    _ = ND  # 분포 객체: ND.CenteredBinomial(eta), ND.DiscreteGaussian(sigma), ND.SparseTernary(...)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int)
    ap.add_argument('--logq', type=float)
    ap.add_argument('--sigma', type=float)
    ap.add_argument('--sigma-s', type=float, help='비밀의 표준편차 (생략하면 σ_e 와 같음)')
    ap.add_argument('--m', type=int, help='표본 수 상한 (생략하면 n)')
    ap.add_argument('--sparse', type=int, help='해밍 무게 h 인 희소 삼진 비밀 (n = 1024, q = 2^27, σ = 3.2)')
    ap.add_argument('--compare', action='store_true')
    a = ap.parse_args()
    if a.compare:
        compare_with_estimator()
    elif a.sparse:
        rows = drop_hybrid(1024, a.sparse, 27, 3.2, 2048)
        best = min(rows)
        print(f'희소 비밀 h = {a.sparse}: 순수 primal {rows[0][0]:.1f} 비트, 최적 하이브리드 g = {best[1]} → {best[0]:.1f} 비트 (β = {best[2]}, 추측 {best[3]:.1f} 비트)')
    elif a.n:
        se = a.sigma or 3.2
        report('사용자 설정', a.n, a.logq or 15, a.sigma_s or se, se, a.m or a.n)
    else:
        for name, k, eta in (('ML-KEM-512', 2, 3), ('ML-KEM-768', 3, 2), ('ML-KEM-1024', 4, 2)):
            s = math.sqrt(eta / 2)
            report(name, 256 * k, LOG2(3329), s, s, 256 * k)
        report('동형암호식 (삼진 비밀)', 1024, 27, math.sqrt(2 / 3), 3.2, 2048)
        print('\n참고: Kyber 3라운드 명세의 core-SVP (고전) 118 / 182 / 256')
