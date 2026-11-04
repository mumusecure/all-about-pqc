/**
 * 논문 읽기 5: Ducas–van Woerden, NTRU Fatigue (Asiacrypt 2021) 의 실험 방법을 작은 차원에서 따라 하기 (교육용).
 *
 * 삼진 NTRU 키 (f, g ← {−1,0,1}ⁿ, h = g·f⁻¹ mod q) 의 격자 Λ = {(u, v) : u ≡ v·h (mod q)} 에
 * LLL → BKZ-4 → BKZ-6 → … 을 돌리며, 기저에 키 부분격자 L_key = {(a·g, a·f)} 의 벡터가 처음 나타나는 순간을 본다.
 *
 *  - DSD (dense sublattice discovery): 회전이 아닌(키보다 긴) L_key 벡터가 섞여 있거나, L_key 벡터가 한꺼번에 n/4 개 이상
 *  - SKR (secret key recovery): 그 밖의 경우 (키의 회전이 몇 개만)
 *
 * DvW 의 실험 코드는 SVP 호출이 벡터를 끼워 넣는 순간을 가로채 "그 벡터가 L_key 에 있고 키보다 긴가" 로 가른다.
 * 이 교과서의 사다리는 칸(두 투어)이 끝난 뒤의 기저만 보므로, 그사이 LLL 이 긴 벡터를 회전으로 줄여 버린 경우를
 * "한꺼번에 많이" 로 잡는다. 판정 규칙은 이 교과서의 근사다.
 */
import { mod } from './algebra';
import { bkzTour } from './bkz';
import { type Basis, lll } from './lattice';
import { type Rng } from './lwe';
import { polyInverse, rotate } from './ntru';

/** 멤버십 검사용 큰 소수 (2³⁰ 근처) */
const P = 1073741789;

export interface TernaryKey { n: number; q: number; f: number[]; g: number[]; h: number[]; fInvP: number[]; }

const tern = (n: number, rng: Rng) => Array.from({ length: n }, () => Math.floor(rng() * 3) - 1);

/** 정수 위의 negacyclic 곱 (mod 없음) */
export function negamulZ(a: number[], b: number[]) {
  const n = a.length, h = new Array(n).fill(0);
  for (let i = 0; i < n; i++) if (a[i]) for (let j = 0; j < n; j++) { const k = i + j; if (k < n) h[k] += a[i] * b[j]; else h[k - n] -= a[i] * b[j]; }
  return h;
}

/** BigInt 로 a·b mod p (negacyclic) */
function negamulModBig(a: number[], b: number[], p: number) {
  const n = a.length, h = new Array<bigint>(n).fill(0n), pb = BigInt(p);
  for (let i = 0; i < n; i++) if (a[i]) { const ai = BigInt(a[i]); for (let j = 0; j < n; j++) { const k = i + j, t = ai * BigInt(b[j]); if (k < n) h[k] += t; else h[k - n] -= t; } }
  return h.map((x) => Number(((x % pb) + pb) % pb));
}

/** f, g 삼진, f 가 mod q 와 mod P 에서 모두 가역인 키 */
export function ternaryKeyGen(n: number, q: number, rng: Rng): TernaryKey {
  for (;;) {
    const f = tern(n, rng), g = tern(n, rng);
    const fq = polyInverse(f, q); if (!fq) continue;
    const fInvP = polyInverse(f, P); if (!fInvP) continue;
    const h = negamulModBig(g.map((c) => mod(c, q)), fq, q);
    return { n, q, f, g, h, fInvP };
  }
}

/** 기저 행: (q·eᵢ, 0) 과 (xⁱ·h, eᵢ). (g, f) 와 그 회전이 짧은 격자 벡터 */
export function fatigueLattice(key: TernaryKey): Basis {
  const { n, q, h } = key, B: Basis = [];
  for (let i = 0; i < n; i++) B.push([...Array.from({ length: n }, (_, j) => (i === j ? q : 0)), ...new Array(n).fill(0)]);
  for (let i = 0; i < n; i++) B.push([...rotate(h, i).map((c) => mod(c, q)), ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  return B;
}

/**
 * w = (u, v) 가 L_key 에 속하면 그 계수 a (w = (a·g, a·f)), 아니면 null.
 * a ≡ v·f⁻¹ (mod P) 를 중심 대표값으로 올린 뒤 정수 위에서 정확히 검산한다.
 */
export function keyCoeff(w: number[], key: TernaryKey): number[] | null {
  const { n } = key, u = w.slice(0, n), v = w.slice(n);
  const a = negamulModBig(v.map((c) => mod(c, P)), key.fInvP, P).map((c) => (c > P / 2 ? c - P : c));
  if (a.some((c) => Math.abs(c) > 1e6)) return null;
  const af = negamulZ(a, key.f), ag = negamulZ(a, key.g);
  return af.every((x, i) => x === v[i]) && ag.every((x, i) => x === u[i]) ? a : null;
}

/** a 가 ±xⁱ 꼴(= 키의 회전)인가 */
export const isMonomial = (a: number[]) => a.filter((c) => c !== 0).length === 1 && a.some((c) => Math.abs(c) === 1);

export interface FatigueStep { beta: number; inKey: number; rotations: number; ms: number; }
export type FatigueEvent = 'SKR' | 'DSD' | null;

/** 기저 안의 L_key 벡터 수와 그중 회전 수 */
export function scanBasis(B: Basis, key: TernaryKey) {
  let inKey = 0, rotations = 0;
  for (const w of B) { const a = keyCoeff(w, key); if (a) { inKey++; if (isMonomial(a)) rotations++; } }
  return { inKey, rotations };
}

export const classify = (s: { inKey: number; rotations: number }, n: number): FatigueEvent =>
  s.inKey === 0 ? null : s.inKey > s.rotations || s.inKey >= n / 4 ? 'DSD' : 'SKR';

/**
 * 진행형 사다리: β = 2(LLL), 4, 6, …, betaMax. 각 칸에서 BKZ 를 tours 번 돌리고, L_key 벡터가 처음 나타나면 멈춘다.
 * onStep 이 false 를 돌려주면 중단.
 */
export function fatigueLadder(key: TernaryKey, betaMax = 30, tours = 2, onStep?: (s: FatigueStep) => boolean | void) {
  let t = Date.now();
  let B = lll(fatigueLattice(key), 0.99).basis;
  const steps: FatigueStep[] = [];
  const push = (beta: number) => { const s = { beta, ...scanBasis(B, key), ms: Date.now() - t }; steps.push(s); t = Date.now(); return s; };
  let s = push(2);
  if (onStep?.(s) === false) return { steps, event: null as FatigueEvent };
  for (let beta = 4; !s.inKey && beta <= betaMax; beta += 2) {
    for (let i = 0; i < tours; i++) B = bkzTour(B, beta).basis;
    s = push(beta);
    if (onStep?.(s) === false) break;
  }
  return { steps, event: classify(s, key.n), beta: s.inKey ? s.beta : null };
}

/** DvW 의 삼진 비밀 fatigue point q* ≈ 0.004·n^2.484 */
export const qStarDvW = (n: number) => 0.004 * Math.pow(n, 2.484);
