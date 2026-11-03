import { useDeferredValue, useMemo, useState } from 'react';
import { dropHybrid } from '../lib/estimator';

/**
 * 희소 비밀(해밍 무게 h)에 대한 '좌표 버리기' 하이브리드:
 * g 개 좌표가 모두 0 이라고 걸면(확률 p) 차원이 n − g 로 줄어든다. 비용 = primal(n − g) + log₂(1/p).
 */
export default function HybridSparse() {
  const [h, setH] = useState(64);
  const dh = useDeferredValue(h);
  const n = 1024, logq = 27, sigma = 3.2;
  const pts = useMemo(() => {
    const out: { g: number; cost: number; beta: number; guess: number }[] = [];
    for (let g = 0; g <= 700; g += 25) { const r = dropHybrid(n, dh, logq, sigma, g, 2048, 32); if (r) out.push(r); }
    return out;
  }, [dh]);
  const best = pts.reduce((a, b) => (b.cost < a.cost ? b : a), pts[0]);
  const W = 620, H = 200, L = 40, R = 10, T = 10, B = 26;
  const ys = pts.flatMap((p) => [p.cost, 0.292 * p.beta, p.guess]);
  const ymax = Math.ceil(Math.max(...ys) / 20) * 20, ymin = 0;
  const X = (g: number) => L + ((W - L - R) * g) / 700;
  const Y = (v: number) => T + ((H - T - B) * (ymax - v)) / (ymax - ymin);
  const line = (f: (p: (typeof pts)[number]) => number) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.g).toFixed(1)},${Y(f(p)).toFixed(1)}`).join(' ');
  return (
    <div className="widget not-content">
      <h4>희소 비밀의 하이브리드: 좌표를 걸고 차원을 줄이기</h4>
      <p className="widget-sub">n = 1024, q = 2²⁷, σ = 3.2, 비밀은 0 이 아닌 계수가 h 개인 삼진 벡터. 공격자는 g 개 좌표를 골라 "전부 0" 이라고 걸고(맞을 확률 p), 그 좌표를 지운 n − g 차원 LWE 를 primal 로 풉니다. 틀리면 다른 g 개로 다시.</p>
      <div className="controls">
        <label className="slider">해밍 무게 h <b>{h}</b>
          <input type="range" min={16} max={256} step={8} value={h} onChange={(e) => setH(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="버리는 좌표 수에 따른 비용">
        {Array.from({ length: ymax / 20 + 1 }, (_, i) => i * 20).map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">{t}</text></g>)}
        <path d={line((p) => 0.292 * p.beta)} fill="none" stroke="var(--w-b1)" strokeWidth={2} />
        <path d={line((p) => p.guess)} fill="none" stroke="var(--w-b2)" strokeWidth={2} strokeDasharray="5 4" />
        <path d={line((p) => p.cost)} fill="none" stroke="var(--w-text)" strokeWidth={2.5} />
        {best && <circle cx={X(best.g)} cy={Y(best.cost)} r={5} fill="var(--w-good)" />}
        {[0, 200, 400, 600].map((g) => <text key={g} x={X(g)} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-muted)">g = {g}</text>)}
      </svg>
      <div className="stats">
        <div className="stat"><span>순수 primal (g = 0)</span><b>{pts[0] ? `${pts[0].cost.toFixed(1)} 비트` : '—'}</b></div>
        <div className="stat"><span>최적 하이브리드</span><b>{best ? `g = ${best.g} → ${best.cost.toFixed(1)} 비트` : '—'}</b></div>
        <div className="stat"><span>그때 β · 추측 비용</span><b>{best ? `${best.beta} · ${best.guess.toFixed(1)} 비트` : '—'}</b></div>
      </div>
      <p className="note">검정 = 합계, 파랑 = 남은 차원의 primal(0.292β), 주황 점선 = 추측이 맞을 때까지의 반복 log₂(1/p). h 가 작을수록 "0 일 확률"이 높아 하이브리드가 이득입니다. 실제 하이브리드(Howgrave-Graham 2007)는 0 이라고 거는 대신 남은 좌표를 <b>만남-중간(meet-in-the-middle)</b> 으로 찾아 훨씬 강하고, 희소 비밀을 쓰는 동형암호·SMAUG-T 의 파라미터는 이런 공격까지 넣어 정합니다.</p>
    </div>
  );
}
