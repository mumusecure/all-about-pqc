import { useMemo, useState } from 'react';
import { pkCoefficients, publicEval, uovKeyGen, uovSign } from '../lib/uov';

/**
 * GF(31) 위의 작은 UOV: 식초 v 개, 기름 o 개, 식 o 개.
 * 중심 사상 F 에는 기름×기름 항이 없고(빈 블록), 공개키 P = F∘T 는 꽉 찬 이차식이다.
 */
const p = 31;
export default function UOVToy() {
  const [v, setV] = useState(8);
  const o = 4;
  const [which, setWhich] = useState<'F' | 'P'>('F');
  const [msg, setMsg] = useState([3, 1, 4, 1]);
  const [seed, setSeed] = useState(7);
  const K = useMemo(() => uovKeyGen(p, v, o, 11), [v]);
  const sig = useMemo(() => uovSign(K, msg, seed), [K, msg, seed]);
  const check = sig ? publicEval(K, sig.x) : null;
  const ok = !!check && check.every((x, i) => x === msg[i]);
  const y = sig ? K.T.map((row) => row.reduce((s, a, j) => s + a * sig.x[j], 0) % p) : null;
  const n = v + o, Q = (which === 'F' ? K.F : K.P)[0];
  const S = 300, c = S / n;
  return (
    <div className="widget not-content">
      <h4>UOV: 기름과 식초</h4>
      <p className="widget-sub">GF({p}) 위, 변수 n = v + o 개 (식초 v, 기름 o = {o}), 이차식 {o} 개. 서명 = 공개 이차식 P(x) = t 의 해 x 하나. 비밀을 아는 사람만 식초를 고정해 기름에 대한 <b>선형</b> 연립방정식으로 풀 수 있습니다.</p>
      <div className="controls">
        <label className="slider">식초 변수 수 v <b>{v}</b>
          <input type="range" min={4} max={12} step={1} value={v} onChange={(e) => setV(+e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button className={which === 'F' ? 'primary' : ''} onClick={() => setWhich('F')}>비밀 중심 사상 F₁</button>
        <button className={which === 'P' ? 'primary' : ''} onClick={() => setWhich('P')}>공개키 P₁ = F₁ ∘ T</button>
        <button onClick={() => setMsg(msg.map(() => Math.floor(Math.random() * p)))}>메시지 해시 t 바꾸기</button>
        <button onClick={() => setSeed((s) => s + 1)}>식초 다시 고르기</button>
      </div>
      <svg viewBox={`-28 -18 ${S + 34} ${S + 24}`} style={{ maxWidth: 360, margin: '0 auto' }} role="img" aria-label="이차형식 계수 행렬">
        {Q.map((row, i) => row.map((a, j) => j < i ? null : (
          <rect key={`${i}-${j}`} x={j * c} y={i * c} width={c - 1} height={c - 1}
            fill={a === 0 ? 'var(--w-surface)' : (i < v && j < v ? 'var(--w-b2)' : 'var(--w-b1)')} opacity={a === 0 ? 1 : 0.25 + 0.75 * (a / (p - 1))} stroke={a === 0 ? 'var(--w-border)' : 'none'} />
        )))}
        {which === 'F' && <rect x={v * c} y={v * c} width={o * c - 1} height={o * c - 1} fill="none" stroke="var(--w-good)" strokeWidth={2.5} strokeDasharray="5 3" />}
        <text x={(v * c) / 2} y={-5} fontSize="11" textAnchor="middle" fill="var(--w-muted)">식초 ({v} 개)</text>
        <text x={v * c + (o * c) / 2} y={-5} fontSize="11" textAnchor="middle" fill="var(--w-muted)">기름</text>
        <text x={-6} y={(v * c) / 2} fontSize="11" textAnchor="end" fill="var(--w-muted)">식초</text>
        <text x={-6} y={v * c + (o * c) / 2} fontSize="11" textAnchor="end" fill="var(--w-muted)">기름</text>
      </svg>
      <p className="widget-sub">칸 (i, j) = 항 xᵢxⱼ 의 계수(진할수록 큼, 빈 칸 = 0). 주황 = 식초×식초, 파랑 = 식초×기름 또는 (공개키에서는) 아무 항. {which === 'F' ? '초록 점선 블록(기름×기름)이 통째로 비어 있습니다.' : '공개키는 꽉 차 있어 구조가 보이지 않습니다.'}</p>
      <div className="stats">
        <div className="stat"><span>메시지 해시 t</span><b>({msg.join(', ')})</b></div>
        <div className="stat"><span>비밀 좌표 y = Tx 의 식초 / 기름</span><b style={{ fontSize: '0.8rem' }}>{y ? `(${y.slice(0, v).join(', ')} | ${y.slice(v).join(', ')})` : '—'}</b></div>
        <div className="stat"><span>서명 x (n = {n} 개)</span><b style={{ fontSize: '0.8rem' }}>{sig ? `(${sig.x.join(', ')})` : '실패'}</b></div>
        <div className="stat"><span>검증 P(x)</span><b className={ok ? 'good' : 'bad'}>{check ? `(${check.join(', ')}) ${ok ? '= t' : '≠ t'}` : '—'}</b></div>
        <div className="stat"><span>식초 시도 횟수</span><b>{sig ? sig.tries : '—'}</b></div>
        <div className="stat"><span>공개키 계수 o·n(n+1)/2</span><b>{pkCoefficients(K)}</b></div>
      </div>
      <p className="note">식초 변수를 고정하면 F 의 각 식에서 기름×기름 항이 없으므로 기름 변수에 대한 일차식만 남고, o×o 선형계를 가우스 소거로 풉니다(행렬이 특이하면 식초를 다시 고름). 그 해 y 를 x = T⁻¹y 로 옮기면 공개 식 P(x) = F(Tx) = t 를 만족합니다. 공격자는 T 를 몰라 꽉 찬 이차 연립방정식(MQ 문제)을 풀어야 합니다. v = o 로 균형을 맞추면 Kipnis–Shamir 공격으로 기름 공간이 드러나 깨지고, v 가 o 보다 충분히 큰 <b>불균형</b>이어야 안전합니다(실제 파라미터는 v ≈ 1.5o 이상). 실제 uov-Ip 는 GF(256), n = 112, o = 44 로 공개키 278,432 바이트(압축 시 43,576), 서명 128 바이트입니다.</p>
    </div>
  );
}
