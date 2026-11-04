#!/usr/bin/env python3
"""
Lab 3. ML-KEM (FIPS 203) 을 표준 라이브러리만으로 구현하기  —  16장

    python3 lab03_mlkem.py                 # 자체 검사 (세 파라미터 모두)
    python3 lab03_mlkem.py --failure       # 복호 실패 확률 δ 정확 계산 (PMF 합성곱)
    python3 lab03_mlkem.py --noise 768     # 실제 복호 잡음 측정 (경험적 분포)

⚠️ 교육용. 상수 시간이 아니고(파이썬), 부채널 대책이 없다. 실제 시스템에는
   검증된 구현(예: mlkem-native, libcrux, liboqs)을 쓰세요.

FIPS 203 의 알고리즘 번호를 주석에 적었다. 교과서 16장과 한 줄씩 대조하며 읽으세요.
"""
import argparse
import hashlib
import math
import os
import random
import sys

Q, N = 3329, 256
PARAMS = {
    512: dict(k=2, eta1=3, eta2=2, du=10, dv=4),
    768: dict(k=3, eta1=2, eta2=2, du=10, dv=4),
    1024: dict(k=4, eta1=2, eta2=2, du=11, dv=5),
}

# ---------------------------------------------------------------- 해시 (4.1절)
def H(s): return hashlib.sha3_256(s).digest()
def J(s): return hashlib.shake_256(s).digest(32)
def G(s):
    h = hashlib.sha3_512(s).digest()
    return h[:32], h[32:]
def PRF(eta, s, b): return hashlib.shake_256(s + bytes([b])).digest(64 * eta)

