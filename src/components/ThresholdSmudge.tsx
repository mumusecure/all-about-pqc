import { useMemo, useState } from 'react';
import { addq, cen, combine, infNorm, mulq, partialDecrypt, shareRecovery, thresholdEncrypt, thresholdKeyGen } from '../lib/fhe';
import { mulberry32 } from '../lib/lwe';

const T = thresholdKeyGen(3, 8);
const M = (() => { const r = mulberry32(9); return Array.from({ length: T.n }, () => BigInt(Math.floor(r() * Number(T.t)))); })();

/**
 * 문턱 복호: 비밀키 s = s₁ + s₂ + s₃ 를 세 참여자가 나눠 갖고, 각자 부분 복호 dᵢ = c₁·sᵢ + (smudging) 를 낸다.
 * smudging 이 작으면 dᵢ 에서 sᵢ 가 드러나고, 크면 복호가 틀린다.
 */
export default function ThresholdSmudge() {
  const [logB, setLogB] = useState(0);
  const [seed, setSeed] = useState(1);
  const c = useMemo(() => thresholdEncrypt(T, M, seed + 10), [seed]);
  const B = logB === 0 ? 0n : 1n << BigInt(logB);
  const parts = useMemo(() => [0, 1, 2].map((i) => partialDecrypt(T, c, i, B, seed * 7 + i)), [c, logB, seed]);
  const dec = combine(T, c, parts);
  const ok = dec.every((x, i) => x === M[i]);
  const leak = shareRecovery(T, c, parts[0], 0);
  const budgetBits = Math.log2(Number(T.q / T.t / 2n));
  // 이 암호문 자체의 잡음 (검증용으로 전체 비밀키 s = Σ sᵢ 를 써서 계산)
  const ctNoiseBits = useMemo(() => {
    const s = T.shares.reduce((a, b) => addq(a, b, T.q));
    const ph = addq(c.c0, mulq(c.c1, s, T.q), T.q), D = T.q / T.t;
    const e = ph.map((x, i) => cen(x - D * M[i], T.q));
    return Math.log2(Number(infNorm(e)) || 1);
  }, [c]);
  return (
    <div className="widget not-content">
      <h4>문턱 복호와 smudging 잡음</h4>
      <p className="widget-sub">세 참여자가 비밀키를 가산 분산(s = s₁ + s₂ + s₃)으로 나눠 갖고 공동 공개키로 BFV 암호문을 만듭니다. 복호하려면 각자 부분 복호 dᵢ = c₁·sᵢ + eᵢ (‖eᵢ‖∞ ≤ 2^{logB}) 를 공개하고, 누구나 c₀ + d₁ + d₂ + d₃ 을 반올림합니다.</p>
      <div className="controls">
        <label className="slider">smudging 잡음 크기 log₂ B <b>{logB}</b>
          <input type="range" min={0} max={58} value={logB} onChange={(e) => setLogB(+e.target.value)} />
        </label>
      </div>
      <div className="row"><button onClick={() => setSeed((s) => s + 1)}>새 암호문</button></div>
      <div className="stats">
        <div className="stat"><span>합친 복호 결과</span><b className={ok ? 'good' : 'bad'}>{ok ? '정확' : '틀림 (잡음이 Δ/2 초과)'}</b></div>
        <div className="stat"><span>d₁ 하나로 참여자 1 의 몫 s₁ 복원</span><b className={leak ? 'bad' : 'good'}>{leak ? '성공 — 몫이 샘' : '실패'}</b></div>
        <div className="stat"><span>이 암호문의 잡음 여유 log₂(Δ/2)</span><b>{budgetBits.toFixed(1)} 비트</b></div>
        <div className="stat"><span>통계적 은닉 목표 (암호문 잡음 2^{ctNoiseBits.toFixed(1)} × 2⁴⁰)</span><b className={logB >= ctNoiseBits + 40 ? 'good' : ''}>log₂ B ≳ {(ctNoiseBits + 40).toFixed(1)}</b></div>
      </div>
      <p className="note">B = 0 이면 dᵢ = c₁·sᵢ 라 역원을 곱해 몫이 바로 나옵니다(CKKS 공격과 같은 원리). B 를 키우면 dᵢ 는 Ring-LWE 표본처럼 보여 몫이 숨지만, 세 잡음의 합이 Δ/2 를 넘으면 복호가 틀립니다. 위젯의 단순한 역원 공격은 B 가 조금만 커도 실패하지만, <b>증명 가능한</b> 은닉(통계적 거리 2⁻⁴⁰ 수준)은 smudging 이 원래 잡음보다 지수적으로 커야 해서 q 에 그만큼의 여유가 필요합니다. 그래서 문턱 동형암호는 같은 계산에 더 큰 q 를 쓰고, Rényi 발산 같은 더 정밀한 분석으로 smudging 을 줄이는 연구가 이어지고 있습니다.</p>
    </div>
  );
}
