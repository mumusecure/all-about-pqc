import { useMemo, useState } from 'react';
import { ckksDecrypt, ckksEncrypt, ckksKeyGen, ckksKeyRecovery } from '../lib/fhe';

const K = ckksKeyGen(16, 3);
const Z = Array.from({ length: 16 }, (_, i) => Math.round(Math.sin(i + 1) * 3000) / 1000);

/**
 * CKKS 는 근사 복호라 복호 결과에 잡음 e 가 그대로 섞여 나온다. 그 결과를 공격자가 보면
 * c0 + c1·s = Δ·m + e 에서 c1·s 를 알게 되어, 복호 결과 하나로 비밀키 s 를 푼다(Li–Micciancio 2021).
 * 대책: 복호 결과에 큰 잡음을 더해 내보낸다(noise flooding).
 */
export default function CKKSLeak() {
  const [floodBits, setFloodBits] = useState(0);
  const [seed, setSeed] = useState(1);
  const c = useMemo(() => ckksEncrypt(K, Z, seed + 10), [seed]);
  const flood = floodBits === 0 ? 0n : 1n << BigInt(floodBits);
  const zp = useMemo(() => ckksDecrypt(K, c, flood, seed + 20), [c, floodBits, seed]);
  const rec = useMemo(() => ckksKeyRecovery(K, c, zp), [c, zp]);
  const err = Math.max(...zp.map((x, i) => Math.abs(x - Z[i])));
  return (
    <div className="widget not-content">
      <h4>근사 복호가 키를 흘린다: CKKS 와 IND-CPA^D</h4>
      <p className="widget-sub">실수 16 개를 Δ = 2²⁰ 배해 암호화하고(슬롯 인코딩은 생략한 단순판), 복호한 근사값 z′ 를 공개합니다. 공격자는 암호문 (c₀, c₁) 과 z′ 만으로 s = c₁⁻¹·(round(Δ·z′) − c₀) 를 계산합니다.</p>
      <div className="controls">
        <label className="slider">복호 출력에 더하는 잡음 (log₂, 0 = 없음) <b>{floodBits}</b>
          <input type="range" min={0} max={40} value={floodBits} onChange={(e) => setFloodBits(+e.target.value)} />
        </label>
      </div>
      <div className="row"><button onClick={() => setSeed((s) => s + 1)}>새 암호문</button></div>
      <div className="stats">
        <div className="stat"><span>원래 값 (앞 4 개)</span><b>{Z.slice(0, 4).map((x) => x.toFixed(3)).join(', ')}</b></div>
        <div className="stat"><span>복호 값 z′ (앞 4 개)</span><b>{zp.slice(0, 4).map((x) => x.toFixed(6)).join(', ')}</b></div>
        <div className="stat"><span>최대 오차 |z′ − z|</span><b>{err.toExponential(2)}</b></div>
        <div className="stat"><span>공격자가 s 를 복원했나</span><b className={rec?.correct ? 'bad' : 'good'}>{rec?.correct ? '예 — 비밀키 전체 노출' : '아니오'}</b></div>
      </div>
      <p className="note">잡음이 없으면 근사값이 10⁻⁵ 수준으로 정확하고, 바로 그 정확함 때문에 복호 결과 <b>하나</b>로 비밀키가 통째로 나옵니다. BFV·BGV 는 복호가 평문을 정확히 반올림해 잡음을 지우므로 이 문제가 없지만, CKKS 는 잡음이 "근사 오차"로 남아 출력됩니다. Li–Micciancio(Eurocrypt 2021)는 이 때문에 CKKS 가 복호 결과를 보는 공격자에 대해(IND-CPA^D) 안전하지 않음을 보였고, 대책은 출력 전에 충분히 큰 잡음을 더하는 것입니다. 잡음을 키우면 공격은 실패하지만 정밀도가 그만큼(대략 잡음/Δ) 떨어지는 것을 보세요. 통계적으로 안전하려면 원래 잡음보다 보안 매개변수만큼(예: 2⁴⁰ 배 이상) 커야 하는데, 이 토이는 Δ = 2²⁰ 이라 그 정도 잡음이면 값 자체가 무너집니다. 실제로는 그만큼 Δ 와 q 를 키워 정밀도를 지킵니다.</p>
    </div>
  );
}
