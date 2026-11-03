import { useMemo, useState } from 'react';
import { gaussianSample, logBallVolume } from '../lib/prob';
import { mulberry32 } from '../lib/lwe';

const NS = [1, 2, 3, 5, 10, 30, 100, 300, 1000];
const SAMPLES = 2000;

/**
 * 고차원의 두 가지 ‘이상한’ 사실:
 * (1) 표준정규 벡터 x ∈ ℝⁿ 의 길이는 거의 정확히 √n 에 몰린다.
 * (2) 단위 공의 부피 V_n 은 n ≈ 5 에서 최대가 된 뒤 0 으로 급격히 줄어든다.
 */
export default function HighDim() {
  const [ni, setNi] = useState(6);
  const n = NS[ni];
  const norms = useMemo(() => {
    const rng = mulberry32(1234 + n);
    return Array.from({ length: SAMPLES }, () => {
      let s = 0;
      for (let i = 0; i < n; i++) s += gaussianSample(rng) ** 2;
      return Math.sqrt(s / n);
    });
  }, [n]);
  const m = norms.reduce((a, b) => a + b, 0) / SAMPLES;
  const sd = Math.sqrt(norms.reduce((a, b) => a + (b - m) ** 2, 0) / SAMPLES);

  const W = 620, H = 170, L = 10, R = 10, BIN = 60, XMAX = 2.5;
  const hist = new Array(BIN).fill(0);
  norms.forEach((v) => { const b = Math.min(BIN - 1, Math.floor((v / XMAX) * BIN)); hist[b]++; });
  const hmax = Math.max(...hist);
  const bw = (W - L - R) / BIN;

  const W2 = 620, H2 = 160;
  const vs = Array.from({ length: 40 }, (_, i) => ({ d: i + 1, v: Math.exp(logBallVolume(i + 1)) }));
  const vmax = Math.max(...vs.map((x) => x.v));

  return (
    <div className="widget not-content">
      <h4>고차원 기하의 직관 깨기</h4>
      <p className="widget-sub">표준정규 벡터 {SAMPLES}개의 길이를 √n 으로 나눈 값의 분포. 차원 n 을 키워 보세요.</p>
      <label className="slider">차원 n <b>{n}</b>
        <input type="range" min={0} max={NS.length - 1} value={ni} onChange={(e) => setNi(+e.target.value)} />
      </label>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="길이 분포">
        {hist.map((c, i) => <rect key={i} x={L + i * bw} y={H - 22 - ((H - 40) * c) / hmax} width={bw - 1} height={((H - 40) * c) / hmax} fill="var(--w-b1)" opacity={0.8} />)}
        <line x1={L + ((W - L - R) * 1) / XMAX} x2={L + ((W - L - R) * 1) / XMAX} y1={10} y2={H - 22} stroke="var(--w-bad)" strokeDasharray="4 3" />
        {[0, 0.5, 1, 1.5, 2, 2.5].map((x) => <text key={x} x={L + ((W - L - R) * x) / XMAX} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--w-muted)">{x}</text>)}
      </svg>
      <div className="stats">
        <div className="stat"><span>평균 ‖x‖/√n</span><b>{m.toFixed(3)}</b></div>
        <div className="stat"><span>표준편차</span><b>{sd.toFixed(3)}</b></div>
        <div className="stat"><span>이론: 표준편차 ≈ 1/√(2n)</span><b>{(1 / Math.sqrt(2 * n)).toFixed(3)}</b></div>
      </div>
      <p className="widget-sub" style={{ marginTop: '0.75rem' }}>단위 공의 부피 V_n = π^(n/2) / Γ(n/2 + 1)</p>
      <svg viewBox={`0 0 ${W2} ${H2}`} role="img" aria-label="단위 공 부피">
        {vs.map(({ d, v }) => {
          const bwid = (W2 - 20) / vs.length;
          const h = ((H2 - 40) * v) / vmax;
          return <g key={d}><rect x={10 + (d - 1) * bwid} y={H2 - 22 - h} width={bwid - 2} height={Math.max(0.5, h)} fill={d === 5 ? 'var(--w-b2)' : 'var(--w-gs)'} opacity={0.8} />
            {(d === 1 || d % 5 === 0) && <text x={10 + (d - 0.5) * bwid} y={H2 - 6} fontSize="10" textAnchor="middle" fill="var(--w-muted)">{d}</text>}</g>;
        })}
        <text x={W2 - 10} y={16} fontSize="11" textAnchor="end" fill="var(--w-muted)">V₅ ≈ {Math.exp(logBallVolume(5)).toFixed(2)} (최대) · V₄₀ ≈ {Math.exp(logBallVolume(40)).toExponential(1)}</text>
      </svg>
      <p className="note">고차원에서 ‘무작위’ 벡터는 거의 모두 같은 길이를 가지고, 반지름 1 인 공은 거의 부피가 없습니다. 이 두 사실이 Gaussian heuristic(5절)과 격자 암호의 노이즈 분석을 떠받칩니다.</p>
    </div>
  );
}
