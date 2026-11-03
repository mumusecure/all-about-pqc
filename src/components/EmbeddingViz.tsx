import { useState } from 'react';
import { type C, cabs, cmul, embed, fieldNorm, galois, roots } from '../lib/numfield';

const colors = ['#2563eb', '#d9480f', '#15803d', '#7c3aed', '#b45309', '#0891b2', '#be123c', '#4d7c0f'];
const mulZ = (a: number[], b: number[]) => {
  const n = a.length, h = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const k = i + j; if (k < n) h[k] += a[i] * b[j]; else h[k - n] -= a[i] * b[j]; }
  return h;
};
const fmtPoly = (p: number[]) => p.map((c, i) => ({ c, i })).filter((t) => t.c).map(({ c, i }) => `${c < 0 ? '−' : '+'}${Math.abs(c) === 1 && i ? '' : Math.abs(c)}${i === 0 ? '' : i === 1 ? 'x' : `x^${i}`}`).join(' ').replace(/^\+/, '') || '0';

/**
 * 정규 임베딩: a ∈ ℤ[x]/(xⁿ+1) 를 xⁿ+1 의 근 ω_j 에서 계산한 값 σ_j(a) 들로 본다.
 * 곱셈은 좌표별 곱, 노름 N(a) = ∏σ_j(a), 길이는 √n 배.
 */
export default function EmbeddingViz() {
  const [n, setN] = useState(8);
  const [a, setA] = useState<number[]>([1, 1, 0, 0, 0, 0, 0, 0]);
  const [b, setB] = useState<number[]>([0, 0, 1, 0, 0, 0, 0, -1]);
  const [view, setView] = useState<'a' | 'b' | 'ab'>('a');
  const A = a.slice(0, n), Bp = b.slice(0, n);
  const ab = mulZ(A, Bp);
  const ea = embed(A), eb = embed(Bp), eab = embed(ab);
  const pts = view === 'a' ? ea : view === 'b' ? eb : eab;
  const R = Math.max(2.2, ...pts.map(cabs)) * 1.12;
  const S = 320;
  const P = (z: C): [number, number] => [S / 2 + (z[0] * S) / (2 * R), S / 2 - (z[1] * S) / (2 * R)];
  const coefNorm = Math.hypot(...A), canNorm = Math.sqrt(ea.reduce((s, z) => s + cabs(z) ** 2, 0));
  const setN2 = (k: number) => { setN(k); setA((x) => [...x, ...new Array(8).fill(0)].slice(0, 8)); };
  const setCoef = (i: number, v: number) => setA((x) => x.map((c, j) => (j === i ? v : c)));

  return (
    <div className="widget not-content">
      <h4>정규 임베딩: 다항식을 n 개의 복소수로 보기</h4>
      <p className="widget-sub">ℤ[x]/(xⁿ+1) 의 원소 a 를 xⁿ+1 의 근 ω_j (회색 점, 단위원 위)에서 계산한 값 σ_j(a) 로 바꿉니다. 같은 색 점끼리가 같은 근에 대응합니다.</p>
      <div className="row">
        <button className={n === 4 ? 'primary' : ''} onClick={() => setN2(4)}>n = 4</button>
        <button className={n === 8 ? 'primary' : ''} onClick={() => setN2(8)}>n = 8</button>
        <button className={view === 'a' ? 'primary' : ''} onClick={() => setView('a')}>σ(a)</button>
        <button className={view === 'b' ? 'primary' : ''} onClick={() => setView('b')}>σ(b)</button>
        <button className={view === 'ab' ? 'primary' : ''} onClick={() => setView('ab')}>σ(a·b)</button>
        <button onClick={() => setA((x) => [...galois(x.slice(0, n), 3), ...new Array(8 - n).fill(0)])}>a ← σ₃(a) (x → x³)</button>
      </div>
      <div className="controls" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(6.5rem, 1fr))' }}>
        {A.map((c, i) => (
          <label key={i} className="slider">a 의 x^{i} 계수 <b>{c}</b>
            <input type="range" min={-3} max={3} value={c} onChange={(e) => setCoef(i, +e.target.value)} />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <svg viewBox={`0 0 ${S} ${S}`} style={{ flex: '1 1 240px', maxWidth: 340, background: 'var(--w-surface)', borderRadius: 8 }} role="img" aria-label="복소평면의 임베딩">
          <line x1={0} x2={S} y1={S / 2} y2={S / 2} stroke="var(--w-grid)" />
          <line x1={S / 2} x2={S / 2} y1={0} y2={S} stroke="var(--w-grid)" />
          <circle cx={S / 2} cy={S / 2} r={S / (2 * R)} fill="none" stroke="var(--w-muted)" strokeDasharray="3 3" />
          {roots(n).map((w, j) => { const [x, y] = P(w); return <circle key={`r${j}`} cx={x} cy={y} r={3} fill="var(--w-point)" />; })}
          {pts.map((z, j) => { const [x, y] = P(z); return <g key={j}><line x1={S / 2} y1={S / 2} x2={x} y2={y} stroke={colors[j]} strokeOpacity={0.35} /><circle cx={x} cy={y} r={5.5} fill={colors[j]} /></g>; })}
        </svg>
        <div style={{ flex: '1 1 220px', fontSize: '0.85rem' }}>
          <div className="log" style={{ maxHeight: 'none' }}>
            <div>a = {fmtPoly(A)}</div>
            <div>b = {fmtPoly(Bp)}</div>
            <div>a·b = {fmtPoly(ab)}</div>
            {pts.slice(0, n).map((z, j) => <div key={j} style={{ color: colors[j] }}>σ_{j}({view === 'ab' ? 'ab' : view}) = {z[0].toFixed(2)} {z[1] >= 0 ? '+' : '−'} {Math.abs(z[1]).toFixed(2)}i</div>)}
          </div>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><span>σ(ab)₀ vs σ(a)₀·σ(b)₀</span><b>{cabs(eab[0]).toFixed(3)} = {cabs(cmul(ea[0], eb[0])).toFixed(3)}</b></div>
        <div className="stat"><span>계수 노름 ‖a‖₂</span><b>{coefNorm.toFixed(3)}</b></div>
        <div className="stat"><span>정규 노름 ‖σ(a)‖₂ (= √n·‖a‖₂)</span><b>{canNorm.toFixed(3)}</b></div>
        <div className="stat"><span>체 노름 N(a) = ∏σ_j(a)</span><b>{Math.round(fieldNorm(A))}</b></div>
        <div className="stat"><span>N(a)·N(b) = N(ab)</span><b>{Math.round(fieldNorm(A))}·{Math.round(fieldNorm(Bp))} = {Math.round(fieldNorm(ab))}</b></div>
      </div>
      <p className="note">‘σ(a·b)’ 를 눌러 같은 색끼리 곱해진 것을 확인하세요(복소수 곱: 길이는 곱, 각도는 합). ‘x → x³’ 은 갈루아 자기동형으로, 점들의 <b>집합</b>은 그대로 두고 색(어느 근에 대응하는지)만 바꿉니다. 그래서 노름이 보존됩니다.</p>
    </div>
  );
}
