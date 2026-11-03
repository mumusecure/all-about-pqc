import { useMemo, useState } from 'react';
import {
  type PMF, convolvePower, gaussianTailApprox, hoeffdingBound, pmfBit, pmfCBD, pmfProduct, pmfTernary, tailAbs, variance,
} from '../lib/prob';

const dists: Record<string, { label: string; make: () => PMF; range: [number, number] }> = {
  cbd2: { label: 'CBD₂ (ML-KEM 의 노이즈)', make: () => pmfCBD(2), range: [-2, 2] },
  cbd3: { label: 'CBD₃', make: () => pmfCBD(3), range: [-3, 3] },
  ter: { label: '{−1, 0, 1} 균등', make: pmfTernary, range: [-1, 1] },
  regev: { label: 'e·r  (e ← CBD₂, r ← {0,1}) · Regev', make: () => pmfProduct(pmfCBD(2), pmfBit()), range: [-2, 2] },
  prod: { label: 'e·s  (e, s ← CBD₂) · ML-KEM', make: () => pmfProduct(pmfCBD(2), pmfCBD(2)), range: [-4, 4] },
};
const KS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
const fmtP = (x: number) => (x === 0 ? '< 2^-1074 (부동소수점 한계)' : x < 1e-3 ? `2^${Math.log2(x).toFixed(1)}` : x.toFixed(4));

/**
 * 작은 노이즈 k 개를 더한 합 S 의 분포를 합성곱으로 '정확히' 계산하고,
 * 가우시안 근사·Hoeffding 상한과 꼬리 확률을 비교한다.
 */
