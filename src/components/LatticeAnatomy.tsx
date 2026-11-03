import { useMemo, useState } from 'react';
import { type Basis, type Vec, matMul, norm, successiveMinima2D, voronoiCell2D } from '../lib/lattice';
import { mulberry32 } from '../lib/lwe';

const presets: { label: string; B: Basis }[] = [
  { label: 'ℤ²', B: [[1, 0], [0, 1]] },
  { label: '육각 격자', B: [[1, 0], [0.5, Math.sqrt(3) / 2]] },
  { label: '9장의 격자', B: [[3, 1], [-1, 2]] },
  { label: 'q-ary Λ₁₃((1,5))', B: [[1, 5], [0, 13]] },
  { label: '길쭉한 격자', B: [[1, 0], [0.3, 3]] },
];
const det2 = (B: Basis) => B[0][0] * B[1][1] - B[0][1] * B[1][0];

/** 무작위 유니모듈러 행렬 (기본 행 연산의 곱) */
function randomUnimodular(seed: number): Basis {
  const r = mulberry32(seed);
  let U: Basis = [[1, 0], [0, 1]];
  for (let t = 0; t < 3; t++) {
    const k = Math.floor(r() * 5) - 2 || 1;
    const E: Basis = r() < 0.5 ? [[1, k], [0, 1]] : [[1, 0], [k, 1]];
    U = matMul(E, U);
  }
  return U;
}

/**
 * 격자 해부도: 기본 평행사변형 타일 vs 보로노이 타일, 연속 최소값, Minkowski 원, Gaussian heuristic 원.
 * ‘기저 바꾸기’를 누르면 평행사변형은 바뀌지만 격자점·보로노이 셀·λᵢ 는 그대로다.
 */
