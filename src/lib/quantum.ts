/**
 * 5장: 양자 알고리즘의 고전 시뮬레이션 (교육용, 작은 크기).
 */
import { gcd, modPow } from './algebra';

/* ------------------------------------------------------------------ */
/* 그로버                                                               */
/* ------------------------------------------------------------------ */

/** 상태 벡터(실수 진폭)로 그로버를 k 번 반복. marked: 표시된 원소 집합 */
export function groverAmplitudes(N: number, marked: Set<number>, k: number): number[] {
  let a = new Array(N).fill(1 / Math.sqrt(N));
  for (let t = 0; t < k; t++) {
    // 오라클: 표시된 원소의 부호를 뒤집는다
    a = a.map((x, i) => (marked.has(i) ? -x : x));
    // 확산: 평균에 대해 뒤집기  a ← 2·mean − a
    const mean = a.reduce((s, x) => s + x, 0) / N;
    a = a.map((x) => 2 * mean - x);
  }
  return a;
}

/** 닫힌 꼴: 성공 확률 sin²((2k+1)θ),  sin θ = √(M/N) */
export function groverSuccess(N: number, M: number, k: number): number {
  const th = Math.asin(Math.sqrt(M / N));
  return Math.sin((2 * k + 1) * th) ** 2;
}

/** 최적 반복 횟수 ⌊π/(4θ)⌋ */
export const groverOptimal = (N: number, M: number): number => Math.floor(Math.PI / (4 * Math.asin(Math.sqrt(M / N))));

/* ------------------------------------------------------------------ */
/* 쇼어: 위수 찾기                                                        */
/* ------------------------------------------------------------------ */

/** a 의 위수 r (a^r ≡ 1 mod N), 고전적 전수조사 (작은 N 용) */
export function orderMod(a: number, N: number): number {
  let x = a % N;
  for (let r = 1; r <= N; r++) {
    if (x === 1) return r;
    x = (x * a) % N;
  }
  return -1;
}

/**
 * 양자 위수 찾기의 측정 분포 (정확한 계산).
 * 첫 레지스터 크기 Q = 2^t. f(x) = aˣ mod N 을 측정한 뒤 QFT 를 하고 y 를 측정할 확률 P(y).
 * P(y) = Σ_{x₀=0}^{r−1} |Σ_{j=0}^{m(x₀)−1} e^{2πi·y·j·r/Q}|² / Q²
 */
export function shorDistribution(a: number, N: number, t: number): { Q: number; r: number; P: number[] } {
  const Q = 2 ** t;
  const r = orderMod(a, N);
  const P = new Array(Q).fill(0);
  for (let x0 = 0; x0 < r; x0++) {
    const m = Math.floor((Q - 1 - x0) / r) + 1;
    for (let y = 0; y < Q; y++) {
      const th = (2 * Math.PI * y * r) / Q;
      let re = 0, im = 0;
      // 등비급수 합을 직접 계산 (작은 크기)
      for (let j = 0; j < m; j++) { re += Math.cos(th * j); im += Math.sin(th * j); }
      P[y] += (re * re + im * im) / (Q * Q);
    }
  }
  return { Q, r, P };
}

/** y/Q 의 연분수 근사분수들 (분모 < maxDen) */
export function convergents(num: number, den: number, maxDen: number): [number, number][] {
  const out: [number, number][] = [];
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let a = num, b = den;
  while (b !== 0) {
    const q = Math.floor(a / b);
    [h0, h1] = [h1, q * h1 + h0];
    [k0, k1] = [k1, q * k1 + k0];
    if (k1 >= maxDen) break;
    out.push([h1, k1]);
    [a, b] = [b, a - q * b];
  }
  return out;
}

/** 측정값 y 로부터 위수 후보를 찾는다: 근사분수의 분모 d 와 그 작은 배수 중 a^d ≡ 1 인 것 */
export function orderFromMeasurement(y: number, Q: number, a: number, N: number): number | null {
  for (const [, d] of convergents(y, Q, N)) {
    for (let mult = 1; mult * d <= N; mult++) if (d > 0 && modPow(a, mult * d, N) === 1) return mult * d;
  }
  return null;
}

/** 위수 r 로부터 인수: r 짝수, a^{r/2} ≢ −1 이면 gcd(a^{r/2} ± 1, N) */
export function factorFromOrder(a: number, r: number, N: number): [number, number] | null {
  if (r % 2 === 1) return null;
  const h = modPow(a, r / 2, N);
  if (h === N - 1) return null;
  const p = gcd(h - 1, N), q = gcd(h + 1, N);
  if (p > 1 && p < N) return [p, N / p];
  if (q > 1 && q < N) return [q, N / q];
  return null;
}
