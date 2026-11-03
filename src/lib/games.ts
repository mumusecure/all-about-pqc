/**
 * 1장: 안전성 게임 시뮬레이터 (교육용).
 * 도전자와 공격자가 IND-CPA / IND-CCA 게임을 여러 번 하고, 공격자의 이득을 측정한다.
 */
import { type Rng, centerMod, mod, mulberry32, regevDecrypt, regevEncrypt, regevKeyGen } from './lwe';

export type SchemeKey = 'det' | 'regev' | 'regev0';
export type AdvKey = 'guess' | 'reencrypt' | 'solve' | 'maul';

export const N_DIM = 12, M_SAMPLES = 48, Q = 257;

/* ---------- 결정적(deterministic) 토이 공개키 암호: c = H(pk ‖ m) 형태 ---------- */
function mix(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}
const detEnc = (pk: number, m: 0 | 1) => mix(pk * 2 + m);

/* ---------- 가우스 소거로 노이즈 없는 LWE 풀기 (mod 소수 q) ---------- */
export function solveNoiseless(A: number[][], b: number[], q: number): number[] | null {
  const n = A[0].length;
  const M = A.map((row, i) => [...row.map((x) => mod(x, q)), mod(b[i], q)]);
  const inv = (a: number) => {
    let [r0, r1, s0, s1] = [q, mod(a, q), 0, 1];
    while (r1) { const t = Math.floor(r0 / r1); [r0, r1] = [r1, r0 - t * r1]; [s0, s1] = [s1, s0 - t * s1]; }
    return r0 === 1 ? mod(s0, q) : null;
  };
  let row = 0;
  const pivots: number[] = [];
  for (let c = 0; c < n && row < M.length; c++) {
    const p = M.findIndex((r, i) => i >= row && r[c] !== 0);
    if (p < 0) continue;
    [M[row], M[p]] = [M[p], M[row]];
    const iv = inv(M[row][c])!;
    M[row] = M[row].map((x) => mod(x * iv, q));
    for (let r = 0; r < M.length; r++) if (r !== row && M[r][c]) { const f = M[r][c]; M[r] = M[r].map((x, j) => mod(x - f * M[row][j], q)); }
    pivots.push(c);
    row++;
  }
  if (pivots.length < n) return null;
  // 나머지 식과의 일관성 검사(노이즈가 있으면 깨진다)
  for (let r = n; r < M.length; r++) if (M[r][n] !== 0) return null;
  const s = new Array(n).fill(0);
  pivots.forEach((c, i) => (s[c] = M[i][n]));
  return s;
}

export interface GameResult { wins: number; games: number; advantage: number; ci95: number; note: string; }

/**
 * IND 게임을 games 번 반복한다. 메시지는 m₀ = 0, m₁ = 1 (1비트).
 * mode 'cpa': 복호 오라클 없음. 'cca': 도전 암호문만 빼고 복호 오라클 사용 가능.
 */
export function playIND(scheme: SchemeKey, adv: AdvKey, mode: 'cpa' | 'cca', games: number, seed: number): GameResult {
  const rng: Rng = mulberry32(seed);
  let wins = 0;
  let note = '';
  for (let t = 0; t < games; t++) {
    const b = (rng() < 0.5 ? 0 : 1) as 0 | 1;
    let guess: 0 | 1 = rng() < 0.5 ? 0 : 1;
    if (scheme === 'det') {
      const pk = Math.floor(rng() * 2 ** 31);
      const c = detEnc(pk, b);
      if (adv === 'reencrypt') guess = detEnc(pk, 1) === c ? 1 : 0;
      else if (adv === 'maul' && mode === 'cca') note = '결정적 스킴에서는 변조 대신 재암호화로 충분합니다.';
    } else {
      const sigma = scheme === 'regev0' ? 0 : 1.5;
      const { pk, sk } = regevKeyGen({ n: N_DIM, m: M_SAMPLES, q: Q, sigma }, rng);
      const ct = regevEncrypt(pk, b, rng);
      if (adv === 'reencrypt') {
        // 확률적 암호화: 같은 메시지를 다시 암호화해도 다른 암호문 → 비교가 쓸모없다
        const c1 = regevEncrypt(pk, 1, rng);
        guess = c1.v === ct.v && c1.u.every((x, i) => x === ct.u[i]) ? 1 : 0;
      } else if (adv === 'solve') {
        const s = solveNoiseless(pk.A, pk.b, Q);
        if (s) {
          const w = mod(ct.v - ct.u.reduce((acc, x, j) => acc + x * s[j], 0), Q);
          guess = Math.abs(centerMod(w, Q)) < Q / 4 ? 0 : 1;
        }
      } else if (adv === 'maul') {
        if (mode === 'cca') {
          // (u, v + ⌊q/2⌋) 는 도전 암호문과 다르므로 복호 오라클에 물어볼 수 있다 → 1 − b 를 돌려준다
          const mauled = { ...ct, v: mod(ct.v + Math.floor(Q / 2), Q) };
          guess = (1 - regevDecrypt(sk, mauled, Q)) as 0 | 1;
        }
      }
    }
    if (guess === b) wins++;
  }
  const rate = wins / games;
  return { wins, games, advantage: Math.abs(rate - 0.5), ci95: 1.96 * Math.sqrt(0.25 / games), note };
}

/** 생일 공격: t 비트 출력의 (의사)무작위 함수에서 충돌이 날 때까지 질의한 횟수 */
export function birthdayTrial(tBits: number, seed: number): number {
  const seen = new Set<number>();
  const mask = tBits >= 32 ? 0xffffffff : (1 << tBits) - 1;
  for (let i = 1; ; i++) {
    const h = (mix(seed * 1_000_003 + i) & mask) >>> 0;
    if (seen.has(h)) return i;
    seen.add(h);
  }
}
