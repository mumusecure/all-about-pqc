import { useMemo, useState } from 'react';
import { deltaBKZ, kRange, margin32 } from '../lib/overstretched';

const deltas = [
  { key: 'lll', label: 'LLL 실험값 δ ≈ 1.0219', d: 1.0219 },
  { key: 'bkz20e', label: 'BKZ-20 실험값 δ ≈ 1.0128', d: 1.0128 },
  { key: 'bkz20f', label: `BKZ-20 GSA 근사식 δ ≈ ${deltaBKZ(20).toFixed(5)}`, d: deltaBKZ(20) },
  { key: 'bkz50', label: `BKZ-50 GSA 근사식 δ ≈ ${deltaBKZ(50).toFixed(5)}`, d: deltaBKZ(50) },
];
const presets = [
  { label: '표 1: n=2⁶, q=2²²', ln: 6, lq: 22, k: 12 },
  { label: '표 1: n=2⁸, q=2³²', ln: 8, lq: 32, k: 50 },
  { label: 'GGH+19 최소: n=2¹⁰, q=2⁴²', ln: 10, lq: 42, k: 280 },
];

/**
 * 식 (3.2) 계산기:  (k/2πe)^{k/2} q^k ≥ δ^{k(3k−1)} (n/2)^n  의 log₂ 여유를 k 에 대해 그린다.
 * 여유 ≥ 0 인 k 가 있으면, 밀집 부분격자 공격이 (휴리스틱으로) 성공한다는 충분조건이 성립한다.
 */
export default function OverstretchedCalc() {
  const [ln, setLn] = useState(10);
  const [lq, setLq] = useState(42);
  const [di, setDi] = useState(2);
  const [k, setK] = useState(280);
  const n = 2 ** ln;
  const d = deltas[di].d;
  const kk = Math.min(k, n);
  const range = useMemo(() => kRange(n, lq, d), [n, lq, d]);
  const m = margin32(n, lq, kk, d);
  const alpha = lq / Math.sqrt(n);

  const W = 620, H = 200, L = 46, R = 10, T = 12, B = 26;
  const ks = Array.from({ length: 120 }, (_, i) => Math.max(2, Math.round(((i + 1) / 120) * n)));
  const ms = ks.map((x) => margin32(n, lq, x, d));
  const lo = Math.min(...ms, -1), hi = Math.max(...ms, 1);
  const X = (x: number) => L + ((W - L - R) * x) / n;
  const Y = (v: number) => T + ((H - T - B) * (hi - v)) / (hi - lo);

  return (
    <div className="widget not-content">
      <h4>식 (3.2) 계산기: 언제 밀집 부분격자가 드러나나</h4>
      <p className="widget-sub">여유 = log₂[(k/2πe)^(k/2)·q^k] − log₂[δ^(k(3k−1))·(n/2)^n]. 초록 구간(여유 ≥ 0)의 k 로 2k 차원 부분행렬을 축소하면, 첫 벡터가 밀집 부분격자 안에 있다는 충분조건이 성립합니다.</p>
      <div className="row">{presets.map((p) => <button key={p.label} onClick={() => { setLn(p.ln); setLq(p.lq); setK(p.k); }}>{p.label}</button>)}</div>
      <div className="controls">
        <label className="slider">log₂ n <b>{ln}</b> (n = {n})
          <input type="range" min={6} max={15} value={ln} onChange={(e) => setLn(+e.target.value)} />
        </label>
        <label className="slider">log₂ q <b>{lq}</b> (α = log q/√n ≈ {alpha.toFixed(2)})
          <input type="range" min={10} max={900} value={lq} onChange={(e) => setLq(+e.target.value)} />
        </label>
        <label className="slider">격자 축소의 강도
          <select value={di} onChange={(e) => setDi(+e.target.value)}>{deltas.map((x, i) => <option key={x.key} value={i}>{x.label}</option>)}</select>
        </label>
        <label className="slider">k (부분행렬 차원 2k) <b>{kk}</b>
          <input type="range" min={2} max={n} value={kk} onChange={(e) => setK(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="k 에 따른 여유">
        <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="var(--w-muted)" strokeDasharray="4 3" />
        <text x={L - 6} y={Y(0) + 4} fontSize="11" textAnchor="end" fill="var(--w-muted)">0</text>
        {range && <rect x={X(range[0])} y={T} width={Math.max(2, X(range[1]) - X(range[0]))} height={H - T - B} fill="var(--w-good)" opacity={0.15} />}
        <path d={ks.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(ms[i]).toFixed(1)}`).join(' ')} fill="none" stroke="var(--w-b1)" strokeWidth={2.5} />
        <line x1={X(kk)} x2={X(kk)} y1={T} y2={H - B} stroke="var(--w-b2)" strokeWidth={2} />
        <text x={L} y={H - 6} fontSize="11" fill="var(--w-muted)">k = 0</text>
        <text x={W - R} y={H - 6} fontSize="11" textAnchor="end" fill="var(--w-muted)">k = n = {n}</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>조건을 만족하는 k</span><b className={range ? 'good' : 'bad'}>{range ? `${range[0]} ≤ k ≤ ${range[1]}` : '없음'}</b></div>
        <div className="stat"><span>선택한 k 의 여유 (log₂)</span><b className={m >= 0 ? 'good' : 'bad'}>{m.toFixed(1)}</b></div>
        <div className="stat"><span>log₂ Vol(Λ) = n log₂ q</span><b>{(n * lq).toLocaleString()}</b></div>
        <div className="stat"><span>log₂ (n/2)^(n/2) (밀집 부분격자 부피 상한)</span><b>{((n / 2) * Math.log2(n / 2)).toLocaleString()}</b></div>
      </div>
      <p className="note">이 조건은 보수적인 <b>충분조건</b>입니다. 원 논문의 실험은 이 계산이 요구하는 것보다 작은 k 와 약한 축소(LLL)로도 성공했습니다(본문 5절).</p>
    </div>
  );
}
