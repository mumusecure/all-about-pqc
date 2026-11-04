import { useState } from 'react';
import { cycloUnit, l2, log2AbsNorm, logProfile, timesUnitPower } from '../lib/modules';

const N = 16;
const G0 = [3, -1, 4, 1, -5, 9, 2, -6, 5, 3, -5, 8, 9, -7, 9, 3];
/** 일부러 한쪽으로 기울인 시작점: G0·u₃²·u₅⁻¹ (같은 이데알의 생성원) */
const G = timesUnitPower(timesUnitPower(G0, cycloUnit(N, 3), 2), cycloUnit(N, 5), -1);

/**
 * 단원을 곱해도 모듈은 그대로다. 하지만 원소의 '모양'(임베딩마다의 크기)은 바뀐다.
 * R-위의 LLL 은 노름(곱)이 같은 후보들 가운데 가장 고른 것을 골라야 하고, 그것이 로그-단원 격자의 CVP 다.
 */
export default function UnitBalance() {
  const [e3, setE3] = useState(0);
  const [e5, setE5] = useState(0);
  const h = timesUnitPower(timesUnitPower(G, cycloUnit(N, 3), e3), cycloUnit(N, 5), e5);
  const prof = logProfile(h);
  const mean = log2AbsNorm(h) / N;
  const sd = Math.sqrt(prof.reduce((s, x) => s + (x - mean) ** 2, 0) / prof.length);
  const W = 620, H = 200, L = 40, R = 10, T = 10, B = 26;
  const ymax = 14, ymin = -4;
  const bw = (W - L - R) / prof.length;
  const Y = (v: number) => T + ((H - T - B) * (ymax - Math.max(ymin, Math.min(ymax, v)))) / (ymax - ymin);
  return (
    <div className="widget not-content">
      <h4>단원의 곱: 노름은 같고 모양은 다르다</h4>
      <p className="widget-sub">R = ℤ[x]/(x¹⁶+1) 의 원소 g (일부러 기울어진 생성원) 에 원분 단원 u₃ = 1 + x + x², u₅ = 1 + x + … + x⁴ 의 거듭제곱을 곱합니다. 막대 = 임베딩마다의 log₂|σⱼ(g·u)| (켤레 쌍은 하나만), 점선 = 평균 = log₂|N(g)|/n. 단원은 노름이 ±1 이라 <b>막대의 합은 그대로</b>이고, 높낮이만 옮겨 갑니다.</p>
      <div className="controls">
        <label className="slider">u₃ 의 지수 <b>{e3}</b><input type="range" min={-3} max={3} value={e3} onChange={(e) => setE3(+e.target.value)} /></label>
        <label className="slider">u₅ 의 지수 <b>{e5}</b><input type="range" min={-3} max={3} value={e5} onChange={(e) => setE5(+e.target.value)} /></label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="임베딩별 로그 크기">
        {[-4, 0, 4, 8, 12].map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">{t}</text></g>)}
        {prof.map((v, j) => <rect key={j} x={L + j * bw + bw * 0.15} y={Math.min(Y(v), Y(0))} width={bw * 0.7} height={Math.abs(Y(v) - Y(0))} fill="var(--w-b1)" opacity={0.85} />)}
        <line x1={L} x2={W - R} y1={Y(mean)} y2={Y(mean)} stroke="var(--w-b2)" strokeDasharray="6 4" strokeWidth={2} />
        {prof.map((_, j) => <text key={j} x={L + j * bw + bw / 2} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-muted)">σ{j}</text>)}
      </svg>
      <div className="stats">
        <div className="stat"><span>log₂|N(g·u)| (불변)</span><b>{log2AbsNorm(h).toFixed(2)}</b></div>
        <div className="stat"><span>고르지 않음 (로그 표준편차)</span><b>{sd.toFixed(2)}</b></div>
        <div className="stat"><span>계수 길이 ‖g·u‖</span><b className={e3 === 0 && e5 === 0 ? '' : l2(h) < l2(G) ? 'good' : 'bad'}>{l2(h).toFixed(1)} (시작 {l2(G).toFixed(1)})</b></div>
      </div>
      <p className="note">두 지수를 움직여 막대를 가장 평평하게 만들어 보세요. 가장 평평한 곳에서 계수 길이가 시작값의 약 3/4 로 짧아집니다. 모듈의 기저 벡터 하나에 단원을 곱해도 같은 모듈입니다. 그래서 "길이"를 노름(막대의 합)으로만 재면 g 와 g·u 를 구별하지 못하고, 실제 유클리드 길이는 막대가 <b>고를수록</b> 짧습니다(AM–GM). R 위에서 LLL 을 하려면 매 단계 단원을 곱해 막대를 평평하게 맞춰야 하는데, 이것은 막대 벡터를 단원들의 로그 벡터가 만드는 격자(로그-단원 격자)의 가장 가까운 점으로 옮기는 CVP 입니다. Lee–Pellet-Mary–Stehlé–Wallet(2019)의 module-LLL 이 바로 이 CVP 오라클을 씁니다.</p>
    </div>
  );
}
