/**
 * 확률 도구 (교육용). 6장의 위젯·연습문제에서 쓴다.
 *
 * 정수 값 분포는 PMF 로 정확히 다룬다: { min, p } 에서 p[i] = Pr[X = min + i].
 * 합의 분포는 합성곱으로 정확히 계산하므로 2^{-100} 같은 아주 작은 꼬리 확률도
 * 표본 추출 없이 구할 수 있다(부동소수점 범위 안에서).
 */

export interface PMF {
  min: number;
  p: number[];
}

export const pmfSupport = (d: PMF): number[] => d.p.map((_, i) => d.min + i);

export function normalize(d: PMF): PMF {
  const s = d.p.reduce((a, b) => a + b, 0);
  return { min: d.min, p: d.p.map((x) => x / s) };
}

/** {−1, 0, 1} 균등 */
export const pmfTernary = (): PMF => ({ min: -1, p: [1 / 3, 1 / 3, 1 / 3] });

/** {0, 1} 균등 (Regev 암호의 r_i) */
export const pmfBit = (): PMF => ({ min: 0, p: [0.5, 0.5] });

function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/**
 * 중심 이항분포 CBD_η: Σ_{i=1}^{η} (a_i − b_i), a_i, b_i ← {0,1}.
 * Pr[X = k] = C(2η, η + k) / 4^η,  값의 범위 [−η, η], 분산 η/2.  (ML-KEM 의 노이즈 분포)
 */
export function pmfCBD(eta: number): PMF {
  return { min: -eta, p: Array.from({ length: 2 * eta + 1 }, (_, i) => binom(2 * eta, i) / 4 ** eta) };
}

/**
 * 이산 가우시안 D_{ℤ,s}: Pr[X = x] ∝ ρ_s(x) = exp(−π x² / s²).
 * 표준편차는 s 가 크면 σ ≈ s / √(2π).  꼬리는 |x| ≤ tail·s 에서 자른다.
 */
export function pmfDiscreteGaussian(s: number, tail = 12): PMF {
  const B = Math.max(1, Math.ceil(tail * s));
  const p = Array.from({ length: 2 * B + 1 }, (_, i) => Math.exp((-Math.PI * (i - B) ** 2) / (s * s)));
  return normalize({ min: -B, p });
}

/** 연속 가우시안 N(0, σ²) 을 반올림한 분포 */
export function pmfRoundedGaussian(sigma: number, tail = 12): PMF {
  const B = Math.max(1, Math.ceil(tail * sigma));
  const cdf = (x: number) => 0.5 * (1 + erf(x / (sigma * Math.SQRT2)));
  const p = Array.from({ length: 2 * B + 1 }, (_, i) => cdf(i - B + 0.5) - cdf(i - B - 0.5));
  return normalize({ min: -B, p });
}

/** 두 독립 확률변수의 곱 X·Y 의 분포 (정수 값) */
export function pmfProduct(a: PMF, b: PMF): PMF {
  const vals = new Map<number, number>();
  a.p.forEach((pa, i) => b.p.forEach((pb, j) => {
    const v = (a.min + i) * (b.min + j);
    vals.set(v, (vals.get(v) ?? 0) + pa * pb);
  }));
  const keys = [...vals.keys()];
  const min = Math.min(...keys), max = Math.max(...keys);
  const p = new Array(max - min + 1).fill(0);
  vals.forEach((v, k) => (p[k - min] = v));
  return { min, p };
}

/** 독립 합 X + Y 의 분포 = 합성곱 */
export function convolve(a: PMF, b: PMF): PMF {
  const p = new Array(a.p.length + b.p.length - 1).fill(0);
  for (let i = 0; i < a.p.length; i++) {
    if (a.p[i] === 0) continue;
    for (let j = 0; j < b.p.length; j++) p[i + j] += a.p[i] * b.p[j];
  }
  return { min: a.min + b.min, p };
}

/** k 개 독립 복사본의 합 (반복 제곱) */
export function convolvePower(d: PMF, k: number): PMF {
  let result: PMF = { min: 0, p: [1] };
  let base = d;
  let e = k;
  while (e > 0) {
    if (e & 1) result = convolve(result, base);
    e >>= 1;
    if (e) base = convolve(base, base);
  }
  return result;
}

export const mean = (d: PMF): number => d.p.reduce((s, x, i) => s + x * (d.min + i), 0);
export function variance(d: PMF): number {
  const m = mean(d);
  return d.p.reduce((s, x, i) => s + x * (d.min + i - m) ** 2, 0);
}

/** Pr[|X| > t] */
export function tailAbs(d: PMF, t: number): number {
  let s = 0;
  d.p.forEach((x, i) => { if (Math.abs(d.min + i) > t) s += x; });
  return s;
}

/** 통계적 거리 Δ(X, Y) = ½ Σ |Pr[X=a] − Pr[Y=a]| */
export function statDistance(a: PMF, b: PMF): number {
  const lo = Math.min(a.min, b.min);
  const hi = Math.max(a.min + a.p.length - 1, b.min + b.p.length - 1);
  let s = 0;
  for (let v = lo; v <= hi; v++) {
    const pa = a.p[v - a.min] ?? 0;
    const pb = b.p[v - b.min] ?? 0;
    s += Math.abs(pa - pb);
  }
  return s / 2;
}

/* ------------------------------------------------------------------ */
/* 연속 도구                                                            */
/* ------------------------------------------------------------------ */

/** 오차함수 (Abramowitz–Stegun 7.1.26, |오차| < 1.5e-7) */
export function erf(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
  return x >= 0 ? y : -y;
}

/**
 * 가우시안 근사 꼬리 2·exp(−t²/(2σ²)).
 * 진짜 정규분포 N(0,σ²) 에 대해서는 상한이지만, 분산이 σ² 인 '임의의' 분포의 합에 대해서는
 * 상한이 아니다(먼 꼬리에서 실제 확률이 더 클 수 있다). 6장 4절 참고.
 */
export const gaussianTailApprox = (t: number, sigma: number): number => Math.min(1, 2 * Math.exp(-(t * t) / (2 * sigma * sigma)));

/**
 * Hoeffding 상한: 각 항이 [a, b] 에 있는 독립 확률변수 k 개의 합 S (평균 0) 에 대해
 * Pr[|S| > t] ≤ 2·exp(−2t² / (k (b − a)²)).  항상 성립하는 (엄밀한) 상한.
 */
export const hoeffdingBound = (t: number, k: number, a: number, b: number): number =>
  Math.min(1, 2 * Math.exp((-2 * t * t) / (k * (b - a) ** 2)));

/** log Γ(x) (Lanczos 근사, x > 0) */
export function logGamma(x: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** n 차원 단위 공의 부피 V_n = π^{n/2} / Γ(n/2 + 1) 의 자연로그 */
export const logBallVolume = (n: number): number => (n / 2) * Math.log(Math.PI) - logGamma(n / 2 + 1);

/** 시드 고정 PRNG 에서 표준정규 표본 (Box–Muller) */
export function gaussianSample(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