export default function NoiseSum() {
  const [key, setKey] = useState('regev');
  const [ki, setKi] = useState(6);
  const [tFrac, setTFrac] = useState(0.5);
  const k = KS[ki];
  const D = dists[key];

  const S = useMemo(() => convolvePower(D.make(), k), [key, k]);
  const sigma = Math.sqrt(variance(S));
  const maxAbs = Math.max(Math.abs(S.min), Math.abs(S.min + S.p.length - 1));
  const t = Math.max(0.5, tFrac * maxAbs);

  const exact = tailAbs(S, t);
  const approx = gaussianTailApprox(t, sigma);
  const hoef = hoeffdingBound(t, k, D.range[0], D.range[1]);

  // 위: 분포(선형) — 중심 ±4.5σ 만
  const W = 620, H = 170, L = 10, R = 10;
  const span = Math.min(maxAbs, Math.max(4, Math.ceil(4.5 * sigma)));
  const X = (v: number) => L + ((W - L - R) * (v + span)) / (2 * span);
  const pmax = Math.max(...S.p);
  const Y = (p: number) => H - 20 - ((H - 40) * p) / pmax;
  const bars = S.p.map((p, i) => ({ v: S.min + i, p })).filter((b) => Math.abs(b.v) <= span);
  const bw = Math.max(1, (W - L - R) / (2 * span + 1) - 0.5);
  const curve = Array.from({ length: 121 }, (_, j) => -span + (2 * span * j) / 120)
    .map((v) => [X(v), Y(Math.exp((-v * v) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI)))]);

  // 아래: log₂ 꼬리 곡선
  const H2 = 210, T = 14, Bm = 26;
  const ts = Array.from({ length: 80 }, (_, j) => ((j + 1) / 80) * maxAbs);
  const ex = ts.map((x) => tailAbs(S, x));
  const lg = (x: number) => (x > 0 ? Math.log2(x) : -Infinity);
  const floor = Math.max(-1000, Math.min(-20, ...ex.filter((x) => x > 0).map(lg)) - 5);
  const Y2 = (l: number) => T + ((H2 - T - Bm) * (0 - Math.max(l, floor))) / (0 - floor);
  const X2 = (x: number) => L + 30 + ((W - L - R - 30) * x) / maxAbs;
  const path = (f: (x: number) => number) => ts.map((x, j) => `${j ? 'L' : 'M'}${X2(x).toFixed(1)},${Y2(lg(f(x))).toFixed(1)}`).join(' ');

  return (
    <div className="widget not-content">
      <h4>작은 노이즈를 많이 더하면?</h4>
      <p className="widget-sub">분포를 합성곱으로 <b>정확히</b> 계산합니다(표본 추출 아님). 위: 합 S 의 분포와 같은 분산의 정규분포 곡선. 아래: 꼬리 확률 Pr[|S| &gt; t] 의 log₂.</p>
      <div className="controls">
        <label className="slider">한 항의 분포
          <select value={key} onChange={(e) => setKey(e.target.value)}>
            {Object.entries(dists).map(([k2, d]) => <option key={k2} value={k2}>{d.label}</option>)}
          </select>
        </label>
        <label className="slider">항의 개수 k <b>{k}</b>
          <input type="range" min={0} max={KS.length - 1} value={ki} onChange={(e) => setKi(+e.target.value)} />
        </label>
        <label className="slider">임계값 t <b>{t.toFixed(1)}</b> (= {(t / sigma).toFixed(1)}σ)
          <input type="range" min={0.02} max={1} step={0.01} value={tFrac} onChange={(e) => setTFrac(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="합의 분포">
        {bars.map((b) => <rect key={b.v} x={X(b.v) - bw / 2} y={Y(b.p)} width={bw} height={H - 20 - Y(b.p)} fill={Math.abs(b.v) > t ? 'var(--w-bad)' : 'var(--w-b1)'} opacity={0.75} />)}
        <path d={curve.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="none" stroke="var(--w-text)" strokeWidth={1.5} strokeDasharray="4 3" />
        <line x1={L} x2={W - R} y1={H - 20} y2={H - 20} stroke="var(--w-grid)" />
        <text x={X(0)} y={H - 5} fontSize="11" textAnchor="middle" fill="var(--w-muted)">0</text>
        <text x={X(-span)} y={H - 5} fontSize="11" fill="var(--w-muted)">−{span}</text>
        <text x={X(span)} y={H - 5} fontSize="11" textAnchor="end" fill="var(--w-muted)">{span}</text>
      </svg>
      <svg viewBox={`0 0 ${W} ${H2}`} role="img" aria-label="꼬리 확률 그래프">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const l = Math.round(floor * f);
          return <g key={f}><line x1={L + 30} x2={W - R} y1={Y2(l)} y2={Y2(l)} stroke="var(--w-grid)" /><text x={L + 26} y={Y2(l) + 4} fontSize="10" textAnchor="end" fill="var(--w-muted)">2^{l}</text></g>;
        })}
        <line x1={X2(t)} x2={X2(t)} y1={T} y2={H2 - Bm} stroke="var(--w-bad)" strokeDasharray="4 3" />
        <path d={path((x) => hoeffdingBound(x, k, D.range[0], D.range[1]))} fill="none" stroke="var(--w-good)" strokeWidth={2} />
        <path d={path((x) => gaussianTailApprox(x, sigma))} fill="none" stroke="var(--w-text)" strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={ts.map((x, j) => `${j ? 'L' : 'M'}${X2(x).toFixed(1)},${Y2(lg(ex[j])).toFixed(1)}`).join(' ')} fill="none" stroke="var(--w-b1)" strokeWidth={2.5} />
        <text x={W - R} y={H2 - 8} fontSize="11" textAnchor="end" fill="var(--w-muted)">t → {maxAbs} (최댓값)</text>
      </svg>
      <div className="row" style={{ fontSize: '0.8rem' }}>
        <span style={{ color: 'var(--w-b1)' }}>━ 정확값</span>
        <span>┄ 가우시안 근사 2e^(−t²/2σ²)</span>
        <span style={{ color: 'var(--w-good)' }}>━ Hoeffding 상한</span>
      </div>
      <div className="stats">
        <div className="stat"><span>Var(S) = k·Var(한 항)</span><b>{(sigma * sigma).toFixed(2)}</b></div>
        <div className="stat"><span>정확한 Pr[|S| &gt; t]</span><b>{fmtP(exact)}</b></div>
        <div className="stat"><span>가우시안 근사</span><b className={approx < exact ? 'bad' : ''}>{fmtP(approx)}{approx < exact ? ' (과소평가!)' : ''}</b></div>
        <div className="stat"><span>Hoeffding 상한 (항상 성립)</span><b>{fmtP(hoef)}</b></div>
      </div>
      <p className="note">k 가 커질수록 분포는 정규분포 곡선에 붙습니다(중심극한정리). 하지만 아주 먼 꼬리에서는 근사가 틀릴 수 있습니다. ‘e·r’ 을 고르고 t 를 크게 해 보세요. 실패 확률을 2⁻¹²⁸ 수준으로 보장해야 하는 암호에서는 이 차이가 중요합니다.</p>
    </div>
  );
}
