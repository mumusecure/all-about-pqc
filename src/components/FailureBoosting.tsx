import { useDeferredValue, useMemo, useState } from 'react';
import { type MLKEMParams, PARAMS } from '../lib/mlkem';
import { boostingCurve } from '../lib/sidechannel';

type Preset = keyof typeof PARAMS;

/**
 * failure boosting 의 절충: 약한 암호문(동전의 노름이 큰 것)만 골라 질의하면 실패 하나를 얻는 데 필요한
 * '질의 수'는 줄지만, 그런 암호문을 찾는 '사전 계산'이 늘어난다.
 */
export default function FailureBoosting() {
  const [base, setBase] = useState<Preset>('ML-KEM-768');
  const [dv, setDv] = useState(PARAMS['ML-KEM-768'].dv);
  const P: MLKEMParams = { ...PARAMS[base], dv };
  const dp = useDeferredValue(P);
  const res = useMemo(() => boostingCurve(dp), [dp.k, dp.eta1, dp.eta2, dp.du, dp.dv]);
  const LIMIT = 64;
  const feasible = res.pts.filter((p) => p.log2Q <= LIMIT);
  const bestFeasible = feasible.reduce<(typeof res.pts)[number] | null>((a, b) => (!a || b.log2Work < a.log2Work ? b : a), null);
  const pts = res.pts.filter((p) => p.log2Work < 600);
  const W = 620, H = 240, L = 46, R = 10, T = 10, B = 28;
  const xmax = Math.ceil(Math.max(...pts.map((p) => p.log2Q), 70) / 20) * 20, xmin = 0;
  const ymax = Math.ceil(Math.max(...pts.map((p) => p.log2Work)) / 50) * 50, ymin = 0;
  const ystep = ymax > 300 ? 100 : 50;
  const X = (v: number) => L + ((W - L - R) * (v - xmin)) / (xmax - xmin);
  const Y = (v: number) => T + ((H - T - B) * (ymax - v)) / (ymax - ymin);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.log2Q).toFixed(1)},${Y(p.log2Work).toFixed(1)}`).join(' ');
  const noBoost = pts[0];
  return (
    <div className="widget not-content">
      <h4>failure boosting: 질의를 줄이려면 계산을 더 한다</h4>
      <p className="widget-sub">FO 때문에 공격자는 암호문을 마음대로 못 만들지만, 메시지 m 을 많이 시도해 동전 (r, e₁) 의 노름이 큰 <b>약한 암호문</b>만 골라 보낼 수는 있습니다. 곡선의 각 점 = "R² ≥ 임계값" 인 암호문만 쓰는 전략. 가로 = 실패 하나에 필요한 복호 질의(log₂), 세로 = 그 암호문들을 찾는 사전 계산(log₂).</p>
      <div className="row">
        {(Object.keys(PARAMS) as Preset[]).map((k) => <button key={k} className={base === k && dv === PARAMS[k].dv ? 'primary' : ''} onClick={() => { setBase(k); setDv(PARAMS[k].dv); }}>{k}</button>)}
      </div>
      <div className="controls">
        <label className="slider">dv (v 압축, 줄이면 δ 가 커짐) <b>{dv}</b>
          <input type="range" min={2} max={5} value={dv} onChange={(e) => setDv(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="질의 수 대 사전 계산">
        {Array.from({ length: Math.floor(ymax / ystep) + 1 }, (_, i) => i * ystep).map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">2^{t}</text></g>)}
        {Array.from({ length: xmax / 20 + 1 }, (_, i) => i * 20).map((t) => <text key={t} x={X(t)} y={H - 8} fontSize="12" textAnchor={t === xmax ? 'end' : t === 0 ? 'start' : 'middle'} fill="var(--w-muted)">2^{t}</text>)}
        <rect x={L} y={T} width={X(LIMIT) - L} height={H - T - B} fill="var(--w-bad)" opacity={0.08} />
        <line x1={X(LIMIT)} x2={X(LIMIT)} y1={T} y2={H - B} stroke="var(--w-bad)" strokeDasharray="5 4" />
        <text x={X(LIMIT) - 4} y={T + 14} fontSize="12" textAnchor="end" fill="var(--w-bad)">질의 ≤ 2^64</text>
        <path d={path} fill="none" stroke="var(--w-b1)" strokeWidth={2.5} />
        {noBoost && <circle cx={X(noBoost.log2Q)} cy={Y(noBoost.log2Work)} r={5} fill="var(--w-good)" />}
      </svg>
      <div className="stats">
        <div className="stat"><span>복호 실패 확률 δ (이 모델)</span><b>2^{res.log2Delta.toFixed(1)}</b></div>
        <div className="stat"><span>부스팅 없음 (초록 점)</span><b>질의 2^{noBoost?.log2Q.toFixed(0)} · 계산 2^{noBoost?.log2Work.toFixed(0)}</b></div>
        <div className="stat"><span>질의 ≤ 2^64 일 때 최소 계산</span><b className={bestFeasible && bestFeasible.log2Work < 128 ? 'bad' : 'good'}>{bestFeasible ? `2^${bestFeasible.log2Work.toFixed(0)}` : `불가능 (최소 질의 2^${Math.min(...res.pts.map((p) => p.log2Q)).toFixed(0)})`}</b></div>
      </div>
      <p className="note">ML-KEM 에서는 확률이 2^−1000 쯤인 극단적인 동전만 골라도 질의가 2^64 를 넘어, 실패 하나조차 얻을 수 없습니다. dv 를 2 로 줄여 δ 를 키우면 곡선이 왼쪽 아래로 내려오는 것을 보세요. 이 그림은 가장 단순한 부스팅이고(조건부 잡음을 가우시안으로 근사, δ 는 정확값보다 최대 3.5 비트 작게 나옴), 실제 공격은 실패를 하나 얻은 뒤 그 방향 정보를 써서 다음 실패를 더 싸게 찾습니다(directional failure boosting).</p>
    </div>
  );
}
