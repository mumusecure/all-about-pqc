/**
 * 24장: 해시 기반 서명 (교육용).
 * - 동기식 SHA-256 (FIPS 180-4)
 * - Lamport 일회용 서명과 '같은 키로 여러 번 서명'했을 때의 위조
 * - Winternitz(W-OTS) 의 크기·계산량 절충
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export function sha256(msg: Uint8Array): Uint8Array {
  const l = msg.length, nb = ((l + 9 + 63) >> 6) << 6, buf = new Uint8Array(nb);
  buf.set(msg); buf[l] = 0x80;
  const bits = l * 8; const dv = new DataView(buf.buffer);
  dv.setUint32(nb - 4, bits >>> 0); dv.setUint32(nb - 8, Math.floor(bits / 2 ** 32));
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  for (let off = 0; off < nb; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + 4 * i);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32), od = new DataView(out.buffer);
  H.forEach((x, i) => od.setUint32(4 * i, x));
  return out;
}
export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const utf8 = (s: string) => new TextEncoder().encode(s);
const bitOf = (h: Uint8Array, i: number) => (h[i >> 3] >> (7 - (i & 7))) & 1;

/* ------------------------------------------------------------------ Lamport */

export interface LamportKey { sk: Uint8Array[][]; pk: Uint8Array[][]; }
/** 비밀 = 256 × 2 개의 무작위 32 바이트, 공개 = 각각의 해시 (시드에서 결정적으로) */
export function lamportKeyGen(seed: string): LamportKey {
  const sk = Array.from({ length: 256 }, (_, i) => [0, 1].map((b) => sha256(utf8(`${seed}|${i}|${b}`))));
  return { sk, pk: sk.map((pair) => pair.map((x) => sha256(x))) };
}
export const lamportSign = (K: LamportKey, msg: string) => { const h = sha256(utf8(msg)); return Array.from({ length: 256 }, (_, i) => K.sk[i][bitOf(h, i)]); };
export function lamportVerify(pk: Uint8Array[][], msg: string, sig: Uint8Array[]) {
  const h = sha256(utf8(msg));
  return sig.every((s, i) => hex(sha256(s)) === hex(pk[i][bitOf(h, i)]));
}

/**
 * 같은 키로 서명한 메시지들에서 공격자가 아는 비밀: known[i][b] = 위치 i, 비트 b 의 비밀을 봤는가.
 * 위조 = 해시의 모든 비트 위치에서 '본 비밀'만으로 서명할 수 있는 새 메시지 찾기.
 */
export function lamportKnowledge(msgs: string[]) {
  const known = Array.from({ length: 256 }, () => [false, false]);
  msgs.forEach((m) => { const h = sha256(utf8(m)); for (let i = 0; i < 256; i++) known[i][bitOf(h, i)] = true; });
  const free = known.filter((k) => k[0] && k[1]).length;          // 두 값 모두 아는 위치
  return { known, free, log2Work: 256 - free };                   // 무작위 메시지가 위조 가능할 확률 2^{-(256 - free)}
}
/** 무작위 메시지를 budget 개까지 시도해 위조 가능한 것을 찾는다 */
export function lamportForge(K: LamportKey, msgs: string[], budget: number, tag = 'forge') {
  const { known } = lamportKnowledge(msgs);
  for (let t = 0; t < budget; t++) {
    const m = `${tag}-${t}`, h = sha256(utf8(m));
    let ok = true;
    for (let i = 0; i < 256 && ok; i++) ok = known[i][bitOf(h, i)];
    if (ok) {
      // 공격자가 실제로 가진 비밀(이전 서명들에서 본 값)만으로 서명을 조립
      const sigs = msgs.map((x) => ({ h: sha256(utf8(x)), s: lamportSign(K, x) }));
      const sig = Array.from({ length: 256 }, (_, i) => sigs.find((z) => bitOf(z.h, i) === bitOf(h, i))!.s[i]);
      return { message: m, tries: t + 1, sig };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ Winternitz */

/** W-OTS 파라미터: 256 비트 메시지, 밑 w. len₁ = ⌈256/log₂w⌉, len₂ = ⌊log₂(len₁(w−1))/log₂w⌋ + 1 */
export function wotsParams(w: number) {
  const lw = Math.log2(w), len1 = Math.ceil(256 / lw), len2 = Math.floor(Math.log2(len1 * (w - 1)) / lw) + 1, len = len1 + len2;
  return { w, len1, len2, len, sigBytes: 32 * len, keygenHashes: len * (w - 1), avgSignHashes: (len * (w - 1)) / 2 };
}
