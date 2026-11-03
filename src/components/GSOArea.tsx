import { useRef, useState } from 'react';
import { type Vec, dot, norm, norm2, scale, sub } from '../lib/lattice';

/**
 * 2차원에서 det(B) = ‖b₁‖·‖b₂*‖ 를 보여준다.
 * b₂ 를 b₁ 방향으로 밀어도(전단 변환) 평행사변형의 넓이와 b₂* 는 변하지 않는다.
 */
export default function GSOArea() {
  const [b1, setB1] = useState<Vec>([4, 1]);
  const [b2, setB2] = useState<Vec>([2, 3]);
  const [drag, setDrag] = useState<0 | 1 | 2>(0);
  const ref = useRef<SVGSVGElement>(null);
  const S = 360;
  const R = Math.min(24, Math.max(8, Math.ceil(Math.max(...[b1[0] + b2[0], b1[1] + b2[1], ...b1, ...b2].map(Math.abs))) + 1));
  const P = (v: Vec): [number, number] => [S / 2 + (v[0] * S) / (2 * R), S / 2 - (v[1] * S) / (2 * R)];

  const mu = dot(b2, b1) / norm2(b1);
  const b2s = sub(b2, scale(mu, b1));
  const det = b1[0] * b2[1] - b1[1] * b2[0];
  const o = P([0, 0]), p1 = P(b1), p2 = P(b2), p12 = P([b1[0] + b2[0], b1[1] + b2[1]]), ps = P(b2s), p1s = P([b1[0] + b2s[0], b1[1] + b2s[1]]);

  const move = (e: React.PointerEvent) => {
    if (!drag || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (((e.clientX - r.left) / r.width) * S - S / 2) * (2 * R) / S;
    const y = (S / 2 - ((e.clientY - r.top) / r.height) * S) * (2 * R) / S;
    const v: Vec = [Math.round(x * 2) / 2, Math.round(y * 2) / 2];
    if (drag === 1 && norm2(v) > 0) setB1(v);
    if (drag === 2) setB2(v);
  };
  const shear = (k: number) => setB2((v) => [v[0] + k * b1[0], v[1] + k * b1[1]]);

  return (
    <div className="widget not-content">
      <h4>행렬식 = 부피 = ‖b₁‖ · ‖b₂*‖</h4>
      <p className="widget-sub">끝점을 드래그하거나 ‘b₂ 밀기’를 눌러 보세요. b₂ 에 b₁ 의 배수를 더해도 넓이와 b₂* (보라)는 그대로입니다.</p>
      <div className="row">
        <button onClick={() => shear(1)}>b₂ ← b₂ + b₁</button>
        <button onClick={() => shear(-1)}>b₂ ← b₂ − b₁</button>
        <button onClick={() => { setB1([4, 1]); setB2([2, 3]); }}>초기화</button>
      </div>
      <svg ref={ref} viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 400, margin: '0 auto', background: 'var(--w-surface)', borderRadius: 8 }}
        onPointerMove={move} onPointerUp={() => setDrag(0)} onPointerLeave={() => setDrag(0)} role="img" aria-label={`det = ${det}`}>
        <line x1={0} x2={S} y1={o[1]} y2={o[1]} stroke="var(--w-grid)" />
        <line x1={o[0]} x2={o[0]} y1={0} y2={S} stroke="var(--w-grid)" />
        <polygon points={[o, p1, p12, p2].map((p) => p.join(',')).join(' ')} fill="var(--w-fill)" stroke="var(--w-b1)" strokeOpacity={0.5} />
        <polygon points={[o, p1, p1s, ps].map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--w-gs)" strokeDasharray="5 4" strokeWidth={1.5} />
        <line x1={o[0]} y1={o[1]} x2={ps[0]} y2={ps[1]} stroke="var(--w-gs)" strokeWidth={2.5} />
        <line x1={o[0]} y1={o[1]} x2={p1[0]} y2={p1[1]} stroke="var(--w-b1)" strokeWidth={3} />
        <line x1={o[0]} y1={o[1]} x2={p2[0]} y2={p2[1]} stroke="var(--w-b2)" strokeWidth={3} />
        <circle cx={p1[0]} cy={p1[1]} r={10} fill="var(--w-b1)" opacity={0.3} style={{ cursor: 'grab' }} onPointerDown={() => setDrag(1)} />
        <circle cx={p2[0]} cy={p2[1]} r={10} fill="var(--w-b2)" opacity={0.3} style={{ cursor: 'grab' }} onPointerDown={() => setDrag(2)} />
        <text x={p1[0] + 6} y={p1[1] - 6} fontSize="13" fill="var(--w-b1)" fontWeight="700">b₁</text>
        <text x={p2[0] + 6} y={p2[1] - 6} fontSize="13" fill="var(--w-b2)" fontWeight="700">b₂</text>
        <text x={ps[0] + 6} y={ps[1] + 14} fontSize="13" fill="var(--w-gs)" fontWeight="700">b₂*</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>det(B)</span><b>{det.toFixed(2)}</b></div>
        <div className="stat"><span>‖b₁‖ · ‖b₂*‖ (점선 직사각형)</span><b>{(norm(b1) * norm(b2s)).toFixed(2)}</b></div>
        <div className="stat"><span>‖b₁‖ · ‖b₂‖ (Hadamard 상한)</span><b>{(norm(b1) * norm(b2)).toFixed(2)}</b></div>
        <div className="stat"><span>μ₂₁ = ⟨b₂,b₁⟩/‖b₁‖²</span><b>{mu.toFixed(2)}</b></div>
      </div>
    </div>
  );
}
