import { useMemo, useState } from 'react';
import { CSIDH_ELLS, CSIDH_P, countPoints, csidhAction, csidhOrbit, jInvariant } from '../lib/isogeny';

/**
 * CSIDH 키 교환 (논문의 토이 소수 p = 4·3·5·7 − 1 = 419).
 * 비밀 = 지수 벡터 (e₃, e₅, e₇), 공개키 = [l₃^{e₃} l₅^{e₅} l₇^{e₇}] · E₀. 군 작용이 가환이라 공유 곡선이 같다.
 */
export default function CSIDHExchange() {
  const [a, setA] = useState([1, -2, 1]);
  const [b, setB] = useState([-1, 1, 2]);
  const orbit = useMemo(() => csidhOrbit(), []);
  // l₃ 의 순환 순서로 원 위에 배치
  const order = useMemo(() => { const seq = [0]; let A = 0; for (let k = 0; k < orbit.nodes.length - 1; k++) { A = csidhAction(A, [1, 0, 0], k + 1); seq.push(A); } return seq; }, [orbit]);
  const posOf = (A: number) => { const k = order.indexOf(A); const S = 340, C = S / 2, R = S / 2 - 24; return [C + R * Math.cos((2 * Math.PI * k) / order.length - Math.PI / 2), C + R * Math.sin((2 * Math.PI * k) / order.length - Math.PI / 2)]; };
  const pubA = csidhAction(0, a, 1), pubB = csidhAction(0, b, 2);
  const sAB = csidhAction(pubB, a, 3), sBA = csidhAction(pubA, b, 4);
  const setv = (who: 'a' | 'b', i: number, v: number) => (who === 'a' ? setA : setB)((x) => x.map((y, k) => (k === i ? v : y)));
  const S = 340;
  const mark = (A: number, color: string, label: string, r = 8) => { const [x, y] = posOf(A); return <g key={label}><circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={3} /><text x={x} y={y - r - 4} fontSize="12" textAnchor="middle" fill={color}>{label}</text></g>; };
  return (
    <div className="widget not-content">
      <h4>CSIDH: 가환 군 작용으로 키 교환</h4>
      <p className="widget-sub">p = 419 위의 초특이 몽고메리 곡선 y² = x³ + Ax² + x 들(점 = A 값, l₃ 의 순환 순서로 배치). 이데알 lℓ 의 작용은 ℓ-동종사상 하나이고(지수 부호 + 는 곡선 위의 점, − 는 꼬임 곡선 위의 점으로 핵을 고름), Vélu 공식으로 실제 계산합니다.</p>
      <div className="controls">
        {(['a', 'b'] as const).map((who) => CSIDH_ELLS.map((ell, i) => (
          <label key={`${who}${ell}`} className="slider">{who === 'a' ? 'Alice' : 'Bob'} 의 e{ell === 3 ? '₃' : ell === 5 ? '₅' : '₇'} <b>{(who === 'a' ? a : b)[i]}</b>
            <input type="range" min={-3} max={3} value={(who === 'a' ? a : b)[i]} onChange={(e) => setv(who, i, +e.target.value)} />
          </label>
        )))}
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 380, margin: '0 auto' }} role="img" aria-label="CSIDH 곡선들">
        {orbit.edges.filter((e) => e.ell !== 3).map((e, k) => { const [x1, y1] = posOf(orbit.nodes[e.from]), [x2, y2] = posOf(orbit.nodes[e.to]); return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={e.ell === 5 ? 'var(--w-grid)' : 'var(--w-fill)'} strokeWidth={1} />; })}
        {order.map((A, k) => { const [x, y] = posOf(A), [x2, y2] = posOf(order[(k + 1) % order.length]); return <line key={`c${k}`} x1={x} y1={y} x2={x2} y2={y2} stroke="var(--w-point)" strokeWidth={1.5} />; })}
        {orbit.nodes.map((A) => { const [x, y] = posOf(A); return <circle key={A} cx={x} cy={y} r={3.5} fill="var(--w-point)" />; })}
        {mark(0, 'var(--w-muted)', 'E₀', 6)}
        {mark(pubA, 'var(--w-b1)', 'A 공개', 9)}
        {mark(pubB, 'var(--w-b2)', 'B 공개', 9)}
        {mark(sAB, 'var(--w-good)', '공유', 13)}
      </svg>
      <div className="stats">
        <div className="stat"><span>Alice 공개키 A</span><b>{pubA}</b></div>
        <div className="stat"><span>Bob 공개키 B</span><b>{pubB}</b></div>
        <div className="stat"><span>Alice 가 계산: a·(B 의 곡선)</span><b>{sAB} (j = {jInvariant(sAB)})</b></div>
        <div className="stat"><span>Bob 이 계산: b·(A 의 곡선)</span><b className={sAB === sBA ? 'good' : 'bad'}>{sBA} {sAB === sBA ? '— 같음' : '— 다름!'}</b></div>
      </div>
      <p className="note">곡선은 모두 {orbit.nodes.length} 개이고 모두 #E = p + 1 = {countPoints(sAB)} 인 초특이 곡선입니다. l₃ 과 l₇ 은 각각 27 개 전체를 한 바퀴 도는 순환을, l₅ 는 9 개짜리 순환들을 만듭니다(회색 현). 군이 가환이라 a·(b·E₀) = b·(a·E₀) 이고, 상호작용 없이 공개키만 교환해도 같은 곡선에 도착합니다(비대화형 키 교환). 실제 CSIDH-512 는 p ≈ 2⁵¹² 이고 소수 ℓ 를 74 개 씁니다. 공격은 "두 곡선 사이의 군 원소 찾기"로, 양자 컴퓨터로는 Kuperberg 류의 준지수 알고리즘이 있어 파라미터를 얼마나 키워야 하는지가 논쟁거리입니다.</p>
    </div>
  );
}
