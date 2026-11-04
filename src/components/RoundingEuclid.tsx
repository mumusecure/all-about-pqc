import { useMemo, useState } from 'react';
import { roundingNormStats } from '../lib/modules';
import { mulberry32 } from '../lib/lwe';

const NS = [1, 2, 4, 8, 16, 32, 64, 128];

/**
 * 가우스·LLL 의 크기 축소는 "몫을 반올림하면 나머지가 작아진다"에 기댄다(ℤ 에서는 |나머지| ≤ 1/2).
 * R = ℤ[x]/(xⁿ+1) 에서 μ ∈ K 를 계수마다 반올림한 오차 e 의 노름 |N(e)| 이 1 보다 작을 확률.
 */
export default function RoundingEuclid() {
  const [seed, setSeed] = useState(1);
  const stats = useMemo(() => NS.map((n) => ({ n, ...roundingNormStats(n, 3000, mulberry32(seed * 31 + n)) })), [seed]);
  const W = 620, H = 200, L = 46, R = 10, T = 10, B = 26;
  const bw = (W - L - R) / NS.length;
  const Y = (f: number) => T + (H - T - B) * (1 - f);
  return (
    <div className="widget not-content">
      <h4>반올림은 언제까지 통하나: 노름 유클리드성</h4>
      <p className="widget-sub">ℤ 에서 가우스 축소가 끝나는 이유는 몫 μ 를 반올림한 나머지가 |μ − ⌊μ⌉| ≤ 1/2 &lt; 1 이라 매번 크기가 줄기 때문입니다. R 에서 같은 일을 하려면 반올림 오차 e = μ − ⌊μ⌉ 의 <b>노름</b> |N(e)| 이 1 보다 작아야 합니다. 무작위 μ 3000 개로 그 비율을 잽니다(계수마다 반올림).</p>
      <div className="row"><button onClick={() => setSeed((s) => s + 1)}>다시 뽑기</button></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="차수별 |N(e)| < 1 비율">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">{(t * 100).toFixed(0)}%</text></g>)}
        {stats.map((s, i) => <g key={s.n}>
          <rect x={L + i * bw + bw * 0.15} y={Y(s.frac)} width={bw * 0.7} height={Y(0) - Y(s.frac)} fill={s.frac > 0.9 ? 'var(--w-good)' : s.frac > 0.1 ? 'var(--w-b2)' : 'var(--w-bad)'} />
          <text x={L + i * bw + bw / 2} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-muted)">n = {s.n}</text>
          <text x={L + i * bw + bw / 2} y={Math.max(T + 12, Y(s.frac) - 4)} fontSize="12" textAnchor="middle" fill="var(--w-text)">{(s.frac * 100).toFixed(0)}%</text>
        </g>)}
      </svg>
      <div className="stats">
        {stats.filter((s) => [8, 16, 32, 64].includes(s.n)).map((s) => <div className="stat" key={s.n}><span>n = {s.n}: log₂|N(e)| 중앙값</span><b>{s.median.toFixed(1)}</b></div>)}
      </div>
      <p className="note">n ≤ 8 에서는 거의 항상 통하고, n = 16 에서 약 3/4, n = 32 에서 몇 %, n = 64 이상에서는 사실상 0 입니다. 오차의 각 임베딩 크기가 대략 √(n/12) 라서 그 n 개의 곱이 금방 1 을 넘기 때문입니다. 계수 반올림 대신 가장 가까운 R 의 원소(CVP)를 골라도 사정은 크게 나아지지 않습니다. 노름 유클리드성이 증명된 원분체는 차수가 작은 것들뿐이고, 차수가 크면 성립하지 않을 것으로 예상됩니다. 그래서 ML-KEM 의 n = 256 에서 "R 위의 LLL" 은 단순한 일반화로 되지 않고, 단원으로 모양을 맞추고 랭크 2 의 축소를 더 강한 오라클에 맡기는 장치가 필요합니다.</p>
    </div>
  );
}
