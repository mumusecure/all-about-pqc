import { useState } from 'react';
import { bimodalM, solveAlpha, unimodalM } from '../lib/sigs';

/**
 * 가우시안 거절 샘플링에서 ‘한쪽으로 밀린’ 제안 분포와 ‘양쪽(바이모달)’ 제안 분포 비교.
 * α = σ/‖cs‖. 같은 반복 횟수 M 을 얻는 데 필요한 σ 가 서명 크기를 정한다.
 */
export default function BimodalRejection() {
  const [alpha, setAlpha] = useState(2);
  const [targetM, setTargetM] = useState(3);
  const W = 620, H = 190, L = 10, R = 10, T = 10, B = 22;
  const sigma = alpha, v = 1;
  const xr = Math.max(4 * sigma + 1.5, 4);
  const X = (x: number) => L + ((x + xr) / (2 * xr)) * (W - L - R);
  const g = (x: number, mu: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
  const peak = 1;
  const Y = (p: number) => T + (H - T - B) * (1 - p / (peak * 1.05));
  const path = (f: (x: number) => number) => Array.from({ length: 241 }, (_, i) => { const x = -xr + (2 * xr * i) / 240; return `${X(x).toFixed(1)},${Y(f(x)).toFixed(1)}`; }).join(' ');
  const Mu = unimodalM(alpha), Mb = bimodalM(alpha);
  const au = solveAlpha(unimodalM, targetM), ab = solveAlpha(bimodalM, targetM);
  return (
    <div className="widget not-content">
      <h4>바이모달 거절 샘플링: 같은 반복 횟수, 더 작은 서명</h4>
      <p className="widget-sub">응답 z = y + v (v = c·s, ‖v‖ = 1 로 정규화), y ← 가우시안(σ = α). 목표는 받아들인 z 가 <b>회색</b>(중심 0) 분포를 따르게 하는 것. 파랑 = 한쪽으로 밀린 제안, 주황 = 부호를 무작위로 고른 바이모달 제안 ½(y + v) + ½(y − v).</p>
      <div className="controls">
        <label className="slider">α = σ / ‖v‖ <b>{alpha.toFixed(2)}</b>
          <input type="range" min={0.5} max={14} step={0.05} value={alpha} onChange={(e) => setAlpha(+e.target.value)} />
        </label>
        <label className="slider">목표 반복 횟수 M <b>{targetM.toFixed(1)}</b>
          <input type="range" min={1.5} max={8} step={0.1} value={targetM} onChange={(e) => setTargetM(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="세 분포">
        <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="var(--w-grid)" />
        <polyline points={path((x) => g(x, 0))} fill="none" stroke="var(--w-point)" strokeWidth={4} opacity={0.6} />
        <polyline points={path((x) => g(x, v))} fill="none" stroke="var(--w-b1)" strokeWidth={2} />
        <polyline points={path((x) => 0.5 * g(x, v) + 0.5 * g(x, -v))} fill="none" stroke="var(--w-b2)" strokeWidth={2} strokeDasharray="6 3" />
        <text x={X(0)} y={H - 6} fontSize="12" textAnchor="middle" fill="var(--w-muted)">0</text>
        <text x={X(v)} y={H - 6} fontSize="12" textAnchor="middle" fill="var(--w-b1)">v</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>한쪽 이동: M = e^(12/α + 1/2α²)</span><b>{Mu > 1e6 ? '> 10⁶' : Mu.toFixed(2)}</b></div>
        <div className="stat"><span>바이모달: M = e^(1/2α²)</span><b>{Mb > 1e6 ? '> 10⁶' : Mb.toFixed(2)}</b></div>
        <div className="stat"><span>M = {targetM.toFixed(1)} 에 필요한 α (한쪽 / 바이모달)</span><b>{au.toFixed(1)} / {ab.toFixed(2)}</b></div>
        <div className="stat"><span>σ 비 → 계수당 아끼는 비트</span><b>{(au / ab).toFixed(1)}배 → ≈ {Math.log2(au / ab).toFixed(1)} 비트</b></div>
      </div>
      <p className="note">한쪽으로 밀린 제안은 목표 분포와의 비가 z 가 −∞ 로 갈 때 끝없이 커져서, 꼬리를 잘라내고(통계적 거리 2⁻¹⁰⁰) 그 대가로 σ 를 ‖v‖ 의 열 배 이상 잡아야 합니다. 바이모달은 두 봉우리의 평균이 대칭이라 비가 e^(‖v‖²/2σ²)/cosh(⟨z,v⟩/σ²) 로 <b>유계</b>이고, σ 를 ‖v‖ 정도까지 줄일 수 있습니다. 서명의 각 계수가 σ 에 비례하므로 크기가 줄어듭니다. 대가: 부호를 지우려면 키가 mod 2q 의 특별한 관계를 만족해야 합니다(BLISS, HAETAE).</p>
    </div>
  );
}
