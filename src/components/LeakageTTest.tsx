import { useMemo, useState } from 'react';
import { mulberry32 } from '../lib/lwe';
import { tvla } from '../lib/sidechannel';

/**
 * TVLA 식 누출 검정: 고정 입력과 무작위 입력의 측정값 평균이 다른지 Welch t 로 본다. |t| > 4.5 이면 '누출'.
 * 누출 크기 λ (잡음 σ = 1 대비) 가 작아도 측정 수 m 을 늘리면 결국 드러난다: t ≈ (λ/2)·√(m/2).
 */
export default function LeakageTTest() {
  const [lambda, setLambda] = useState(0.05);
  const [seed, setSeed] = useState(1);
  const ms = useMemo(() => Array.from({ length: 21 }, (_, i) => Math.round(10 ** (2 + (i * 4) / 20))), []);
  const ts = useMemo(() => { const r = mulberry32(seed); return ms.map((m) => tvla(r, m, lambda, 1)); }, [lambda, seed, ms]);
  const need = lambda > 0 ? 2 * (4.5 / (lambda / 2)) ** 2 : Infinity;
  const W = 620, H = 220, L = 40, R = 10, T = 10, B = 28;
  const ymax = Math.max(10, Math.ceil(Math.max(...ts.map(Math.abs)) / 5) * 5);
  const X = (m: number) => L + ((W - L - R) * (Math.log10(m) - 2)) / 4;
  const Y = (t: number) => T + ((H - T - B) * (ymax - Math.min(ymax, Math.abs(t)))) / ymax;
  const theory = ms.map((m, i) => `${i ? 'L' : 'M'}${X(m).toFixed(1)},${Y((lambda / 2) * Math.sqrt(m / 2)).toFixed(1)}`).join(' ');
  return (
    <div className="widget not-content">
      <h4>작은 누출도 모으면 보인다: t-검정</h4>
      <p className="widget-sub">어떤 연산의 실행 시간(또는 전력)이 비밀 비트가 1 일 때 λ 만큼 길다고 합시다(측정 잡음 σ = 1). 고정 입력 m 번, 무작위 입력 m 번을 재서 평균을 비교하는 Welch t 가 4.5 를 넘으면 누출로 판정합니다(TVLA 관행). 점 = 시뮬레이션, 선 = 기대값.</p>
      <div className="controls">
        <label className="slider">누출 크기 λ / σ <b>{lambda.toFixed(3)}</b>
          <input type="range" min={0} max={0.3} step={0.005} value={lambda} onChange={(e) => setLambda(+e.target.value)} />
        </label>
      </div>
      <div className="row"><button onClick={() => setSeed((s) => s + 1)}>다시 측정</button></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="측정 수에 따른 t 값">
        {[0, 5, 10, 15, 20].filter((t) => t <= ymax).map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">{t}</text></g>)}
        <line x1={L} x2={W - R} y1={Y(4.5)} y2={Y(4.5)} stroke="var(--w-bad)" strokeDasharray="6 4" strokeWidth={2} />
        <text x={W - R} y={Y(4.5) - 5} fontSize="12" textAnchor="end" fill="var(--w-bad)">|t| = 4.5</text>
        <path d={theory} fill="none" stroke="var(--w-b2)" strokeWidth={2} />
        {ts.map((t, i) => <circle key={i} cx={X(ms[i])} cy={Y(t)} r={4} fill={Math.abs(t) > 4.5 ? 'var(--w-bad)' : 'var(--w-b1)'} />)}
        {[100, 1000, 10000, 100000, 1000000].map((m) => <text key={m} x={X(m)} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-muted)">m = {m >= 1000 ? `${m / 1000}k` : m}</text>)}
      </svg>
      <div className="stats">
        <div className="stat"><span>|t| &gt; 4.5 에 필요한 측정 (클래스당)</span><b>{Number.isFinite(need) ? `≈ ${Math.round(need).toLocaleString()}` : '영원히 (누출 없음)'}</b></div>
        <div className="stat"><span>m = 1,000,000 에서의 |t|</span><b className={Math.abs(ts[ts.length - 1]) > 4.5 ? 'bad' : 'good'}>{Math.abs(ts[ts.length - 1]).toFixed(1)}</b></div>
      </div>
      <p className="note">λ = 0.02 처럼 잡음의 2% 에 불과한 차이도 클래스당 약 40 만 번 재면 드러납니다. 측정 수는 λ² 에 반비례하므로, 누출을 "줄이는" 것은 공격을 늦출 뿐이고 막으려면 λ = 0, 즉 <b>상수 시간</b>이어야 합니다. KyberSlash 의 작은 나눗셈 시간 차이가 실제 키 복구로 이어진 이유이고, dudect 같은 도구가 바로 이 검정을 자동으로 돌립니다. 다만 t-검정은 '누출이 있다'를 보여 줄 뿐, 그 누출로 키를 얻는 것은 별도의 공격입니다.</p>
    </div>
  );
}
