import { useState } from 'react';
import { NTRU_SCHEMES, log2Fatigue, usvpBetaNTRU } from '../lib/ntruattack';

/**
 * (log n, log q) 평면의 NTRU 지도. 점선 = Ducas–van Woerden 의 fatigue point q* ≈ 0.004·n^2.484 (삼진 비밀).
 * 그 위(overstretched)에서는 밀집 부분격자가 uSVP 예측보다 먼저 드러난다.
 */
export default function FatigueMap() {
  const [logn, setLogn] = useState(9);
  const [logq, setLogq] = useState(13);
  const n = Math.round(2 ** logn);
  const fat = log2Fatigue(n);
  const beta = usvpBetaNTRU(n, logq, Math.sqrt(2 / 3));
  const over = logq > fat;
  const W = 620, H = 260, L = 44, R = 10, T = 10, B = 28;
  const xmin = 8, xmax = 11.2, ymin = 8, ymax = 30;
  const X = (v: number) => L + ((W - L - R) * (v - xmin)) / (xmax - xmin);
  const Y = (v: number) => T + ((H - T - B) * (ymax - v)) / (ymax - ymin);
  const fatPath = Array.from({ length: 41 }, (_, i) => { const x = xmin + ((xmax - xmin) * i) / 40; return `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(log2Fatigue(2 ** x)).toFixed(1)}`; }).join(' ');
  const shade = `${fatPath} L${X(xmax)},${Y(ymax)} L${X(xmin)},${Y(ymax)} Z`;
  return (
    <div className="widget not-content">
      <h4>NTRU 지도: 어디부터 overstretched 인가</h4>
      <p className="widget-sub">가로 = log₂ n, 세로 = log₂ q. 빗금 친 영역(점선 위)은 Ducas–van Woerden(2021)이 예측한 overstretched 영역(삼진 비밀)으로, 비밀키의 회전들이 만드는 밀집 부분격자가 18장의 uSVP 예측보다 먼저 드러납니다. 점은 실제 스킴입니다.</p>
      <div className="controls">
        <label className="slider">n = 2^{logn.toFixed(2)} <b>{n}</b>
          <input type="range" min={8} max={11.2} step={0.05} value={logn} onChange={(e) => setLogn(+e.target.value)} />
        </label>
        <label className="slider">log₂ q <b>{logq.toFixed(1)}</b>
          <input type="range" min={8} max={30} step={0.1} value={logq} onChange={(e) => setLogq(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="NTRU 파라미터 지도">
        {[10, 15, 20, 25, 30].map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">{t}</text></g>)}
        {[256, 512, 1024, 2048].map((v) => <text key={v} x={X(Math.log2(v))} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-muted)">n={v}</text>)}
        <path d={shade} fill="var(--w-bad)" opacity={0.12} />
        <path d={fatPath} fill="none" stroke="var(--w-bad)" strokeWidth={2} strokeDasharray="6 4" />
        <text x={X(10.9)} y={Y(log2Fatigue(2 ** 10.9)) - 8} fontSize="12" textAnchor="end" fill="var(--w-bad)">q* ≈ 0.004·n^2.484</text>
        {NTRU_SCHEMES.map((s) => <g key={s.name}><circle cx={X(Math.log2(s.n))} cy={Y(Math.log2(s.q))} r={4} fill={s.name.startsWith('Falcon') ? 'var(--w-b2)' : 'var(--w-b1)'} /></g>)}
        <circle cx={X(logn)} cy={Y(logq)} r={7} fill="none" stroke="var(--w-text)" strokeWidth={2.5} />
      </svg>
      <div className="stats">
        <div className="stat"><span>이 n 의 fatigue point log₂ q*</span><b>{fat.toFixed(1)}</b></div>
        <div className="stat"><span>영역</span><b className={over ? 'bad' : 'good'}>{over ? `overstretched (+${(logq - fat).toFixed(1)} 비트)` : `표준 (여유 ${(fat - logq).toFixed(1)} 비트)`}</b></div>
        <div className="stat"><span>uSVP 예측 β · core-SVP</span><b>{beta ? `${beta} · 2^${(0.292 * beta).toFixed(0)}` : 'β < 50'}</b></div>
        <div className="stat"><span>그 β 를 믿어도 되나</span><b>{over ? '아니오: 실제로는 더 작다' : '예 (uSVP 가 먼저)'}</b></div>
      </div>
      <p className="note">파랑 점 = NTRU-HPS·HRSS(NIST 3라운드), NTRU+(KpqC). 주황 점 = Falcon: 비밀이 삼진이 아니라 더 크므로(표준편차 약 4) 이 선이 그대로 적용되지 않고, 경계가 위로 올라갑니다. 실제 스킴은 모두 경계보다 2~5 비트 아래에 있습니다. 반면 큰 q 가 필요한 NTRU 기반 동형암호·다중선형 사상은 이 지도의 한참 위(log₂ q 가 수백)에 있었고, 그래서 깨졌습니다.</p>
    </div>
  );
}
