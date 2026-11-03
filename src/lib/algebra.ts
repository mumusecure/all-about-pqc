/**
 * 정수론·대수 기본 도구 (교육용). 2장의 위젯과 연습문제에서 쓴다.
 * 모든 연산은 Number 로 하며, 값이 2^53 을 넘지 않는 작은 모듈러스를 가정한다.
 */

export const mod = (x: number, q: number): number => ((x % q) + q) % q;

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export interface EgcdRow {
  /** r_{i-1} = quotient · r_i + r_{i+1} 에서의 값들 */
  r: number;
  s: number;
  t: number;
  quotient: number | null;
}

/**
 * 확장 유클리드 알고리즘. 각 행은 r_i = s_i·a + t_i·b 를 만족한다.
 * 마지막 0 이 아닌 r 이 gcd(a, b) 이다.
 */
export function egcdSteps(a: number, b: number): EgcdRow[] {
  const rows: EgcdRow[] = [
    { r: a, s: 1, t: 0, quotient: null },
    { r: b, s: 0, t: 1, quotient: null },
  ];
  while (rows[rows.length - 1].r !== 0) {
    const prev = rows[rows.length - 2];
    const cur = rows[rows.length - 1];
    const qt = Math.floor(prev.r / cur.r);
    rows.push({ r: prev.r - qt * cur.r, s: prev.s - qt * cur.s, t: prev.t - qt * cur.t, quotient: qt });
  }
  return rows;
}

/** (g, s, t) with s·a + t·b = g = gcd(a, b) */
export function egcd(a: number, b: number): [number, number, number] {
  const rows = egcdSteps(a, b);
  const last = rows[rows.length - 2];
  return [last.r, last.s, last.t];
}

/** a^{-1} mod q. 존재하지 않으면 null. */
export function modInverse(a: number, q: number): number | null {
  const [g, s] = egcd(mod(a, q), q);
  return g === 1 ? mod(s, q) : null;
}

export function modPow(base: number, exp: number, q: number): number {
  let result = 1 % q;
  let b = mod(base, q);
  let e = exp;
  while (e > 0) {
    if (e & 1) result = Number((BigInt(result) * BigInt(b)) % BigInt(q));
    b = Number((BigInt(b) * BigInt(b)) % BigInt(q));
    e = Math.floor(e / 2);
  }
  return result;
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

/** 곱셈군 ℤ_q^* 에서 a 의 위수. gcd(a,q) ≠ 1 이면 null. */
export function multOrder(a: number, q: number): number | null {
  if (gcd(a, q) !== 1) return null;
  let x = mod(a, q);
  for (let k = 1; k <= q; k++) {
    if (x === 1 % q) return k;
    x = mod(x * a, q);
  }
  return null;
}

/**
 * 중국인의 나머지 정리: x ≡ r_i (mod m_i) (m_i 서로소)의 해 x ∈ [0, ∏m_i).
 * 서로소가 아니면 null.
 */
export function crt(residues: number[], moduli: number[]): number | null {
  let x = 0;
  let M = 1;
  for (let i = 0; i < moduli.length; i++) {
    const m = moduli[i];
    const inv = modInverse(M, m);
    if (inv === null) return null;
    // x ← x + M · ((r_i − x)·M^{-1} mod m)
    const k = mod((residues[i] - x) * inv, m);
    x += M * k;
    M *= m;
  }
  return mod(x, M);
}

/* ------------------------------------------------------------------ */
/* 다항식 환 ℤ_q[x]/(x^n + 1)                                            */
/* 다항식은 계수 배열 [c_0, c_1, ..., c_{n-1}] (c_i 는 x^i 의 계수)          */
/* ------------------------------------------------------------------ */

export type Poly = number[];

export const polyAdd = (f: Poly, g: Poly, q: number): Poly => f.map((c, i) => mod(c + g[i], q));

/** 몫환 ℤ_q[x]/(x^n + 1) 에서의 곱셈 (교과서식 O(n²)). x^n = −1 이므로 넘친 항은 부호를 바꿔 되감는다. */
export function polyMulNegacyclic(f: Poly, g: Poly, q: number): Poly {
  const n = f.length;
  const h = new Array(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const k = i + j;
      if (k < n) h[k] += f[i] * g[j];
      else h[k - n] -= f[i] * g[j];
    }
  return h.map((c) => mod(c, q));
}

/** 일반 다항식 곱 (차수 제한 없음) */
export function polyMulFull(f: Poly, g: Poly, q: number): Poly {
  const h = new Array(f.length + g.length - 1).fill(0);
  for (let i = 0; i < f.length; i++) for (let j = 0; j < g.length; j++) h[i + j] += f[i] * g[j];
  return h.map((c) => mod(c, q));
}

/** 다항식을 x^n + 1 로 나눈 나머지 (긴 다항식 → 길이 n) */
export function reduceNegacyclic(h: Poly, n: number, q: number): Poly {
  const r = new Array(n).fill(0);
  h.forEach((c, k) => {
    const blk = Math.floor(k / n);
    r[k % n] += blk % 2 === 0 ? c : -c;
  });
  return r.map((c) => mod(c, q));
}

/** f(x) 를 x = a 에서 계산 (Horner) */
export function polyEval(f: Poly, a: number, q: number): number {
  let acc = 0;
  for (let i = f.length - 1; i >= 0; i--) acc = mod(acc * a + f[i], q);
  return acc;
}

/** x^n + 1 ≡ 0 의 ℤ_q 근 (= 원시 2n제곱근들). q ≡ 1 (mod 2n) 이면 n 개. */
export function negacyclicRoots(n: number, q: number): number[] {
  const roots: number[] = [];
  for (let x = 0; x < q; x++) if (mod(modPow(x, n, q) + 1, q) === 0) roots.push(x);
  return roots;
}

/**
 * 라그랑주 보간: 서로 다른 점 xs 에서 값 ys 를 갖는 차수 < n 다항식 (q 소수).
 * CRT(=NTT) 의 역변환을 손으로 보여주기 위한 단순 구현.
 */
export function interpolate(xs: number[], ys: number[], q: number): Poly {
  const n = xs.length;
  let result = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    // L_i(x) = ∏_{j≠i} (x − x_j)/(x_i − x_j)
    let basis: Poly = [1];
    let denom = 1;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      basis = polyMulFull(basis, [mod(-xs[j], q), 1], q);
      denom = mod(denom * (xs[i] - xs[j]), q);
    }
    const coef = mod(ys[i] * (modInverse(denom, q) ?? 0), q);
    result = result.map((c, k) => mod(c + coef * (basis[k] ?? 0), q));
  }
  return result;
}
