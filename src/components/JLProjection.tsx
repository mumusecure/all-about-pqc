import { useMemo, useState } from 'react';
import { jlRatios } from '../lib/zk';
import { mulberry32 } from '../lib/lwe';

/**
 * 근사 노름 증명의 핵심: 무작위 사영 Π ∈ {−1,0,1}^{256×m} (확률 1/4, 1/2, 1/4) 은 길이를 거의 보존한다.
 * E‖Πw‖² = 128‖w‖², 그리고 ‖Πw‖² 가 그보다 훨씬 작아질 확률은 아주 작다.
 */
export default function JLProjection() {
  const [m, setM] = useState(512);
  const [seed, setSeed] = useState(1);
  const [shape, setShape] = useState<'spread' | 'spiky'>('spread');
  const w = useMemo(() => {
    const r = mulberry32(seed + m);
    return shape === 'spread' ? Array.from({ length: m }, () => Math.floor(r() * 7) - 3) : Array.from({ length: m }, (_, i) => (i < 3 ? 40 : 0));
  }, [m, seed, shape]);
  const rs = useMemo(() => jlRatios(w, 300, seed), [w, seed]);
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length, mn = Math.min(...rs);
  const bins = 30, lo = 0, hi = 256;
  const hist = new Array(bins).fill(0);
  rs.forEach((x) => { const k = Math.min(bins - 1, Math.floor(((x - lo) / (hi - lo)) * bins)); hist[k]++; });
  const W = 620, H = 180, L = 30, R = 10, T = 10, B = 26;
  const bw = (W - L - R) / bins, hmax = Math.max(...hist);
  const X = (v: number) => L + ((W - L - R) * (v - lo)) / (hi - lo);
  return (
    <div className="widget not-content">
      <h4>JL 사영: 길이를 256 개의 숫자로 증명하기</h4>
      <p className="widget-sub">길이 m 의 비밀 벡터 w 가 짧다는 것을 직접 보이는 대신, 검증자가 고른 무작위 Π 로 사영한 Πw (256 개 수)가 짧음을 보입니다. 막대 = Π 300 개에 대한 ‖Πw‖² / ‖w‖² 의 분포.</p>
      <div className="row">
        <button className={shape === 'spread' ? 'primary' : ''} onClick={() => setShape('spread')}>고르게 퍼진 w</button>
        <button className={shape === 'spiky' ? 'primary' : ''} onClick={() => setShape('spiky')}>몇 좌표에 몰린 w</button>
        <button onClick={() => setSeed((s) => s + 1)}>다시 뽑기</button>
      </div>
      <div className="controls">
        <label className="slider">비밀의 길이 m <b>{m}</b>
          <input type="range" min={128} max={1024} step={128} value={m} onChange={(e) => setM(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="사영 비의 분포">
        {hist.map((c, i) => <rect key={i} x={L + i * bw + 1} y={T + (H - T - B) * (1 - c / hmax)} width={bw - 2} height={(H - T - B) * (c / hmax)} fill="var(--w-b1)" />)}
        <line x1={X(128)} x2={X(128)} y1={T} y2={H - B} stroke="var(--w-good)" strokeDasharray="5 4" strokeWidth={2} />
        <text x={X(128) + 4} y={T + 12} fontSize="12" fill="var(--w-good)">기댓값 128</text>
        <line x1={X(30)} x2={X(30)} y1={T} y2={H - B} stroke="var(--w-bad)" strokeDasharray="5 4" strokeWidth={2} />
        <text x={X(30) + 4} y={T + 12} fontSize="12" fill="var(--w-bad)">30</text>
        {[0, 64, 128, 192, 256].map((t) => <text key={t} x={X(t)} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-muted)">{t}</text>)}
      </svg>
      <div className="stats">
        <div className="stat"><span>평균 ‖Πw‖² / ‖w‖²</span><b>{mean.toFixed(1)}</b></div>
        <div className="stat"><span>최솟값 (300 번 중)</span><b className={mn > 30 ? 'good' : 'bad'}>{mn.toFixed(1)}</b></div>
        <div className="stat"><span>전송량: 원래 · 사영</span><b>{m} 개 수 · 256 개 수</b></div>
      </div>
      <p className="note">각 행의 내적은 분산이 ‖w‖²/2 인 합이라 256 행을 더하면 평균 128‖w‖² 이고, 아래쪽으로 크게 벗어날 확률이 지수적으로 작습니다. 그래서 증명자가 (마스크를 씌운) Πw 를 보내고 검증자가 그 길이를 확인하면, "‖w‖ 도 짧다"를 작은 여유로 확신할 수 있습니다. Lyubashevsky–Nguyen–Plançon(2022)은 이런 사영으로 근사 ℓ₂ 노름 증명을 만들었고(경계 상수와 건전성 오차는 논문 참조), 비밀의 길이 m 과 무관하게 256 개의 수만 보내면 되어 증명이 짧아집니다. 몇 좌표에 몰린 w 로 바꿔도 분포가 비슷하게 모입니다. 사영은 w 의 모양과 거의 무관하게 길이를 보존하고, 행 하나의 분산은 ‖w‖⁴/2 − (Σwⱼ⁴)/4 라 오히려 몰린 쪽이 조금 덜 퍼집니다.</p>
    </div>
  );
}
