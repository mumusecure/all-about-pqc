import { useMemo, useState } from 'react';
import { betaKF, crossingLog2q } from '../lib/kf17';
import { log2Fatigue, usvpBetaNTRU } from '../lib/ntruattack';

/**
 * 논문 읽기 4: NTRU 키 복구에 필요한 블록 크기 β 를 두 모델로 비교한다.
 *  - uSVP (18장, 숨은 벡터 하나)
 *  - Kirchner–Fouque 식 밀집 부분격자 충분조건 (src/lib/kf17.ts)
 * 그리고 Ducas–van Woerden 의 피로점(삼진 비밀)을 함께 표시한다.
 */
const NS = [256, 512, 768, 1024];
const SECRETS = [
  { key: 'tern', label: '삼진 (σ² = 2/3)', sigma: Math.sqrt(2 / 3) },
  { key: 'wide', label: '넓은 비밀 (σ = 4, Falcon 근처)', sigma: 4 },
];

export default function KFvsUSVP() {
  const [n, setN] = useState(512);
  const [sec, setSec] = useState('tern');
  const [lq, setLq] = useState(24);
  const S = SECRETS.find((x) => x.key === sec)!;
  const curve = useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const q = 10 + 2 * i;
    return { q, u: usvpBetaNTRU(n, q, S.sigma) ?? 2 * n, k: betaKF(n, q, S.sigma)?.beta ?? NaN };
  }), [n, sec]);
  const cross = useMemo(() => crossingLog2q(n, S.sigma), [n, sec]);
  const u = usvpBetaNTRU(n, lq, S.sigma), kf = betaKF(n, lq, S.sigma);
  const fat = log2Fatigue(n);
  const W = 380, H = 200, L = 40, B = 28, T = 10, bmax = Math.max(...curve.filter((c) => !isNaN(c.k)).map((c) => c.k), ...curve.map((c) => c.u)) + 20;
  const X = (q: number) => L + ((W - L - 10) * (q - 10)) / 50, Y = (b: number) => T + (H - T - B) * (1 - b / bmax);
  // 조건이 성립하지 않는 점(NaN)은 건너뛰고 선을 끊는다
  const path = (sel: (c: (typeof curve)[number]) => number) => curve.map((c, i) => {
    const v = sel(c); if (isNaN(v)) return '';
    const prev = i > 0 && !isNaN(sel(curve[i - 1]));
    return `${prev ? 'L' : 'M'}${X(c.q).toFixed(1)},${Y(Math.min(v, bmax)).toFixed(1)}`;
  }).join(' ');
  return (
    <div className="widget not-content">
      <h4>바늘 하나 대 바늘 다발: 필요한 블록 크기</h4>
      <p className="widget-sub">NTRU 격자(차원 2n, 부피 qⁿ)에서 키를 찾는 데 필요한 BKZ 블록 크기 β. 파랑 = uSVP(숨은 벡터 하나, 18장), 주황 = Kirchner–Fouque 식 밀집 부분격자 충분조건(주황 선이 없는 구간은 조건이 어떤 β 로도 성립하지 않는 곳). 두 모델 모두 δ_β 공식을 쓰므로 β ≥ 50 에서만 보고, 50 은 "50 이하"라는 뜻입니다.</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {NS.map((x) => <button key={x} className={n === x ? 'primary' : ''} onClick={() => setN(x)}>n = {x}</button>)}
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {SECRETS.map((x) => <button key={x.key} className={sec === x.key ? 'primary' : ''} onClick={() => setSec(x.key)}>{x.label}</button>)}
      </div>
      <div className="controls">
        <label className="slider">log₂ q <b>{lq}</b><input type="range" min={10} max={60} value={lq} onChange={(e) => setLq(+e.target.value)} /></label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 560 }} role="img" aria-label="log q 에 따른 필요한 블록 크기">
        <line x1={L} y1={H - B} x2={W - 10} y2={H - B} stroke="var(--w-border)" />
        <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--w-border)" />
        {[10, 20, 30, 40, 50, 60].map((q) => <text key={q} x={X(q)} y={H - B + 14} fontSize="10" textAnchor="middle" fill="var(--w-muted)">{q}</text>)}
        {[0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000].filter((b) => b < bmax).map((b) => <text key={b} x={L - 4} y={Y(b) + 3} fontSize="10" textAnchor="end" fill="var(--w-muted)">{b}</text>)}
        {sec === 'tern' && <g><line x1={X(fat)} x2={X(fat)} y1={T} y2={H - B} stroke="var(--w-good)" strokeDasharray="4 3" /><text x={X(fat) + 3} y={T + 10} fontSize="10" fill="var(--w-good)">DvW 피로점</text></g>}
        {cross && <g><line x1={X(cross)} x2={X(cross)} y1={T} y2={H - B} stroke="var(--w-b2)" strokeDasharray="2 3" /><text x={X(cross) + 3} y={T + 22} fontSize="10" fill="var(--w-b2)">교차</text></g>}
        <path d={path((c) => c.u)} fill="none" stroke="var(--w-b1)" strokeWidth={2} />
        <path d={path((c) => c.k)} fill="none" stroke="var(--w-b2)" strokeWidth={2} />
        <line x1={X(lq)} x2={X(lq)} y1={T} y2={H - B} stroke="var(--w-muted)" strokeWidth={0.8} />
        <text x={(W + L) / 2} y={H - 2} fontSize="11" textAnchor="middle" fill="var(--w-muted)">log₂ q</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>uSVP β</span><b>{u ? (u <= 50 ? '≤ 50' : u) : '—'}</b></div>
        <div className="stat"><span>KF 충분조건 β (최소 k)</span><b>{kf ? `${kf.beta <= 50 ? '≤ 50' : kf.beta} (k = ${kf.k})` : '성립 안 함'}</b></div>
        <div className="stat"><span>두 모델이 같아지는 log₂ q</span><b>{cross ?? '—'}</b></div>
        <div className="stat"><span>DvW 피로점 log₂ q* (삼진)</span><b>{sec === 'tern' ? fat.toFixed(1) : '해당 없음'}</b></div>
      </div>
      <p className="note">q 가 작으면 uSVP 가 더 작은 β 를 주고(바늘 하나가 먼저), q 가 크면 밀집 부분격자 조건이 더 작은 β 를 줍니다(다발이 먼저). 이 교과서의 충분조건으로 계산한 교차점은 DvW 의 피로점보다 7~10 비트 위에 있습니다. 충분조건은 부분격자의 부피를 키 길이로 넉넉히 잡고 두 부등식을 따로 세우므로 보수적이고, 실제 경계는 DvW 의 정밀 모델이 더 잘 맞힙니다. 넓은 비밀에서는 부분격자가 덜 밀집해 교차점이 오른쪽으로 갑니다.</p>
    </div>
  );
}
