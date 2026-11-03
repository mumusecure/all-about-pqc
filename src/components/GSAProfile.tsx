import { useState } from 'react';
import { type Basis, gsoLogProfile, lll, norm, rootHermiteFactor } from '../lib/lattice';
import { mulberry32 } from '../lib/lwe';

/** q-ary 격자 Λ_q(A) 의 표준 기저: 앞 k 행은 q·e_i, 나머지 d−k 행은 (A 의 행 | I). */
function qaryBasis(d: number, q: number, seed: number): Basis {
  const k = Math.floor(d / 2);
  const rng = mulberry32(seed);
  const B: Basis = [];
  for (let i = 0; i < k; i++) { const r = new Array(d).fill(0); r[i] = q; B.push(r); }
  for (let i = k; i < d; i++) {
    const r = new Array(d).fill(0);
    for (let j = 0; j < k; j++) r[j] = Math.floor(rng() * q);
    r[i] = 1;
    B.push(r);
  }
  return B;
}

interface Run { before: number[]; after: number[]; delta0: number; b1: number; vol: number; swaps: number; ms: number; d: number; }

/**
 * LLL 전후의 Gram-Schmidt 로그 프로파일 log₂‖b*_i‖ 를 그린다.
 * 축소가 잘 될수록 프로파일이 완만한 직선(GSA)에 가까워진다.
 */
export default function GSAProfile() {
  const [d, setD] = useState(40);
  const [q, setQ] = useState(3329);
  const [delta, setDelta] = useState(0.99);
  const [seed, setSeed] = useState(1);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);

  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const B = qaryBasis(d, q, seed);
      const before = gsoLogProfile(B);
      const t0 = performance.now();
      const { basis, stats } = lll(B, delta);
      const ms = performance.now() - t0;
      const after = gsoLogProfile(basis);
      const logVol = before.reduce((s, x) => s + x, 0);
      setRun({ before, after, delta0: rootHermiteFactor(basis), b1: norm(basis[0]), vol: Math.pow(2, logVol / d), swaps: stats.swaps, ms, d });
      setBusy(false);
    }, 20);
  };

  const W = 640, H = 260, L = 44, R = 12, T = 12, Bm = 30;
  let chart = null;
  if (run) {
    const ymax = Math.ceil(Math.max(...run.before, ...run.after) + 0.5);
    const ymin = Math.floor(Math.min(...run.before, ...run.after, 0) - 0.5);
    const X = (i: number) => L + ((W - L - R) * i) / Math.max(1, run.d - 1);
    const Y = (v: number) => T + ((H - T - Bm) * (ymax - v)) / (ymax - ymin);
    const path = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    // GSA 예측선: log‖b*_i‖ = log vol^{1/d} + (d−1−2i)·log δ0  (δ0 = 1.0219, LLL 평균값)
    const lv = Math.log2(run.vol), ld = Math.log2(1.0219);
    const gsa = Array.from({ length: run.d }, (_, i) => lv + (run.d - 1 - 2 * i) * ld);
    const ticks = Array.from({ length: ymax - ymin + 1 }, (_, i) => ymin + i).filter((t) => (ymax - ymin > 12 ? t % 2 === 0 : true));
    chart = (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="LLL 전후 Gram-Schmidt 프로파일">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" />
            <text x={L - 6} y={Y(t) + 4} fontSize="11" textAnchor="end" fill="var(--w-muted)">{t}</text>
          </g>
        ))}
        <text x={L} y={H - 8} fontSize="11" fill="var(--w-muted)">i = 1</text>
        <text x={W - R} y={H - 8} fontSize="11" textAnchor="end" fill="var(--w-muted)">i = {run.d}</text>
        <path d={path(gsa)} fill="none" stroke="var(--w-muted)" strokeDasharray="4 4" strokeWidth={1.5} />
        <path d={path(run.before)} fill="none" stroke="var(--w-b2)" strokeWidth={2} />
        <path d={path(run.after)} fill="none" stroke="var(--w-b1)" strokeWidth={2.5} />
      </svg>
    );
  }

  return (
    <div className="widget not-content">
      <h4>LLL 이 기저를 “평평하게” 만드는 과정</h4>
      <p className="widget-sub">무작위 q-ary 격자에 LLL 을 실행하고 log₂‖b*ᵢ‖ 를 그립니다. 주황 = 축소 전, 파랑 = 축소 후, 점선 = GSA 예측(δ₀ = 1.0219).</p>
      <div className="controls">
        <label className="slider">차원 d <b>{d}</b>
          <input type="range" min={10} max={80} step={2} value={d} onChange={(e) => setD(+e.target.value)} />
        </label>
        <label className="slider">모듈러스 q <b>{q}</b>
          <select value={q} onChange={(e) => setQ(+e.target.value)}>
            {[97, 257, 3329, 12289, 65537].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="slider">Lovász 파라미터 δ <b>{delta}</b>
          <select value={delta} onChange={(e) => setDelta(+e.target.value)}>
            {[0.5, 0.75, 0.9, 0.99].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <button className="primary" onClick={go} disabled={busy}>{busy ? '계산 중…' : 'LLL 실행'}</button>
        <button onClick={() => { setSeed((s) => s + 1); }}>다른 무작위 격자</button>
        <span className="note">seed {seed}</span>
      </div>
      {chart}
      {run && (
        <>
          <div className="stats">
            <div className="stat"><span>‖b₁‖</span><b>{run.b1.toFixed(2)}</b></div>
            <div className="stat"><span>vol^(1/d)</span><b>{run.vol.toFixed(2)}</b></div>
            <div className="stat"><span>측정 δ₀ = (‖b₁‖/vol^(1/d))^(1/d)</span><b>{run.delta0.toFixed(4)}</b></div>
            <div className="stat"><span>교환 횟수</span><b>{run.swaps}</b></div>
            <div className="stat"><span>시간</span><b>{run.ms.toFixed(0)} ms</b></div>
          </div>
          <p className="note">
            앞부분이 평평하게 남아 있다면 길이 q 인 ‘자명한’ 벡터들이 아직 기저에 있는 것입니다(q-ary 격자의 Z자 모양 프로파일). 이론적 최악 보장은 δ₀ ≤ (4/3)^(1/4) ≈ 1.075 이지만, 실험에서는 훨씬 작은 값이 나옵니다.
          </p>
        </>
      )}
    </div>
  );
}
