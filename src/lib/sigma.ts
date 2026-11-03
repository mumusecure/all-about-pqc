/**
 * 4장: Σ-프로토콜과 Fiat–Shamir (교육용 토이).
 * 군: ℤ_Q^* 의 위수 P_ORD 부분군, 생성원 G (Q = 2·P_ORD + 1, 둘 다 소수).
 */
import { modPow, modInverse, mod } from './algebra';
import { type Rng } from './lwe';

export const Q = 467, P_ORD = 233, G = 4;

export interface Transcript { R: number; c: number; s: number; }

export const keyGen = (rng: Rng) => {
  const x = 1 + Math.floor(rng() * (P_ORD - 1));
  return { x, X: modPow(G, x, Q) };
};

/** 정직한 증명자: 약속 R = g^k, 도전 c, 응답 s = k + c·x (mod p) */
export function prove(x: number, k: number, c: number): Transcript {
  return { R: modPow(G, k, Q), c, s: mod(k + c * x, P_ORD) };
}

/** 검증: g^s = R · X^c */
export const verify = (X: number, t: Transcript): boolean => modPow(G, t.s, Q) === mod(t.R * modPow(X, t.c, Q), Q);

/** HVZK 시뮬레이터: c, s 를 먼저 고르고 R = g^s · X^{−c} — 비밀 x 없이 유효한 대화록 */
export function simulate(X: number, c: number, s: number): Transcript {
  const Xc = modPow(X, c, Q);
  return { R: mod(modPow(G, s, Q) * (modInverse(Xc, Q) as number), Q), c, s };
}

/** 특수 건전성 추출기: 같은 R, 다른 c 의 두 대화록 → x = (s₁ − s₂)/(c₁ − c₂) */
export function extract(t1: Transcript, t2: Transcript): number | null {
  if (t1.R !== t2.R || t1.c === t2.c) return null;
  const inv = modInverse(mod(t1.c - t2.c, P_ORD), P_ORD);
  return inv === null ? null : mod((t1.s - t2.s) * inv, P_ORD);
}

/** Fiat–Shamir 의 도전값: c = H(R, m) mod p  (토이 해시) */
export function fsChallenge(R: number, msg: string): number {
  let h = 0x811c9dc5 ^ R;
  for (let i = 0; i < msg.length; i++) h = Math.imul(h ^ msg.charCodeAt(i), 0x01000193) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return h % P_ORD;
}
export const sign = (x: number, k: number, msg: string): Transcript => {
  const R = modPow(G, k, Q);
  return prove(x, k, fsChallenge(R, msg));
};
export const verifySig = (X: number, msg: string, t: Transcript) => t.c === fsChallenge(t.R, msg) && verify(X, t);

/* ------------------------------------------------------------------ */
/* 거절 샘플링 (Fiat–Shamir with aborts 의 1차원 축소판)                    */
/* ------------------------------------------------------------------ */

/**
 * z = y + c·s,  y ← [−B, B] 균등, c ← {−1, 0, 1} 균등.
 * 거절: |z| > B − β 이면 버린다 (β ≥ max|c·s| = |s|).
 * 반환: z 의 정확한 분포(값 → 확률)와 수락 확률.
 */
export function zDistribution(sSecret: number, B: number, beta: number, reject: boolean) {
  const dist = new Map<number, number>();
  let acc = 0;
  for (const c of [-1, 0, 1]) {
    for (let y = -B; y <= B; y++) {
      const z = y + c * sSecret;
      const p = 1 / 3 / (2 * B + 1);
      if (reject && Math.abs(z) > B - beta) continue;
      acc += p;
      dist.set(z, (dist.get(z) ?? 0) + p);
    }
  }
  // 조건부 분포로 정규화
  dist.forEach((v, k) => dist.set(k, v / acc));
  return { dist, acceptRate: acc };
}