export default function LatticeAnatomy() {
  const [pi, setPi] = useState(2);
  const [U, setU] = useState<Basis>([[1, 0], [0, 1]]);
  const [tile, setTile] = useState<'para' | 'voronoi'>('para');
  const [circles, setCircles] = useState(true);
  const [seed, setSeed] = useState(1);

  const B0 = presets[pi].B;
  const B = matMul(U, B0);
  const vol = Math.abs(det2(B0));
  const { l1, l2, v1, v2 } = useMemo(() => successiveMinima2D(B0), [pi]);
  const vor = useMemo(() => voronoiCell2D(B0), [pi]);
  const scaleR = Math.max(l2, Math.sqrt(vol)) * 3.2;
  const R = scaleR;
  const S = 400;
  const P = (v: Vec): [number, number] => [S / 2 + (v[0] * S) / (2 * R), S / 2 - (v[1] * S) / (2 * R)];
  const pxr = (r: number) => (r * S) / (2 * R);

  const pts = useMemo(() => {
    const out: { c: [number, number]; v: Vec }[] = [];
    const C = 40;
    for (let x = -C; x <= C; x++)
      for (let y = -C; y <= C; y++) {
        const v = [x * B0[0][0] + y * B0[1][0], x * B0[0][1] + y * B0[1][1]];
        if (Math.abs(v[0]) <= R * 1.2 && Math.abs(v[1]) <= R * 1.2) out.push({ c: [x, y], v });
      }
    return out;
  }, [pi, R]);

  const rMink = Math.sqrt((4 * vol) / Math.PI); // 넓이 4·vol 인 원
  const rGH = Math.sqrt(vol / Math.PI); // 넓이 vol 인 원
  const o = P([0, 0]);
  const tileFor = (v: Vec) =>
    tile === 'para'
      ? [[0, 0], B[0], [B[0][0] + B[1][0], B[0][1] + B[1][1]], B[1]].map((p) => P([p[0] + v[0], p[1] + v[1]]))
      : vor.map((p) => P([p[0] + v[0], p[1] + v[1]]));

  return (
    <div className="widget not-content">
      <h4>격자 해부도</h4>
      <p className="widget-sub">타일 하나가 ‘기본 영역’입니다. 기저를 바꾸면 평행사변형 타일은 바뀌지만 넓이(부피)와 보로노이 셀은 그대로입니다.</p>
      <div className="row">
        {presets.map((p, i) => <button key={p.label} className={i === pi ? 'primary' : ''} onClick={() => { setPi(i); setU([[1, 0], [0, 1]]); }}>{p.label}</button>)}
      </div>
      <div className="row">
        <button onClick={() => { setU((u) => matMul(randomUnimodular(seed), u)); setSeed((s) => s + 1); }}>기저 바꾸기 (유니모듈러 U 곱하기)</button>
        <button onClick={() => setU([[1, 0], [0, 1]])}>원래 기저</button>
        <button className={tile === 'para' ? 'primary' : ''} onClick={() => setTile('para')}>평행사변형 타일</button>
        <button className={tile === 'voronoi' ? 'primary' : ''} onClick={() => setTile('voronoi')}>보로노이 타일</button>
        <label style={{ fontSize: '0.85rem' }}><input type="checkbox" checked={circles} onChange={(e) => setCircles(e.target.checked)} /> 원 보기</label>
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 460, margin: '0 auto', background: 'var(--w-surface)', borderRadius: 8 }} role="img" aria-label="격자 해부도">
        <defs><clipPath id="anat-clip"><rect x={0} y={0} width={S} height={S} /></clipPath></defs>
        <g clipPath="url(#anat-clip)">
          {pts.map(({ v }, i) => (
            <polygon key={i} points={tileFor(v).map((p) => p.join(',')).join(' ')}
              fill="none" stroke="var(--w-b1)" strokeOpacity={0.3} />
          ))}
          <polygon points={tileFor([0, 0]).map((p) => p.join(',')).join(' ')} fill="var(--w-b1)" fillOpacity={0.22} stroke="var(--w-b1)" strokeWidth={2} />
          {circles && <>
            <circle cx={o[0]} cy={o[1]} r={pxr(rMink)} fill="none" stroke="var(--w-bad)" strokeWidth={1.5} strokeDasharray="6 4" />
            <circle cx={o[0]} cy={o[1]} r={pxr(rGH)} fill="none" stroke="var(--w-muted)" strokeWidth={1.5} strokeDasharray="2 3" />
            <circle cx={o[0]} cy={o[1]} r={pxr(l1)} fill="none" stroke="var(--w-good)" strokeWidth={1.5} />
          </>}
          {pts.map(({ v }, i) => { const [x, y] = P(v); return <circle key={i} cx={x} cy={y} r={2.6} fill="var(--w-point)" />; })}
          {[[v1, 'var(--w-good)'], [v2, 'var(--w-gs)']].map(([v, c], i) => { const p = P(v as Vec); return <line key={i} x1={o[0]} y1={o[1]} x2={p[0]} y2={p[1]} stroke={c as string} strokeWidth={3} />; })}
          {[B[0], B[1]].map((b, i) => { const p = P(b); return <line key={`b${i}`} x1={o[0]} y1={o[1]} x2={p[0]} y2={p[1]} stroke={i ? 'var(--w-b2)' : 'var(--w-b1)'} strokeWidth={2} strokeDasharray="5 3" />; })}
          <circle cx={o[0]} cy={o[1]} r={3.5} fill="var(--w-text)" />
        </g>
      </svg>
      <div className="row" style={{ fontSize: '0.8rem', justifyContent: 'center' }}>
        <span style={{ color: 'var(--w-good)' }}>━ λ₁ 벡터·원</span>
        <span style={{ color: 'var(--w-gs)' }}>━ λ₂ 벡터</span>
        <span style={{ color: 'var(--w-bad)' }}>┅ Minkowski 원 (넓이 4·vol)</span>
        <span>┄ GH 원 (넓이 vol)</span>
        <span style={{ color: 'var(--w-b1)' }}>╌ 현재 기저</span>
      </div>
      <div className="stats">
        <div className="stat"><span>현재 기저</span><b>({B[0].map((x) => +x.toFixed(2)).join(', ')}), ({B[1].map((x) => +x.toFixed(2)).join(', ')})</b></div>
        <div className="stat"><span>vol = |det| (불변)</span><b>{vol.toFixed(3)}</b></div>
        <div className="stat"><span>λ₁, λ₂</span><b>{l1.toFixed(3)}, {l2.toFixed(3)}</b></div>
        <div className="stat"><span>Minkowski 상한 2√(vol/π)</span><b>{rMink.toFixed(3)} ≥ λ₁ ✓</b></div>
        <div className="stat"><span>GH 예측 √(vol/π)</span><b>{rGH.toFixed(3)}</b></div>
        <div className="stat"><span>λ₁² / vol (≤ γ₂ = 2/√3 ≈ 1.155)</span><b>{((l1 * l1) / vol).toFixed(3)}</b></div>
        <div className="stat"><span>λ₁ 을 이루는 벡터 수</span><b>{pts.filter(({ v }) => Math.abs(norm(v) - l1) < 1e-9).length}</b></div>
      </div>
    </div>
  );
}
