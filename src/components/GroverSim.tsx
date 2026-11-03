import { useMemo, useState } from 'react';
import { groverAmplitudes, groverOptimal, groverSuccess } from '../lib/quantum';

/**
 * 그로버 진폭 증폭: 오라클(표시된 원소 부호 뒤집기) + 확산(평균에 대해 뒤집기)을 반복하면
 * 표시된 원소의 진폭이 커진다. 최적 횟수 ≈ (π/4)√(N/M) 를 넘기면 다시 줄어든다.
 */
export default function GroverSim() {
  const [N, setN] = useState(64);
  const [M, setM] = useState(1);
  const [k, setK] = useState(0);
  const marked = useMemo(() => new Set(Array.from({ length: M }, (_, i) => (i * 37 + 11) % N)), [N, M]);
  const amps = useMemo(() => groverAmplitudes(N, marked, k), [N, marked, k]);
  const opt = groverOptimal(N, M);
  const kmax = Math.max(4, 2 * opt + 2);
  const p = groverSuccess(N, M, k);

  const W = 620, H = 150, L = 10, R = 10, mid = 88;
  const show = Math.min(N, 64);
  const idx = N <= 64 ? Array.from({ length: N }, (_, i) => i) : [...marked, ...Array.from({ length: show - M }, (_, i) => (i * 13 + 1) % N).filter((i) => !marked.has(i))].slice(0, show).sort((a, b) => a - b);
  const bw = (W - L - R) / show;
  const sc = 70;

  const W2 = 620, H2 = 120;
  const X2 = (t: number) => L + ((W2 - L - R) * t) / kmax;
  const Y2 = (v: number) => 10 + (H2 - 30) * (1 - v);

  return (
    <div className="widget not-content">
      <h4>그로버 진폭 증폭</h4>
      <p className="widget-sub">처음엔 N 개 원소가 모두 진폭 1/√N. 한 번 반복할 때마다 ① 오라클이 정답(주황)의 부호를 뒤집고 ② 확산이 모든 진폭을 평균에 대해 뒤집습니다. 측정하면 진폭의 제곱 확률로 결과가 나옵니다.</p>
      <div className="controls">
        <label className="slider">탐색 공간 N <b>{N}</b>
          <select value={N} onChange={(e) => { setN(+e.target.value); setK(0); }}>{[16, 64, 256, 1024, 4096].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label>
        <label className="slider">정답 개수 M <b>{M}</b>
          <input type="range" min={1} max={4} value={M} onChange={(e) => { setM(+e.target.value); setK(0); }} />
        </label>
        <label className="slider">반복 횟수 k <b>{k}</b> (최적 ≈ {opt})
          <input type="range" min={0} max={kmax} value={k} onChange={(e) => setK(+e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button className="primary" onClick={() => setK((x) => Math.min(kmax, x + 1))}>한 번 반복</button>
        <button onClick={() => setK(opt)}>최적 횟수로</button>
        <button onClick={() => setK(0)}>처음으로</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="진폭 막대">
        <line x1={L} x2={W - R} y1={mid} y2={mid} stroke="var(--w-grid)" />
        {idx.map((i, j) => {
          const v = amps[i];
          const h = Math.min(mid - 6, Math.abs(v) * sc * Math.sqrt(Math.min(N, 64) / 16));
          return <rect key={i} x={L + j * bw} y={v >= 0 ? mid - h : mid} width={Math.max(1, bw - 1)} height={Math.max(0.5, h)} fill={marked.has(i) ? 'var(--w-b2)' : 'var(--w-b1)'} opacity={0.85} />;
        })}
        <text x={L} y={H - 4} fontSize="10" fill="var(--w-muted)">{N <= 64 ? `원소 0 … ${N - 1}` : `N 개 중 ${show}개만 표시 (정답 포함)`}</text>
      </svg>
      <svg viewBox={`0 0 ${W2} ${H2}`} role="img" aria-label="반복 횟수에 따른 성공 확률">
        <line x1={L} x2={W2 - R} y1={Y2(0)} y2={Y2(0)} stroke="var(--w-grid)" />
        <line x1={L} x2={W2 - R} y1={Y2(1)} y2={Y2(1)} stroke="var(--w-grid)" />
        <path d={Array.from({ length: kmax * 4 + 1 }, (_, i) => i / 4).map((t, i) => `${i ? 'L' : 'M'}${X2(t).toFixed(1)},${Y2(Math.sin((2 * t + 1) * Math.asin(Math.sqrt(M / N))) ** 2).toFixed(1)}`).join(' ')} fill="none" stroke="var(--w-muted)" strokeDasharray="3 3" />
        {Array.from({ length: kmax + 1 }, (_, t) => <circle key={t} cx={X2(t)} cy={Y2(groverSuccess(N, M, t))} r={t === k ? 5 : 2.5} fill={t === k ? 'var(--w-b2)' : 'var(--w-b1)'} />)}
        <line x1={X2(opt)} x2={X2(opt)} y1={8} y2={H2 - 20} stroke="var(--w-good)" strokeDasharray="4 3" />
        <text x={L} y={H2 - 4} fontSize="10" fill="var(--w-muted)">k = 0</text>
        <text x={W2 - R} y={H2 - 4} fontSize="10" textAnchor="end" fill="var(--w-muted)">k = {kmax}</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>정답을 측정할 확률</span><b className={p > 0.9 ? 'good' : ''}>{(p * 100).toFixed(1)}%</b></div>
        <div className="stat"><span>최적 반복 ⌊π/(4θ)⌋</span><b>{opt}</b></div>
        <div className="stat"><span>고전 전수조사 기대 횟수 ≈ N/(2M)</span><b>{Math.round(N / (2 * M))}</b></div>
        <div className="stat"><span>정답 진폭 / 오답 진폭</span><b>{amps[[...marked][0]].toFixed(3)} / {amps[[...Array(N).keys()].find((i) => !marked.has(i))!].toFixed(3)}</b></div>
      </div>
      <p className="note">반복을 최적 횟수보다 더 하면 진폭이 ‘지나쳐’ 성공 확률이 다시 떨어집니다. 그로버는 마법의 병렬 탐색이 아니라 √N 번에 걸친 정교한 회전입니다.</p>
    </div>
  );
}
