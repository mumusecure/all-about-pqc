import { useMemo, useState } from 'react';
import { bkzTour, log2GH, logVolume2, norm2, qaryLattice, rootHermite } from '../lib/bkz';
import { type Basis, gsoLogProfile, lll } from '../lib/lattice';

interface Step { label: string; profile: number[]; delta: number; b1: number; insertions: number; nodes: number; ms: number; }

/**
 * BKZ 를 한 바퀴씩 돌리며 Gram–Schmidt 로그 프로파일이 어떻게 평평해지는지 본다.
 * 격자: q-ary 격자 (q = 65537, 차원 d, 부피 q^{d/2}).
 */
export default function BKZTour() {
  const [d, setD] = useState(50);
  const [beta, setBeta] = useState(16);
  const [seed, setSeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const B0 = useMemo(() => qaryLattice(d, 65537, seed), [d, seed]);
  const lv = useMemo(() => logVolume2(B0), [B0]);
  const gh = 2 ** log2GH(d, lv);
  const start = useMemo(() => {
    const t = performance.now();
    const L = lll(B0, 0.99).basis;
    return { basis: L, step: { label: 'LLL', profile: gsoLogProfile(L), delta: rootHermite(L), b1: Math.sqrt(norm2(L[0])), insertions: 0, nodes: 0, ms: performance.now() - t } };
  }, [B0]);
  const [cur, setCur] = useState<{ basis: Basis; steps: Step[] } | null>(null);
  const state = cur && cur.basis.length === d && cur.steps[0].profile.length === d ? cur : { basis: start.basis, steps: [start.step] };
  const reset = () => setCur(null);
  const tour = (times: number) => {
    setBusy(true);
    setTimeout(() => {
      let B = state.basis;
      const steps = [...state.steps];
      for (let i = 0; i < times; i++) {
        const t = performance.now();
        const r = bkzTour(B, beta);
        B = r.basis;
        steps.push({ label: `BKZ-${beta} #${steps.filter((s) => s.label.startsWith('BKZ')).length + 1}`, profile: gsoLogProfile(B), delta: rootHermite(B), b1: Math.sqrt(norm2(B[0])), insertions: r.stats.insertions, nodes: r.stats.nodes, ms: performance.now() - t });
      }
      setCur({ basis: B, steps });
      setBusy(false);
    }, 20);
  };
  const last = state.steps[state.steps.length - 1], first = state.steps[0];
  const W = 640, H = 250, L = 40, R = 10, T = 10, Bm = 24;
  const all = state.steps.flatMap((s) => s.profile);
  const ymax = Math.ceil(Math.max(...all) + 0.3), ymin = Math.floor(Math.min(...all) - 0.3);
  const X = (i: number) => L + ((W - L - R) * i) / (d - 1);
  const Y = (v: number) => T + ((H - T - Bm) * (ymax - v)) / (ymax - ymin);
  const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const gsa = (delta: number) => Array.from({ length: d }, (_, i) => lv / d + (d - 1 - 2 * i) * Math.log2(delta));
  return (
    <div className="widget not-content">
      <h4>BKZ 한 바퀴씩: 프로파일이 평평해진다</h4>
      <p className="widget-sub">q-ary 격자(q = 65537)를 LLL 로 축소한 뒤, 블록 크기 β 의 BKZ 를 한 바퀴씩 돌립니다. 각 위치 k 에서 β 차원 사영 블록의 최단 벡터를 <b>열거</b>로 찾아 끼워 넣습니다. 곡선 = log₂‖bᵢ*‖, 점선 = 측정한 δ 의 GSA 직선.</p>
      <div className="controls">
        <label className="slider">격자 차원 d <b>{d}</b>
          <select value={d} onChange={(e) => { setD(+e.target.value); reset(); }}>{[40, 50, 60].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label>
        <label className="slider">블록 크기 β <b>{beta}</b>
          <input type="range" min={4} max={24} step={2} value={beta} onChange={(e) => setBeta(+e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => tour(1)}>{busy ? '계산 중…' : `BKZ-${beta} 한 바퀴`}</button>
        <button disabled={busy} onClick={() => tour(3)}>세 바퀴</button>
        <button disabled={busy} onClick={reset}>LLL 로 되돌리기</button>
        <button disabled={busy} onClick={() => { setSeed((s) => s + 1); reset(); }}>새 격자</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="GSO 로그 프로파일">
        {Array.from({ length: ymax - ymin + 1 }, (_, i) => ymin + i).filter((t) => t % 2 === 0).map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">{t}</text></g>)}
        <path d={path(first.profile)} fill="none" stroke="var(--w-point)" strokeWidth={2} />
        {state.steps.length > 1 && <path d={path(last.profile)} fill="none" stroke="var(--w-b1)" strokeWidth={2.5} />}
        <path d={path(gsa(last.delta))} fill="none" stroke="var(--w-b2)" strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={W - R} y={H - 6} fontSize="12" textAnchor="end" fill="var(--w-muted)">i → {d}</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>단계</span><b>{last.label}</b></div>
        <div className="stat"><span>근 Hermite 인자 δ (LLL → 지금)</span><b>{first.delta.toFixed(4)} → {last.delta.toFixed(4)}</b></div>
        <div className="stat"><span>‖b₁‖ / GH</span><b>{last.b1.toFixed(0)} / {gh.toFixed(0)} = {(last.b1 / gh).toFixed(2)}</b></div>
        <div className="stat"><span>이번 바퀴: 삽입 · 열거 노드 · 시간</span><b>{state.steps.length > 1 ? `${last.insertions} · ${last.nodes.toLocaleString()} · ${last.ms.toFixed(0)}ms` : '—'}</b></div>
      </div>
      <p className="note">회색(LLL)보다 파랑(BKZ)의 기울기가 완만할수록 δ 가 작고 ‖b₁‖ 이 짧습니다. 참고값(Gama–Nguyen 2008, 큰 차원 평균): LLL 1.0219, BKZ-20 1.0128, BKZ-28 1.0109. 이 위젯의 차원(40~60)은 작아서 측정값이 흔들리고, 투어마다 늘 좋아지지도 않습니다. β 를 2 늘릴 때마다 열거 노드 수가 몇 배씩 느는 것도 보세요. 이것이 β 를 키우는 비용입니다.</p>
    </div>
  );
}