# ---------------------------------------------------------------- 인코딩 (알고리즘 3–6)
def bits_to_bytes(bits):
    out = bytearray(len(bits) // 8)
    for i, b in enumerate(bits):
        out[i // 8] |= b << (i % 8)
    return bytes(out)

def bytes_to_bits(B):
    return [(B[i // 8] >> (i % 8)) & 1 for i in range(8 * len(B))]

def byte_encode(F, d):
    bits = []
    for a in F:
        bits.extend((a >> j) & 1 for j in range(d))
    return bits_to_bytes(bits)

def byte_decode(B, d):
    m = 2 ** d if d < 12 else Q
    bits = bytes_to_bits(B)
    return [sum(bits[i * d + j] << j for j in range(d)) % m for i in range(N)]

# ---------------------------------------------------------------- 압축 (4.2.1절)
def compress(x, d):    # ⌈(2^d / q)·x⌋ mod 2^d   (정수 연산으로 반올림)
    return ((x << (d + 1)) + Q) // (2 * Q) % (1 << d)

def decompress(y, d):  # ⌈(q / 2^d)·y⌋
    return (Q * y * 2 + (1 << d)) >> (d + 1)

# ---------------------------------------------------------------- 샘플링 (알고리즘 7, 8)
def sample_ntt(B):
    """균등한 NTT 영역 다항식: 12비트 두 개씩 읽어 q 미만이면 받아들인다 (거절 샘플링)."""
    a, j, L = [], 0, 504
    while True:
        C = hashlib.shake_128(B).digest(L)
        a, pos = [], 0
        while len(a) < N and pos + 3 <= L:
            d1 = C[pos] + 256 * (C[pos + 1] % 16)
            d2 = C[pos + 1] // 16 + 16 * C[pos + 2]
            pos += 3
            if d1 < Q: a.append(d1)
            if d2 < Q and len(a) < N: a.append(d2)
        if len(a) == N:
            return a
        L *= 2   # (드물게) 바이트가 모자라면 더 길게 짜낸다 — XOF 이므로 앞부분은 같다

def sample_cbd(B, eta):
    b = bytes_to_bits(B)
    return [(sum(b[2 * i * eta + j] for j in range(eta)) - sum(b[2 * i * eta + eta + j] for j in range(eta))) % Q
            for i in range(N)]

# ---------------------------------------------------------------- NTT (알고리즘 9–12)
def bitrev7(i): return int(f'{i:07b}'[::-1], 2)
ZETAS = [pow(17, bitrev7(i), Q) for i in range(128)]
GAMMAS = [pow(17, 2 * bitrev7(i) + 1, Q) for i in range(128)]

def ntt(f):
    a, i, L = list(f), 1, 128
    while L >= 2:
        for start in range(0, N, 2 * L):
            z = ZETAS[i]; i += 1
            for j in range(start, start + L):
                t = z * a[j + L] % Q
                a[j + L] = (a[j] - t) % Q
                a[j] = (a[j] + t) % Q
        L //= 2
    return a

def ntt_inv(f):
    a, i, L = list(f), 127, 2
    while L <= 128:
        for start in range(0, N, 2 * L):
            z = ZETAS[i]; i -= 1
            for j in range(start, start + L):
                t = a[j]
                a[j] = (t + a[j + L]) % Q
                a[j + L] = z * (a[j + L] - t) % Q
        L *= 2
    return [x * 3303 % Q for x in a]   # 3303 = 128⁻¹ mod q

def mul_ntt(f, g):
    """NTT 영역 곱: 128 개의 (X² − γᵢ) 슬롯마다 1차 다항식 곱셈 (BaseCaseMultiply)"""
    h = [0] * N
    for i in range(128):
        a0, a1, b0, b1, gm = f[2 * i], f[2 * i + 1], g[2 * i], g[2 * i + 1], GAMMAS[i]
        h[2 * i] = (a0 * b0 + a1 * b1 * gm) % Q
        h[2 * i + 1] = (a0 * b1 + a1 * b0) % Q
    return h

def add(f, g): return [(x + y) % Q for x, y in zip(f, g)]
def sub(f, g): return [(x - y) % Q for x, y in zip(f, g)]

# ---------------------------------------------------------------- K-PKE (알고리즘 13–15)
def kpke_keygen(d, P):
    k = P['k']
    rho, sigma = G(d + bytes([k]))                  # k 를 섞어 파라미터 집합끼리 도메인 분리
    A = [[sample_ntt(rho + bytes([j, i])) for j in range(k)] for i in range(k)]
    s = [sample_cbd(PRF(P['eta1'], sigma, i), P['eta1']) for i in range(k)]
    e = [sample_cbd(PRF(P['eta1'], sigma, k + i), P['eta1']) for i in range(k)]
    s_hat, e_hat = [ntt(x) for x in s], [ntt(x) for x in e]
    t_hat = []
    for i in range(k):
        acc = e_hat[i]
        for j in range(k):
            acc = add(acc, mul_ntt(A[i][j], s_hat[j]))
        t_hat.append(acc)
    ek = b''.join(byte_encode(t, 12) for t in t_hat) + rho
    dk = b''.join(byte_encode(x, 12) for x in s_hat)
    return ek, dk

def kpke_encrypt(ek, m, r, P, trace=None):
    k, du, dv = P['k'], P['du'], P['dv']
    t_hat = [byte_decode(ek[384 * i:384 * (i + 1)], 12) for i in range(k)]
    rho = ek[384 * k:]
    A = [[sample_ntt(rho + bytes([j, i])) for j in range(k)] for i in range(k)]
    y = [sample_cbd(PRF(P['eta1'], r, i), P['eta1']) for i in range(k)]
    e1 = [sample_cbd(PRF(P['eta2'], r, k + i), P['eta2']) for i in range(k)]
    e2 = sample_cbd(PRF(P['eta2'], r, 2 * k), P['eta2'])
    y_hat = [ntt(x) for x in y]
    u = []
    for i in range(k):                               # u = NTT⁻¹(Âᵀ ∘ ŷ) + e1
        acc = [0] * N
        for j in range(k):
            acc = add(acc, mul_ntt(A[j][i], y_hat[j]))
        u.append(add(ntt_inv(acc), e1[i]))
    mu = [decompress(b, 1) for b in byte_decode(m, 1)]
    acc = [0] * N
    for i in range(k):
        acc = add(acc, mul_ntt(t_hat[i], y_hat[i]))
    v = add(add(ntt_inv(acc), e2), mu)              # v = NTT⁻¹(t̂ᵀ ∘ ŷ) + e2 + μ
    if trace is not None:
        trace.update(mu=mu)
    c1 = b''.join(byte_encode([compress(x, du) for x in ui], du) for ui in u)
    c2 = byte_encode([compress(x, dv) for x in v], dv)
    return c1 + c2

def kpke_decrypt(dk, c, P, trace=None):
    k, du, dv = P['k'], P['du'], P['dv']
    u = [[decompress(x, du) for x in byte_decode(c[32 * du * i:32 * du * (i + 1)], du)] for i in range(k)]
    v = [decompress(x, dv) for x in byte_decode(c[32 * du * k:], dv)]
    s_hat = [byte_decode(dk[384 * i:384 * (i + 1)], 12) for i in range(k)]
    acc = [0] * N
    for i in range(k):
        acc = add(acc, mul_ntt(s_hat[i], ntt(u[i])))
    w = sub(v, ntt_inv(acc))                        # w = v′ − NTT⁻¹(ŝᵀ ∘ NTT(u′))
    if trace is not None:
        trace.update(w=w)
    return byte_encode([compress(x, 1) for x in w], 1)

# ---------------------------------------------------------------- ML-KEM (알고리즘 16–18)
def keygen_internal(d, z, P):
    ek, dk_pke = kpke_keygen(d, P)
    return ek, dk_pke + ek + H(ek) + z

def check_ek(ek, P):
    """캡슐화 키 검사: 길이 + 'modulus check' (12비트 값이 모두 q 미만인가)"""
    k = P['k']
    if len(ek) != 384 * k + 32:
        return False
    return all(byte_encode(byte_decode(ek[384 * i:384 * (i + 1)], 12), 12) == ek[384 * i:384 * (i + 1)] for i in range(k))

def encaps_internal(ek, m, P):
    if not check_ek(ek, P):
        raise ValueError('잘못된 캡슐화 키')
    K, r = G(m + H(ek))
    return K, kpke_encrypt(ek, m, r, P)

def decaps_internal(dk, c, P):
    k, du, dv = P['k'], P['du'], P['dv']
    if len(c) != 32 * (du * k + dv) or len(dk) != 768 * k + 96:
        raise ValueError('길이 검사 실패')
    dk_pke, ek = dk[:384 * k], dk[384 * k:768 * k + 32]
    h, z = dk[768 * k + 32:768 * k + 64], dk[768 * k + 64:]
    if H(ek) != h:
        raise ValueError('해시 검사 실패 (dk 손상)')
    m2 = kpke_decrypt(dk_pke, c, P)
    K2, r2 = G(m2 + h)
    Kbar = J(z + c)
    c2 = kpke_encrypt(ek, m2, r2, P)
    return K2 if c == c2 else Kbar                  # 실제 구현은 이 비교·선택을 상수 시간으로!

def keygen(P): return keygen_internal(os.urandom(32), os.urandom(32), P)
def encaps(ek, P): return encaps_internal(ek, os.urandom(32), P)

# ---------------------------------------------------------------- 복호 실패 확률 (16장 3절)
def pmf_cbd(eta):
    return {x: math.comb(2 * eta, eta + x) / 4 ** eta for x in range(-eta, eta + 1)}

def pmf_compress_error(d):
    """x 가 ℤ_q 에서 균등할 때 (Decompress(Compress(x)) − x) mod± q 의 분포"""
    out = {}
    for x in range(Q):
        e = (decompress(compress(x, d), d) - x) % Q
        e = e - Q if e > Q // 2 else e
        out[e] = out.get(e, 0) + 1 / Q
    return out

def pmf_add(a, b, eps=2.0 ** -300):
    out = {}
    for x, p in a.items():
        for y, r in b.items():
            out[x + y] = out.get(x + y, 0.0) + p * r
    return {x: p for x, p in out.items() if p > eps}

def pmf_mul(a, b):
    out = {}
    for x, p in a.items():
        for y, r in b.items():
            out[x * y] = out.get(x * y, 0.0) + p * r
    return out

def pmf_power(a, n):
    res, base = {0: 1.0}, a
    while n:
        if n & 1: res = pmf_add(res, base)
        n >>= 1
        if n: base = pmf_add(base, base)
    return res

def failure_probability(P):
    """
    잡음 = eᵀr + e2 + Δv − sᵀ(e1 + Δu). 각 계수를 nk 개 곱의 합으로 보고(독립 가정),
    한 계수가 |·| > q/4 일 확률에 n = 256 을 곱한다(합집합 상한). Kyber 설계 문서의 계산과 같은 방식.
    """
    k, n = P['k'], N
    s, e1 = pmf_cbd(P['eta1']), pmf_cbd(P['eta2'])
    term1 = pmf_power(pmf_mul(s, s), n * k)                                   # eᵀr
    term2 = pmf_power(pmf_mul(s, pmf_add(e1, pmf_compress_error(P['du']))), n * k)  # sᵀ(e1 + Δu)
    term3 = pmf_add(pmf_cbd(P['eta2']), pmf_compress_error(P['dv']))         # e2 + Δv
    D = pmf_add(pmf_add(term1, term2), term3)
    tail = sum(p for x, p in D.items() if abs(x) > Q / 4)
    return n * tail

# ---------------------------------------------------------------- 실행
def selftest():
    rnd = random.Random(2024)
    for name, P in PARAMS.items():
        ek, dk = keygen_internal(rnd.randbytes(32), rnd.randbytes(32), P)
        K, c = encaps_internal(ek, rnd.randbytes(32), P)
        assert decaps_internal(dk, c, P) == K, '복원 실패'
        bad = bytearray(c); bad[0] ^= 1
        Kb = decaps_internal(dk, bytes(bad), P)
        assert Kb != K and Kb == J(dk[-32:] + bytes(bad)), '암묵적 거부 실패'
        k = P['k']
        print(f'ML-KEM-{name}: ek {len(ek)} B, dk {len(dk)} B, ct {len(c)} B — 복원 ✅, 변조 시 암묵적 거부 ✅')
    # NTT 곱 = 교과서식 negacyclic 곱
    f = [rnd.randrange(Q) for _ in range(N)]; g = [rnd.randrange(Q) for _ in range(N)]
    h = [0] * N
    for i in range(N):
        for j in range(N):
            if i + j < N: h[i + j] += f[i] * g[j]
            else: h[i + j - N] -= f[i] * g[j]
    assert ntt_inv(mul_ntt(ntt(f), ntt(g))) == [x % Q for x in h]
    print('NTT 곱 = xⁿ + 1 에서의 교과서식 곱 ✅')
    # 고정 입력에 대한 회귀값: 코드를 고쳤을 때 출력이 바뀌었는지 잡아내는 용도.
    # (공식 적합성은 NIST ACVP 테스트 벡터로 확인하세요 — 연습 3)
    P = PARAMS[768]
    ek, dk = keygen_internal(bytes(range(32)), bytes(range(32, 64)), P)
    K, c = encaps_internal(ek, bytes(range(64, 96)), P)
    digest = H(ek + dk + c + K).hex()[:16]
    print(f'고정 입력 회귀값 (ML-KEM-768): {digest}', '✅' if digest == KAT768 else '❌ (구현이 바뀌었나?)')
    if digest != KAT768:
        sys.exit(1)

KAT768 = '04182bace5128633'

def noise_experiment(name, trials):
    P = PARAMS[name]
    rnd = random.Random(1)
    ek, dk = keygen_internal(rnd.randbytes(32), rnd.randbytes(32), P)
    worst, total, hist, sq = 0, 0, {}, 0
    for _ in range(trials):
        m = rnd.randbytes(32)
        c = kpke_encrypt(ek, m, rnd.randbytes(32), P, trace=(tr := {}))
        kpke_decrypt(dk[:384 * P['k']], c, P, trace=tr)
        for w, mu in zip(tr['w'], tr['mu']):
            e = (w - mu) % Q
            e = e - Q if e > Q // 2 else e
            worst = max(worst, abs(e)); total += 1; sq += e * e
            hist[e // 50 * 50] = hist.get(e // 50 * 50, 0) + 1
    print(f'ML-KEM-{name}: {trials} 번 암호화, 계수 {total} 개의 잡음. 표준편차 ≈ {(sq / total) ** 0.5:.1f}, 최대 |잡음| = {worst}  (경계 q/4 ≈ {Q / 4:.0f})')
    for b in sorted(hist):
        print(f'  [{b:5d},{b + 49:5d}] {"#" * max(1, round(60 * hist[b] / max(hist.values())))} {hist[b]}')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--failure', action='store_true', help='δ 정확 계산 (몇 초)')
    ap.add_argument('--noise', type=int, choices=[512, 768, 1024], help='복호 잡음 측정')
    ap.add_argument('--trials', type=int, default=20)
    a = ap.parse_args()
    if a.failure:
        for name, P in PARAMS.items():
            d = failure_probability(P)
            print(f'ML-KEM-{name}: δ ≈ 2^{math.log2(d):.1f}')
    elif a.noise:
        noise_experiment(a.noise, a.trials)
    else:
        selftest()
