import { useMemo, useState } from 'react';
import { type Basis, type Vec, dot, dualBasis, norm, successiveMinima2D } from '../lib/lattice';

const presets: { label: string; B: Basis }[] = [
  { label: '9장의 격자', B: [[3, 1], [-1, 2]] },
  { label: 'ℤ²', B: [[1, 0], [0, 1]] },
  { label: '길쭉한 격자', B: [[1, 0], [0.3, 3]] },
  { label: 'q-ary Λ₁₃((1,5))', B: [[1, 5], [0, 13]] },
];

function points(B: Basis, R: number): Vec[] {
  const out: Vec[] = [];
  const C = 40;
  for (let x = -C; x <= C; x++)
    for (let y = -C; y <= C; y++) {
      const v = [x * B[0][0] + y * B[1][0], x * B[0][1] + y * B[1][1]];
      if (Math.abs(v[0]) <= R && Math.abs(v[1]) <= R) out.push(v);
    }
  return out;
}

/**
 * 쌍대 격자 L* = { y : ⟨x, y⟩ ∈ ℤ ∀x ∈ L }.
 * 쌍대 벡터 y 하나를 고르면 L 의 모든 점이 평행선 ⟨x, y⟩ = k (k ∈ ℤ) 위에 놓이고, 선 간격은 1/‖y‖.
 */
export default function DualLattice() {
  const [pi, setPi] = useState(0);
  const [yi, setYi] = useState(0);
  const B = presets[pi].B;
  const D = useMemo(() => dualBasis(B)!, [pi]);
  const { l1 } = successiveMinima2D(B);
  const dm = successiveMinima2D(D);
  const vol = Math.abs(B[0][0] * B[1][1] - B[0][1] * B[1][0]);

  // 고를 수 있는 쌍대 벡터: 짧은 것부터
  const cands = useMemo(() => {
    const out: { y: Vec; c: [number, number] }[] = [];
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      if (!a && !b) continue;
      if (a < 0 || (a === 0 && b < 0)) continue; // ±y 중 하나만
      out.push({ y: [a * D[0][0] + b * D[1][0], a * D[0][1] + b * D[1][1]], c: [a, b] });
    }
    return out.sort((u, v) => norm(u.y) - norm(v.y)).slice(0, 6);
  }, [pi]);
  const y = cands[Math.min(yi, cands.length - 1)].y;

  const R = Math.max(3, Math.sqrt(vol) * 3);
  const S = 300;
  const P = (v: Vec, r: number): [number, number] => [S / 2 + (v[0] * S) / (2 * r), S / 2 - (v[1] * S) / (2 * r)];
  const Lpts = points(B, R * 1.1);
  const Rd = Math.max(norm(dm.v2), 1 / Math.sqrt(vol)) * 3;
  const Dpts = points(D, Rd * 1.1);

  // 평행선 ⟨x, y⟩ = k :  점 k·y/‖y‖² 를 지나고 y 에 수직
  const ny2 = dot(y, y);
  const kmax = Math.ceil(R * Math.sqrt(2) * Math.sqrt(ny2)) + 1;
  const lines = Array.from({ length: 2 * kmax + 1 }, (_, i) => i - kmax).map((k) => {
    const p0: Vec = [(k * y[0]) / ny2, (k * y[1]) / ny2];
    const dir: Vec = [-y[1], y[0]];
    const L = 4 * R;
    return [P([p0[0] - L * dir[0], p0[1] - L * dir[1]], R), P([p0[0] + L * dir[0], p0[1] + L * dir[1]], R), k] as const;
  });

  return (
    <div className="widget not-content">
      <h4>쌍대 격자와 평행선 묶음</h4>
      <p className="widget-sub">아래 버튼으로 쌍대 벡터 y (L* 그림의 검은 선)를 고르면, 격자 L 의 모든 점이 간격 1/‖y‖ 인 평행선 ⟨x, y⟩ = 0, ±1, ±2, … 위에 놓입니다.</p>
      <div className="row">{presets.map((p, i) => <button key={p.label} className={i === pi ? 'primary' : ''} onClick={() => { setPi(i); setYi(0); }}>{p.label}</button>)}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
        <svg viewBox={`0 0 ${S} ${S}`} style={{ flex: '1 1 240px', maxWidth: 320, background: 'var(--w-surface)', borderRadius: 8 }} role="img" aria-label="격자 L 과 평행선">
          <defs><clipPath id="dual-clip-a"><rect width={S} height={S} /></clipPath></defs>
          <g clipPath="url(#dual-clip-a)">
            {lines.map(([a, b, k]) => <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={k === 0 ? 'var(--w-b2)' : 'var(--w-b2)'} strokeOpacity={k === 0 ? 0.9 : 0.35} strokeWidth={k === 0 ? 2 : 1} />)}
            {Lpts.map((v, i) => { const [x, yy] = P(v, R); return <circle key={i} cx={x} cy={yy} r={3} fill="var(--w-b1)" />; })}
          </g>
          <text x={8} y={18} fontSize="12" fill="var(--w-text)" fontWeight="700">L</text>
        </svg>
        <svg viewBox={`0 0 ${S} ${S}`} style={{ flex: '1 1 240px', maxWidth: 320, background: 'var(--w-surface)', borderRadius: 8 }} role="img" aria-label="쌍대 격자 L*">
          <defs><clipPath id="dual-clip-b"><rect width={S} height={S} /></clipPath></defs>
          <g clipPath="url(#dual-clip-b)">
            {Dpts.map((v, i) => { const [x, yy] = P(v, Rd); return <circle key={i} cx={x} cy={yy} r={3} fill="var(--w-b2)" opacity={0.8} />; })}
            {(() => { const o = P([0, 0], Rd), p = P(y, Rd); return <line x1={o[0]} y1={o[1]} x2={p[0]} y2={p[1]} stroke="var(--w-text)" strokeWidth={2.5} />; })()}
          </g>
          <text x={8} y={18} fontSize="12" fill="var(--w-text)" fontWeight="700">L* (다른 축척)</text>
        </svg>
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {cands.map((c, i) => <button key={i} className={i === yi ? 'primary' : ''} onClick={() => setYi(i)}>y = {c.c[0]}·d₁ {c.c[1] >= 0 ? '+' : '−'} {Math.abs(c.c[1])}·d₂</button>)}
      </div>
      <div className="stats">
        <div className="stat"><span>쌍대 기저 d₁, d₂ = (B⁻¹)ᵀ 의 행</span><b>({D[0].map((x) => +x.toFixed(3)).join(', ')}), ({D[1].map((x) => +x.toFixed(3)).join(', ')})</b></div>
        <div className="stat"><span>선 간격 1/‖y‖</span><b>{(1 / norm(y)).toFixed(3)}</b></div>
        <div className="stat"><span>vol(L) · vol(L*)</span><b>{vol.toFixed(3)} × {(1 / vol).toFixed(4)} = 1</b></div>
        <div className="stat"><span>λ₁(L) · λ₁(L*) (≤ γ₂ ≈ 1.155)</span><b>{(l1 * dm.l1).toFixed(3)}</b></div>
      </div>
      <p className="note">짧은 쌍대 벡터 = 넓은 선 간격. 격자점들이 몇 개의 굵직한 평행선에 몰려 있다는 사실은 격자의 ‘구조’를 드러내며, 18장의 쌍대(dual) 공격이 이 원리를 씁니다.</p>
    </div>
  );
}
