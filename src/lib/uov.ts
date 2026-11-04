/**
 * 24장: Unbalanced Oil and Vinegar 토이 (GF(p), 작은 크기, 교육용).
 * 중심 사상 F 의 각 식에는 기름×기름 항이 없다 → 식초 변수를 고정하면 기름 변수에 대해 선형.
 * 공개키 P = F ∘ T (T 는 비밀 가역 선형 변환).
 */
import { type Rng, mulberry32 } from './lwe';

const md = (x: number, p: number) => ((x % p) + p) % p;
const inv = (a: number, p: number) => { let r = 1, b = md(a, p), e = p - 2; while (e) { if (e & 1) r = (r * b) % p; b = (b * b) % p; e >>= 1; } return r; };

export interface UOV { p: number; v: number; o: number; n: number; F: number[][][]; T: number[][]; Tinv: number[][]; P: number[][][]; }

/** n×n 행렬 M 으로 이차형식 x ↦ xᵀ Q x 를 표현 (상삼각만 씀) */
const evalQuad = (Q: number[][], x: number[], p: number) => { let s = 0; for (let i = 0; i < x.length; i++) for (let j = i; j < x.length; j++) s += Q[i][j] * x[i] * x[j]; return md(s, p); };

function solve(A: number[][], b: number[], p: number): number[] | null {
  const n = A.length, M = A.map((row, i) => [...row.map((x) => md(x, p)), md(b[i], p)]);
  for (let c = 0; c < n; c++) {
    const r = M.findIndex((row, i) => i >= c && row[c] !== 0); if (r < 0) return null;
    [M[c], M[r]] = [M[r], M[c]];
    const iv = inv(M[c][c], p); M[c] = M[c].map((x) => (x * iv) % p);
    for (let i = 0; i < n; i++) if (i !== c && M[i][c]) { const f = M[i][c]; M[i] = M[i].map((x, j) => md(x - f * M[c][j], p)); }
  }
  return M.map((row) => row[n]);
}
function invMat(T: number[][], p: number): number[][] | null {
  const n = T.length, cols: number[][] = [];
  for (let j = 0; j < n; j++) { const e = new Array(n).fill(0); e[j] = 1; const c = solve(T, e, p); if (!c) return null; cols.push(c); }
  return Array.from({ length: n }, (_, i) => cols.map((c) => c[i]));
}

export function uovKeyGen(p: number, v: number, o: number, seed: number): UOV {
  const r: Rng = mulberry32(seed), n = v + o, rnd = () => Math.floor(r() * p);
  // 변수 순서: 0..v−1 식초, v..n−1 기름. 기름×기름 (i, j ≥ v) 계수는 0
  const F = Array.from({ length: o }, () => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (j < i ? 0 : i >= v && j >= v ? 0 : rnd()))));
  let T: number[][], Tinv: number[][] | null;
  do { T = Array.from({ length: n }, () => Array.from({ length: n }, rnd)); Tinv = invMat(T, p); } while (!Tinv);
  // P_k(x) = F_k(Tx):  Q_P = Tᵀ Q_F T (대칭화 후 상삼각으로)
  const P = F.map((Q) => {
    const S = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 * Q[i][i] : i < j ? Q[i][j] : Q[j][i])));
    const M = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => { let s = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += T[i][a] * S[i][j] * T[j][b]; return md(s, p); }));
    const half = inv(2, p);
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (j < i ? 0 : i === j ? md(M[i][i] * half, p) : md(M[i][j] + M[j][i], p) * half % p)));
  });
  return { p, v, o, n, F, T, Tinv: Tinv!, P };
}
export const publicEval = (K: UOV, x: number[]) => K.P.map((Q) => evalQuad(Q, x, K.p));

/** 서명: 식초를 무작위로 고르면 F(y) = t 가 기름 변수의 o×o 선형계. 특이하면 다시. x = T⁻¹ y */
export function uovSign(K: UOV, t: number[], seed: number) {
  const { p, v, o, n } = K, r = mulberry32(seed);
  for (let tries = 1; tries <= 100; tries++) {
    const vin = Array.from({ length: v }, () => Math.floor(r() * p));
    // F_k(vin, oil) = c_k + Σ_j L_kj oil_j
    const A: number[][] = [], b: number[] = [];
    K.F.forEach((Q, k) => {
      let c = 0; const L = new Array(o).fill(0);
      for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
        if (!Q[i][j]) continue;
        if (i < v && j < v) c += Q[i][j] * vin[i] * vin[j];
        else if (i < v && j >= v) L[j - v] += Q[i][j] * vin[i];
      }
      A.push(L.map((x) => md(x, p))); b.push(md(t[k] - c, p));
    });
    const oil = solve(A, b, p);
    if (!oil) continue;
    const y = [...vin, ...oil];
    const x = K.Tinv.map((row) => md(row.reduce((s, a, j) => s + a * y[j], 0), p));
    return { x, tries };
  }
  return null;
}
export const pkCoefficients = (K: UOV) => K.o * (K.n * (K.n + 1)) / 2;
