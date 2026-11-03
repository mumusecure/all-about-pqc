import { useMemo, useState } from 'react';
import { type B2, type V2, covariance, gso, nearestPlane, roundOff } from '../lib/sigs';
import { mulberry32 } from '../lib/lwe';

type Mode = 'round' | 'plane' | 'klein';
const SECRET: B2 = [[6, 1], [2, 5]];

/**
 * hash-and-sign 의 누출: 서명 = 해시 점 t 에 가까운 격자점 v. 공격자는 t − v 를 모은다.
 * Babai 반올림 → 평행사변형 P½(B), 최근접 평면 → 직사각형 P½(B*), Klein/GPV → 둥근 가우시안.
 */
export default function ParallelepipedLeak() {
  const [mode, setMode] = useState<Mode>('round');
  const [count, setCount] = useState(1200);
  const [k, setK] = useState(2.5);
  const [showB, setShowB] = useState(false);
  const { bs } = gso(SECRET);
  const maxBs = Math.max(...bs.map((b) => Math.hypot(b[0], b[1])));
  const sigma = k * maxBs;
  const pts = useMemo(() => {
    const r = mulberry32(17 + count);
    return Array.from({ length: count }, () => {
      const t: V2 = [r() * 400, r() * 400];
      const v = mode === 'round' ? roundOff(SECRET, t) : mode === 'plane' ? nearestPlane(SECRET, t) : nearestPlane(SECRET, t, r, sigma);
      return [t[0] - v[0], t[1] - v[1]] as V2;
    });
  }, [mode, count, sigma]);
  const cov = covariance(pts);
  const S = 360, C = S / 2;
  const range = mode === 'klein' ? Math.max(8, 3.2 * sigma) : 8;
  const P = (x: number) => C + (x / range) * (C - 10);
  const Py = (y: number) => C - (y / range) * (C - 10);
  const ell = Array.from({ length: 73 }, (_, i) => {
    const th = (2 * Math.PI * i) / 72, a = 2 * Math.sqrt(cov.l1), b = 2 * Math.sqrt(Math.max(cov.l2, 0));
    const x = a * Math.cos(th) * Math.cos(cov.angle) - b * Math.sin(th) * Math.sin(cov.angle);
    const y = a * Math.cos(th) * Math.sin(cov.angle) + b * Math.sin(th) * Math.cos(cov.angle);
    return `${P(x).toFixed(1)},${Py(y).toFixed(1)}`;
  }).join(' ');
  const deg = (r: number) => ((r * 180) / Math.PI).toFixed(0);
  const ratio = cov.l1 / Math.max(cov.l2, 1e-9);
  return (
    <div className="widget not-content">
      <h4>서명이 비밀 기저를 그린다: 평행사변형 공격</h4>
      <p className="widget-sub">비밀 기저(좋은 기저)로 해시 점 t 근처의 격자점 v 를 찾아 서명합니다. 공격자는 공개된 (t, v) 만으로 차이 t − v 를 모읍니다. 점이 그리는 모양이 기저를 드러내는지 보세요.</p>
      <div className="row">
        <button className={mode === 'round' ? 'primary' : ''} onClick={() => setMode('round')}>Babai 반올림 (GGH/NTRUSign)</button>
        <button className={mode === 'plane' ? 'primary' : ''} onClick={() => setMode('plane')}>최근접 평면</button>
        <button className={mode === 'klein' ? 'primary' : ''} onClick={() => setMode('klein')}>Klein 샘플러 (GPV)</button>
      </div>
      <div className="controls">
        <label className="slider">서명 수 <b>{count}</b>
          <input type="range" min={50} max={3000} step={50} value={count} onChange={(e) => setCount(+e.target.value)} />
        </label>
        {mode === 'klein' && <label className="slider">가우시안 폭 σ = <b>{k.toFixed(1)} × max‖bᵢ*‖</b>
          <input type="range" min={0.3} max={4} step={0.1} value={k} onChange={(e) => setK(+e.target.value)} />
        </label>}
        <label className="slider" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={showB} onChange={(e) => setShowB(e.target.checked)} /> 비밀 기저 겹쳐 보기
        </label>
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 380, margin: '0 auto' }} role="img" aria-label="t − v 의 분포">
        <line x1={0} x2={S} y1={C} y2={C} stroke="var(--w-grid)" />
        <line y1={0} y2={S} x1={C} x2={C} stroke="var(--w-grid)" />
        {pts.map((p, i) => <circle key={i} cx={P(p[0])} cy={Py(p[1])} r={1.6} fill="var(--w-b1)" opacity={0.55} />)}
        <polyline points={ell} fill="none" stroke="var(--w-b2)" strokeWidth={2} />
        {showB && SECRET.map((b, i) => <line key={i} x1={P(-b[0] / 2)} y1={Py(-b[1] / 2)} x2={P(b[0] / 2)} y2={Py(b[1] / 2)} stroke="var(--w-good)" strokeWidth={3} />)}
      </svg>
      <div className="stats">
        <div className="stat"><span>공분산 고윳값 비 (1 = 둥긂)</span><b className={ratio < 1.25 ? 'good' : 'bad'}>{ratio.toFixed(2)}</b></div>
        <div className="stat"><span>주홍 타원의 긴 축 각도</span><b>{deg(cov.angle)}°</b></div>
        <div className="stat"><span>공분산 행렬</span><b>[{cov.a.toFixed(1)}, {cov.b.toFixed(1)}; {cov.b.toFixed(1)}, {cov.d.toFixed(1)}]</b></div>
        <div className="stat"><span>반올림이라면 BᵀB/12</span><b>[{(40 / 12).toFixed(1)}, {(16 / 12).toFixed(1)}; {(16 / 12).toFixed(1)}, {(26 / 12).toFixed(1)}]</b></div>
      </div>
      <p className="note">반올림 서명의 t − v 는 평행사변형 P½(B) 위에서 균등하고, 공분산이 정확히 BᵀB/12 라 비밀 기저의 모양이 그대로 샙니다. Nguyen–Regev(2006)는 여기에 4차 모멘트를 더해 기저 자체를 복원하고 GGH·NTRUSign 서명을 깼습니다. GPV 의 해법은 반올림 대신 <b>이산 가우시안</b>에서 계수를 뽑는 것입니다. σ 가 GSO 길이보다 충분히 크면 출력 분포가 기저와 무관한 둥근 가우시안이 됩니다. σ 를 줄여 보면 다시 모양이 드러납니다. 대가: σ 가 크면 서명이 길어지므로, GSO 가 고르게 짧은 기저가 곧 좋은 비밀키입니다(FN-DSA).</p>
    </div>
  );
}
