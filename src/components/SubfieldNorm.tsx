import { useMemo, useState } from 'react';
import { subfieldMargin, ternaryPoly } from '../lib/ntruattack';
import { mulberry32 } from '../lib/lwe';

/**
 * 부분체 공격: 노름 사상으로 (f, g) 를 지수 r 부분체로 내리면 차원은 2n/r 로 줄고, 키는 ‖f‖^r 정도로 커진다.
 * 실제 삼진 f, g 에 대해 N(f) 를 정확히 계산하고, 각 r 에서 '축소 여유' gap − δ^d 를 비교한다.
 */
export default function SubfieldNorm() {
  const [n, setN] = useState(1024);
  const [logq, setLogq] = useState(80);
  const [red, setRed] = useState<'LLL' | 'BKZ-20'>('LLL');
  const delta = red === 'LLL' ? 1.0219 : 1.0128;
  const fg = useMemo(() => { const r = mulberry32(n); return [ternaryPoly(n, r), ternaryPoly(n, r)]; }, [n]);
  const rows = useMemo(() => [1, 2, 4, 8, 16].filter((r) => n / r >= 8).map((r) => subfieldMargin(fg[0], fg[1], r, logq, delta)), [fg, logq, delta, n]);
  const best = rows.reduce((a, b) => (b.margin > a.margin ? b : a), rows[0]);
  const W = 620, H = 200, L = 50, R = 10, T = 10, B = 26;
  const vmax = Math.max(10, ...rows.map((r) => Math.abs(r.margin)));
  const bw = (W - L - R) / rows.length;
  const Y = (v: number) => T + ((H - T - B) / 2) * (1 - v / vmax);
  return (
    <div className="widget not-content">
      <h4>부분체 공격: 차원을 줄이는 대가</h4>
      <p className="widget-sub">K = ℚ[x]/(xⁿ+1) 에서 지수 r 부분체로 노름 N(f) = ∏σ(f) 를 내리면, 부분체의 NTRU 격자는 차원이 2n/r 로 줄지만 숨은 벡터 (N f, N g) 는 ‖f‖^r 정도로 길어집니다. 막대 = '축소 여유' log₂(gap) − d·log₂δ (양수면 그 축소로 숨은 벡터를 찾을 것으로 예상).</p>
      <div className="row">
        {[256, 512, 1024].map((v) => <button key={v} className={n === v ? 'primary' : ''} onClick={() => setN(v)}>n = {v}</button>)}
        {(['LLL', 'BKZ-20'] as const).map((v) => <button key={v} className={red === v ? 'primary' : ''} onClick={() => setRed(v)}>{v}</button>)}
      </div>
      <div className="controls">
        <label className="slider">log₂ q <b>{logq}</b>
          <input type="range" min={12} max={200} step={1} value={logq} onChange={(e) => setLogq(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="부분체 지수별 축소 여유">
        <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="var(--w-muted)" />
        <text x={L - 4} y={Y(0) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">0</text>
        {rows.map((r, i) => {
          const x = L + i * bw + bw * 0.2, w = bw * 0.6, y0 = Y(0), y1 = Y(r.margin);
          return <g key={r.r}>
            <rect x={x} y={Math.min(y0, y1)} width={w} height={Math.abs(y1 - y0)} fill={r.margin >= 0 ? 'var(--w-good)' : 'var(--w-bad)'} opacity={0.85} />
            <text x={x + w / 2} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-muted)">r = {r.r} (d = {r.d})</text>
            <text x={x + w / 2} y={r.margin >= 0 ? y1 - 4 : y0 + 14} fontSize="12" textAnchor="middle" fill={r.margin >= 0 ? 'var(--w-text)' : 'var(--w-on-accent)'}>{r.margin.toFixed(1)}</text>
          </g>;
        })}
      </svg>
      <div className="stats">
        <div className="stat"><span>가장 유리한 지수</span><b>{best.margin >= 0 ? `r = ${best.r} (차원 ${best.d})` : '없음 (모두 음수)'}</b></div>
        <div className="stat"><span>‖(f, g)‖ → ‖(N f, N g)‖ (그 r)</span><b>2^{rows[0].log2Key.toFixed(1)} → 2^{best.log2Key.toFixed(1)}</b></div>
        <div className="stat"><span>원래 격자 (r = 1) 의 여유</span><b className={rows[0].margin >= 0 ? 'good' : 'bad'}>{rows[0].margin.toFixed(1)}</b></div>
      </div>
      <p className="note">q 가 작으면 어떤 r 도 쓸모없고, q 가 아주 크면(overstretched) 적당한 r 의 부분체가 원래 격자보다 훨씬 약한 축소로 풀립니다. 다만 이 비교는 원래 격자를 "숨은 벡터 하나(uSVP)" 로만 셉니다. Kirchner–Fouque(2017)는 원래 격자에서도 밀집 부분격자 효과 덕분에 이보다 훨씬 일찍 풀린다는 것, 즉 부분체 공격이 따로 필요 없다는 것을 보였습니다. N(f) 는 실제 삼진 다항식으로 정확히 계산한 값입니다.</p>
    </div>
  );
}
