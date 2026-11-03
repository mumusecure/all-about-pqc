import { useState } from 'react';
import { quadIdeals, quadVec } from '../lib/numfield';

/**
 * 2차 수체 ℚ(√−d) 의 이데알을 평면 격자로 그린다. 원소 x + y√−d ↦ (x, y√d), 그 길이의 제곱이 노름 x² + d·y².
 * 점선 원 = 반지름 √N(I). 주이데알이면 생성원이 정확히 원 위에 있다. 아니면 원 위에 이데알의 점이 없다.
 */
export default function IdealLattice() {
  const [i, setI] = useState(3);
  const I = quadIdeals[i];
  const d = I.d;
  const R = 7.5, S = 340;
  const P = (v: [number, number]): [number, number] => [S / 2 + (v[0] * S) / (2 * R), S / 2 - (v[1] * S) / (2 * R)];
  const ok: [number, number][] = [], id: [number, number][] = [];
  for (let x = -10; x <= 10; x++) for (let y = -6; y <= 6; y++) { const v = quadVec(d, [x, y]); if (Math.abs(v[0]) <= R && Math.abs(v[1]) <= R) ok.push(v); }
  for (let s = -12; s <= 12; s++) for (let t = -12; t <= 12; t++) {
    const x = s * I.basis[0][0] + t * I.basis[1][0], y = s * I.basis[0][1] + t * I.basis[1][1];
    const v = quadVec(d, [x, y]);
    if (Math.abs(v[0]) <= R && Math.abs(v[1]) <= R) id.push(v);
  }
  const norms = id.map((v) => v[0] ** 2 + v[1] ** 2).filter((x) => x > 1e-9);
  const minN = Math.round(Math.min(...norms));
  const o = P([0, 0]);
  return (
    <div className="widget not-content">
      <h4>이데알 = 격자</h4>
      <p className="widget-sub">옅은 점 = 정수환 O_K 의 원소, 진한 점 = 이데알 I 의 원소. 원소 α 의 노름 N(α) 는 원점까지 거리의 제곱입니다. 점선 원의 반지름은 √N(I).</p>
      <div className="row">{quadIdeals.map((q, j) => <button key={j} className={j === i ? 'primary' : ''} onClick={() => setI(j)}>{q.label}</button>)}</div>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 400, margin: '0 auto', background: 'var(--w-surface)', borderRadius: 8 }} role="img" aria-label={I.label}>
        <line x1={0} x2={S} y1={o[1]} y2={o[1]} stroke="var(--w-grid)" />
        <line x1={o[0]} x2={o[0]} y1={0} y2={S} stroke="var(--w-grid)" />
        {ok.map((v, j) => { const [x, y] = P(v); return <circle key={`o${j}`} cx={x} cy={y} r={2} fill="var(--w-point)" opacity={0.45} />; })}
        <circle cx={o[0]} cy={o[1]} r={(Math.sqrt(I.norm) * S) / (2 * R)} fill="none" stroke="var(--w-bad)" strokeDasharray="5 4" strokeWidth={1.5} />
        {id.map((v, j) => { const [x, y] = P(v); return <circle key={`i${j}`} cx={x} cy={y} r={4} fill="var(--w-b1)" />; })}
        {I.basis.map((bv, j) => { const p = P(quadVec(d, bv)); return <line key={j} x1={o[0]} y1={o[1]} x2={p[0]} y2={p[1]} stroke={j ? 'var(--w-b2)' : 'var(--w-gs)'} strokeWidth={2.5} />; })}
      </svg>
      <div className="stats">
        <div className="stat"><span>이데알의 노름 N(I) = [O_K : I]</span><b>{I.norm}</b></div>
        <div className="stat"><span>I 의 0 아닌 원소의 최소 노름</span><b>{minN}</b></div>
        <div className="stat"><span>주이데알?</span><b className={I.principal ? 'good' : 'bad'}>{I.principal ? `예: (${I.principal})` : '아니오'}</b></div>
      </div>
      <p className="note">{I.note} 일반적으로 0 아닌 α ∈ I 는 |N(α)| ≥ N(I) 이고, 등호를 만족하는 α 가 있을 때 정확히 I = (α) 입니다.</p>
    </div>
  );
}
