import { useMemo, useState } from 'react';
import { combined, zshape } from '../lib/dvw';
import { qStarDvW } from '../lib/fatigue';

/**
 * 논문 읽기 5: DvW 예측기(이 교과서의 TS 이식, src/lib/dvw.ts).
 * 진행형 BKZ(β = 2, 3, …, 각 8 투어)에서 SKR 과 DSD 중 무엇이 먼저 일어나는지, 그리고 어느 위치 κ 에서 일어나는지.
 */
const NS = [64, 128, 256, 512];
const RANGE: Record<number, [number, number]> = { 64: [5, 12], 128: [7, 14], 256: [8, 16], 512: [10, 19] };

export default function DvWEstimator() {
  const [n, setN] = useState(128);
  const [lq, setLq] = useState(9.5);
  const [wide, setWide] = useState(false);
  const [kind, setKind] = useState<'circulant' | 'matrix'>('circulant');
  const [lo, hi] = RANGE[n];
  const lqc = Math.min(hi + (wide ? 5 : 0), Math.max(lo, lq));
  const s2 = wide ? 16 : 2 / 3;
  const r = useMemo(() => combined(Math.pow(2, lqc), n, s2, kind, 8), [n, lqc, s2, kind]);
  const prof = useMemo(() => zshape(Math.pow(2, lqc), n, Math.max(2, Math.round(r.avgBeta))).map((x) => x / Math.LN2), [n, lqc, r.avgBeta]);
  const d = 2 * n, W = 380, H1 = 120, H2 = 70, L = 34, T = 8, gap = 18;
  const X = (i: number) => L + ((W - L - 10) * i) / (d - 1);
  const Y1 = (v: number) => T + (H1 - T) * (1 - v / Math.max(lqc, 1));
  const pmax = Math.max(1e-9, ...r.posSKR, ...r.posDSD);
  const Y2 = (p: number) => H1 + gap + H2 * (1 - p / pmax);
  const bw = Math.max(1, (W - L - 10) / d);
  const line = prof.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y1(v).toFixed(1)}`).join(' ');
  const kappaMean = (pos: Float64Array) => { let s = 0, w = 0; pos.forEach((p, i) => { s += p * i; w += p; }); return w > 1e-9 ? s / w : null; };
  const kS = kappaMean(r.posSKR), kD = kappaMean(r.posDSD);
  const sliderMax = hi + (wide ? 5 : 0);
  return (
    <div className="widget not-content">
      <h4>DvW 예측기: 무엇이, 어디서 먼저 일어나나</h4>
      <p className="widget-sub">Ducas–van Woerden 의 공개 예측기(estimator.sage)를 이 교과서가 TypeScript 로 옮긴 것입니다. 진행형 BKZ(β = 2, 3, …, 각 8 투어)에서 SKR(키 하나의 사영이 마지막 블록에서 짧아짐)과 DSD(앞쪽 기저와 키 부분격자의 교집합에 있는 짧은 벡터가 가운데 블록에서 먼저 보임) 중 무엇이 먼저 일어날지 확률로 계산합니다. 위: 그때 β 의 Z 모양 프로파일 log₂‖bᵢ*‖. 아래: 사건이 일어나는 위치 κ 의 분포(파랑 = SKR, 주황 = DSD).</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {NS.map((x) => <button key={x} className={n === x ? 'primary' : ''} onClick={() => { setN(x); setLq((RANGE[x][0] + RANGE[x][1]) / 2); }}>n = {x}</button>)}
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className={!wide ? 'primary' : ''} onClick={() => setWide(false)}>삼진 (σ² = 2/3)</button>
        <button className={wide ? 'primary' : ''} onClick={() => setWide(true)}>넓은 비밀 (σ² = 16)</button>
        <button className={kind === 'circulant' ? 'primary' : ''} onClick={() => setKind('circulant')}>환 NTRU</button>
        <button className={kind === 'matrix' ? 'primary' : ''} onClick={() => setKind('matrix')}>행렬 NTRU</button>
      </div>
      <div className="controls">
        <label className="slider">log₂ q <b>{lqc.toFixed(1)}</b><input type="range" min={lo} max={sliderMax} step={0.1} value={lqc} onChange={(e) => setLq(+e.target.value)} /></label>
      </div>
      <svg viewBox={`0 0 ${W} ${H1 + gap + H2 + 18}`} style={{ maxWidth: 560 }} role="img" aria-label="Z 모양 프로파일과 사건 위치의 분포">
        <line x1={L} y1={H1} x2={W - 10} y2={H1} stroke="var(--w-border)" />
        <line x1={L} y1={T} x2={L} y2={H1} stroke="var(--w-border)" />
        <text x={L - 4} y={Y1(lqc) + 3} fontSize="10" textAnchor="end" fill="var(--w-muted)">{lqc.toFixed(0)}</text>
        <text x={L - 4} y={H1 + 3} fontSize="10" textAnchor="end" fill="var(--w-muted)">0</text>
        <path d={line} fill="none" stroke="var(--w-gs)" strokeWidth={2} />
        <line x1={X(n)} x2={X(n)} y1={T} y2={H1 + gap + H2} stroke="var(--w-border)" strokeDasharray="2 3" />
        <line x1={L} y1={H1 + gap + H2} x2={W - 10} y2={H1 + gap + H2} stroke="var(--w-border)" />
        {Array.from(r.posSKR).map((p, i) => (p > pmax * 1e-3 ? <rect key={`s${i}`} x={X(i) - bw / 2} y={Y2(p)} width={bw} height={H1 + gap + H2 - Y2(p)} fill="var(--w-b1)" /> : null))}
        {Array.from(r.posDSD).map((p, i) => (p > pmax * 1e-3 ? <rect key={`d${i}`} x={X(i) - bw / 2} y={Y2(p)} width={bw} height={H1 + gap + H2 - Y2(p)} fill="var(--w-b2)" opacity={0.85} /> : null))}
        <text x={X(0)} y={H1 + gap + H2 + 14} fontSize="10" fill="var(--w-muted)">κ = 0</text>
        <text x={X(n)} y={H1 + gap + H2 + 14} fontSize="10" textAnchor="middle" fill="var(--w-muted)">n</text>
        <text x={X(d - 1)} y={H1 + gap + H2 + 14} fontSize="10" textAnchor="end" fill="var(--w-muted)">2n</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>P(SKR 먼저)</span><b>{r.pSKR.toFixed(3)}</b></div>
        <div className="stat"><span>P(DSD 먼저)</span><b className={r.pDSD > 0.5 ? 'bad' : ''}>{r.pDSD.toFixed(3)}</b></div>
        <div className="stat"><span>평균 성공 β</span><b>{r.avgBeta.toFixed(1)}</b></div>
        <div className="stat"><span>평균 위치 κ (SKR / DSD)</span><b>{kS === null ? '—' : kS.toFixed(0)} / {kD === null ? '—' : kD.toFixed(0)}</b></div>
        <div className="stat"><span>맞춤식 log₂ q* (삼진)</span><b>{Math.log2(qStarDvW(n)).toFixed(1)}</b></div>
      </div>
      <p className="note">q 를 키우면 어느 지점에서 주황이 파랑을 확 밀어냅니다. 이것이 fatigue point 입니다(전환이 매우 가파릅니다). SKR 은 항상 끝 블록(κ = 2n − β − 1)에서, DSD 는 훨씬 앞쪽, 가운데(κ = n)보다 조금 앞에서 일어납니다. 넓은 비밀이나 행렬 NTRU 로 바꾸면 경계가 움직입니다. 수치는 이 교과서의 이식본으로 계산한 것이며, 원본 Sage 코드와 수치 루틴이 달라 조금 다를 수 있습니다.</p>
    </div>
  );
}
