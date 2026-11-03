import { useMemo, useState } from 'react';
import { mulberry32 } from '../lib/lwe';
import { P, decaps, decrypt, encaps, encrypt, foDecrypt, foEncrypt, keyGen, maul } from '../lib/fo';

const bits = (b: number[]) => b.join('');
const hex = (x: number) => x.toString(16).padStart(8, '0');

/**
 * FO 변환 실험실: 같은 ‘변조 후 복호 질의’ 공격을 세 가지 복호 오라클에 던진다.
 *  (A) Regev PKE 그대로  (B) FO-PKE: 재암호화 검사 + 명시적 거부(⊥)  (C) FO-KEM: 암묵적 거부 (ML-KEM 구조)
 */
export default function FOLab() {
  const [seed, setSeed] = useState(1);
  const [j, setJ] = useState(0);

  const r = useMemo(() => {
    const rng = mulberry32(seed * 7907);
    const { pk, sk } = keyGen(rng);
    const mStar = Array.from({ length: P.k }, () => (rng() < 0.5 ? 0 : 1));
    // (A)
    const cA = encrypt(pk, mStar, Math.floor(rng() * 2 ** 31));
    const leakA = decrypt(sk, maul(cA, j));
    const recA = leakA.map((x, i) => (i === j ? 1 - x : x));
    // (B)
    const cB = foEncrypt(pk, mStar);
    const ansB = foDecrypt(pk, sk, maul(cB, j));
    // (C)
    const kem = encaps(pk, rng);
    const ansC = decaps(pk, sk, maul(kem.c, j));
    const honestC = decaps(pk, sk, kem.c);
    return { mStar, cA, leakA, recA, ansB, kem, ansC, honestC };
  }, [seed, j]);

  const okA = bits(r.recA) === bits(r.mStar);
  return (
    <div className="widget not-content">
      <h4>FO 변환 실험실: 변조 공격은 어디서 막히나</h4>
      <p className="widget-sub">공격자는 도전 암호문 c* = (u, v) 의 {j}번째 메시지 비트를 뒤집은 c′ = (u, v + ⌊q/2⌋·e_{j}) 를 만들어 복호 오라클에 묻습니다. c′ ≠ c* 이므로 IND-CCA 게임에서 허용되는 질의입니다. (다중 비트 Regev: n={P.n}, m={P.m}, q={P.q}, {P.k}비트 메시지)</p>
      <div className="row">
        <label style={{ fontSize: '0.85rem' }}>뒤집을 비트 j&nbsp;
          <select value={j} onChange={(e) => setJ(+e.target.value)}>{Array.from({ length: P.k }, (_, i) => <option key={i} value={i}>{i}</option>)}</select>
        </label>
        <button onClick={() => setSeed((s) => s + 1)}>새 키·새 도전</button>
      </div>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}>
        <div className="stat">
          <span>(A) Regev PKE 그대로</span>
          <div style={{ fontSize: '0.82rem', marginTop: 4, fontFamily: 'var(--sl-font-mono, monospace)' }}>
            <div>오라클 답: {bits(r.leakA)}</div>
            <div>j 비트 되돌림: {bits(r.recA)}</div>
            <div>숨은 m*: {bits(r.mStar)}</div>
          </div>
          <b className={okA ? 'bad' : 'good'}>{okA ? '평문 전체 유출' : '실패'}</b>
        </div>
        <div className="stat">
          <span>(B) FO-PKE: 동전 = G(m), 재암호화 검사</span>
          <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
            복호 → m′ 을 다시 Enc(pk, m′; G(m′)) 로 암호화 → c′ 와 다르면 거부.
            <div style={{ fontFamily: 'var(--sl-font-mono, monospace)', marginTop: 4 }}>오라클 답: {r.ansB === null ? '⊥ (거부)' : bits(r.ansB)}</div>
          </div>
          <b className={r.ansB === null ? 'good' : 'bad'}>{r.ansB === null ? '공격 차단' : '유출'}</b>
        </div>
        <div className="stat">
          <span>(C) FO-KEM: 암묵적 거부 (ML-KEM 구조)</span>
          <div style={{ fontSize: '0.82rem', marginTop: 4, fontFamily: 'var(--sl-font-mono, monospace)' }}>
            <div>진짜 키 K* = {hex(r.kem.K)}</div>
            <div>정직한 Decaps(c*) = {hex(r.honestC.K)}</div>
            <div>오라클 답 Decaps(c′) = {hex(r.ansC.K)}</div>
          </div>
          <b className={r.ansC.rejected ? 'good' : 'bad'}>{r.ansC.rejected ? '거부됐지만 겉보기엔 평범한 키 → 정보 없음' : '유출'}</b>
        </div>
      </div>
      <p className="note">(B) 는 “이 암호문은 틀렸다(⊥)”는 사실을 알려 주고, (C) 는 그것조차 숨긴 채 비밀값 z 로 만든 무관한 키 J(z ‖ c′) 를 돌려줍니다. 공격자는 진짜 키와 구별할 수 없는 값을 받을 뿐입니다. 토이 해시는 32비트라 실제 안전성은 없습니다.</p>
    </div>
  );
}
