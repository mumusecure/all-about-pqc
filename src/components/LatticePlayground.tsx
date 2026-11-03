import { useMemo, useRef, useState } from 'react';
import { type Vec, dot, gaussStep, norm, norm2, sub, scale } from '../lib/lattice';

const presets: { label: string; b1: Vec; b2: Vec }[] = [
  { label: '나쁜 기저', b1: [11, 6], b2: [19, 11] },
  { label: '좋은 기저', b1: [3, 1], b2: [-1, 2] },
  { label: '정사각 격자 ℤ²', b1: [1, 0], b2: [0, 1] },
  { label: '길쭉한 기저', b1: [1, 0], b2: [9, 1] },
];

const det2 = (a: Vec, b: Vec) => a[0] * b[1] - a[1] * b[0];
const fmt = (x: number, d = 2) => (Number.isInteger(x) ? String(x) : x.toFixed(d));

/**
 * 2차원 격자 놀이터.
 * - 기저 벡터 끝점을 드래그해 바꾼다(정수 좌표로 스냅).
 * - Lagrange–Gauss 축소를 한 단계씩 실행하며 기저가 짧고 직교에 가까워지는 과정을 본다.
 */
export default function LatticePlayground() {
  const [b1, setB1] = useState<Vec>(presets[0].b1);
  const [b2, setB2] = useState<Vec>(presets[0].b2);
  const [log, setLog] = useState<string[]>([]);
  const [showGS, setShowGS] = useState(true);
  const [drag, setDrag] = useState<0 | 1 | 2>(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const S = 420;
  const extent = Math.max(8, Math.ceil(Math.max(...b1.map(Math.abs), ...b2.map(Math.abs), ...b1.map((v, i) => Math.abs(v + b2[i])))) + 2);
  const R = Math.min(extent, 32);
  const toPx = (p: Vec): [number, number] => [S / 2 + (p[0] * S) / (2 * R), S / 2 - (p[1] * S) / (2 * R)];

  const d = det2(b1, b2);
  const points = useMemo(() => {
    const pts: Vec[] = [];
    if (d === 0) return pts;
    for (let x = -R; x <= R; x++)
      for (let y = -R; y <= R; y++) {
        // 계수 (c1, c2) = B^{-1} (x, y) 가 정수인지 확인 (정확한 정수 연산)
        const n1 = x * b2[1] - y * b2[0];
        const n2 = -x * b1[1] + y * b1[0];
        if (n1 % d === 0 && n2 % d === 0) pts.push([x, y]);
      }
    return pts;
  }, [b1, b2, R, d]);

  const mu = dot(b2, b1) / norm2(b1);
  const b2star = sub(b2, scale(mu, b1));
  const defect = (norm(b1) * norm(b2)) / Math.abs(d || 1);
  const reduced = Math.abs(mu) <= 0.5 && norm2(b1) <= norm2(b2);

  const step = () => {
    const s = gaussStep(b1, b2);
    if (s.kind === 'size-reduce') {
      setLog((l) => [...l, `μ = ${fmt(s.mu!)} → b₂ ← b₂ − (${s.m})·b₁ = (${s.b2.join(', ')})`]);
      setB2(s.b2);
    } else if (s.kind === 'swap') {
      setLog((l) => [...l, `‖b₂‖ < ‖b₁‖ → 교환: b₁ = (${s.b1.join(', ')}), b₂ = (${s.b2.join(', ')})`]);
      setB1(s.b1);
      setB2(s.b2);
    } else {
      setLog((l) => [...l, `|μ| ≤ 1/2 이고 ‖b₁‖ ≤ ‖b₂‖ → 축소 완료. b₁ 은 최단 벡터!`]);
    }
  };
  const runAll = () => {
    let x = b1, y = b2;
    const lines: string[] = [];
    for (let t = 0; t < 200; t++) {
      const s = gaussStep(x, y);
      if (s.kind === 'size-reduce') lines.push(`μ = ${fmt(s.mu!)} → b₂ ← b₂ − (${s.m})·b₁ = (${s.b2.join(', ')})`);
      else if (s.kind === 'swap') lines.push(`교환: b₁ = (${s.b1.join(', ')}), b₂ = (${s.b2.join(', ')})`);
      else { lines.push('축소 완료. b₁ 은 최단 벡터!'); break; }
      x = s.b1; y = s.b2;
    }
    setB1(x); setB2(y); setLog((l) => [...l, ...lines]);
  };
  const load = (p: (typeof presets)[number]) => { setB1(p.b1); setB2(p.b2); setLog([]); };

  const onMove = (e: React.PointerEvent) => {
    if (!drag || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * S;
    const sy = ((e.clientY - rect.top) / rect.height) * S;
    const p: Vec = [Math.round(((sx - S / 2) * 2 * R) / S), Math.round(((S / 2 - sy) * 2 * R) / S)];
    if (drag === 1 && det2(p, b2) !== 0) setB1(p);
    if (drag === 2 && det2(b1, p) !== 0) setB2(p);
  };

  const o = toPx([0, 0]);
  const p1 = toPx(b1), p2 = toPx(b2), p12 = toPx([b1[0] + b2[0], b1[1] + b2[1]]);
  const ps = toPx(b2star);
  const dot_r = Math.max(1.6, Math.min(3.5, 60 / R));

  return (
    <div className="widget not-content">
      <h4>격자 놀이터: 같은 격자, 다른 기저</h4>
      <p className="widget-sub">파란 b₁, 주황 b₂ 의 끝점을 드래그하세요. 점들(격자)은 그대로인데 기저만 바뀔 수 있습니다. ‘한 단계’로 Gauss 축소를 따라가 보세요.</p>
      <div className="row">
        {presets.map((p) => <button key={p.label} onClick={() => load(p)}>{p.label}</button>)}
        <label style={{ fontSize: '0.85rem' }}><input type="checkbox" checked={showGS} onChange={(e) => setShowGS(e.target.checked)} /> Gram-Schmidt b₂* 보기</label>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${S} ${S}`}
        style={{ maxWidth: 460, margin: '0 auto', background: 'var(--w-surface)', borderRadius: 8 }}
        onPointerMove={onMove}
        onPointerUp={() => setDrag(0)}
        onPointerLeave={() => setDrag(0)}
        role="img"
        aria-label={`기저 b1=(${b1.join(',')}), b2=(${b2.join(',')})`}
      >
        <defs>
          <marker id="ah1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--w-b1)" /></marker>
          <marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--w-b2)" /></marker>
          <marker id="ahg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--w-gs)" /></marker>
        </defs>
        <line x1={0} x2={S} y1={o[1]} y2={o[1]} stroke="var(--w-grid)" />
        <line x1={o[0]} x2={o[0]} y1={0} y2={S} stroke="var(--w-grid)" />
        <polygon points={[o, p1, p12, p2].map((p) => p.join(',')).join(' ')} fill="var(--w-fill)" stroke="var(--w-b1)" strokeOpacity={0.3} />
        {points.map(([x, y]) => { const [cx, cy] = toPx([x, y]); return <circle key={`${x},${y}`} cx={cx} cy={cy} r={dot_r} fill="var(--w-point)" />; })}
        {showGS && <line x1={o[0]} y1={o[1]} x2={ps[0]} y2={ps[1]} stroke="var(--w-gs)" strokeWidth={2} strokeDasharray="5 4" markerEnd="url(#ahg)" />}
        <line x1={o[0]} y1={o[1]} x2={p1[0]} y2={p1[1]} stroke="var(--w-b1)" strokeWidth={3} markerEnd="url(#ah1)" />
        <line x1={o[0]} y1={o[1]} x2={p2[0]} y2={p2[1]} stroke="var(--w-b2)" strokeWidth={3} markerEnd="url(#ah2)" />
        <circle cx={p1[0]} cy={p1[1]} r={11} fill="var(--w-b1)" opacity={0.25} style={{ cursor: 'grab' }} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(1); }} />
        <circle cx={p2[0]} cy={p2[1]} r={11} fill="var(--w-b2)" opacity={0.25} style={{ cursor: 'grab' }} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(2); }} />
      </svg>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="primary" onClick={step} disabled={d === 0}>한 단계</button>
        <button onClick={runAll} disabled={d === 0}>끝까지</button>
        <button onClick={() => setLog([])}>기록 지우기</button>
      </div>
      <div className="stats">
        <div className="stat"><span>b₁</span><b>({b1.join(', ')})</b></div>
        <div className="stat"><span>b₂</span><b>({b2.join(', ')})</b></div>
        <div className="stat"><span>|det| = 부피 (불변)</span><b>{Math.abs(d)}</b></div>
        <div className="stat"><span>‖b₁‖, ‖b₂‖</span><b>{fmt(norm(b1))}, {fmt(norm(b2))}</b></div>
        <div className="stat"><span>μ = ⟨b₂,b₁⟩/‖b₁‖²</span><b>{fmt(mu)}</b></div>
        <div className="stat"><span>직교성 결함 ‖b₁‖‖b₂‖/|det|</span><b>{fmt(defect)}</b></div>
        <div className="stat"><span>상태</span><b className={reduced ? 'good' : 'bad'}>{reduced ? 'Gauss-축소됨' : '축소 안 됨'}</b></div>
      </div>
      {log.length > 0 && <div className="log" aria-live="polite">{log.map((l, i) => <div key={i}>{i + 1}. {l}</div>)}</div>}
    </div>
  );
}
