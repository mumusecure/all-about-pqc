import { useState } from 'react';
import { gaussSieve, log2GH, logVolume2, norm2, qaryLattice } from '../lib/bkz';
import { lll } from '../lib/lattice';

interface Run { n: number; list: number; maxList: number; it: number; norm: number; gh: number; lllb1: number; trace: number[]; ms: number; }

/**
 * Gauss sieve 를 실제로 돌려 목록 크기가 차원에 따라 어떻게 커지는지 본다.
 * 목록의 두 벡터는 서로 60° 이상 떨어져 있어야 하므로 크기가 약 (4/3)^{n/2} 에 비례한다.
 */
export default function SieveToy() {
  const [n, setN] = useState(24);
  const [seed, setSeed] = useState(1);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const B0 = qaryLattice(n, 1009, seed);
      const t = performance.now();
      const s = gaussSieve(B0, 400, seed);
      const ms = performance.now() - t;
      const L = lll(B0, 0.99).basis;
      setRuns((r) => [...r.filter((x) => x.n !== n), { n, list: s.listSize, maxList: s.maxList, it: s.iterations, norm: Math.sqrt(s.norm2), gh: 2 ** log2GH(n, logVolume2(B0)), lllb1: Math.sqrt(norm2(L[0])), trace: s.trace, ms }].sort((a, b) => a.n - b.n));
      setBusy(false);
    }, 20);
  };
  const last = runs.find((r) => r.n === n);
  const W = 620, H = 200, L = 46, R = 10, T = 10, B = 26;
  const nmin = 16, nmax = 34;
  const X = (v: number) => L + ((W - L - R) * (v - nmin)) / (nmax - nmin);
  const ymax = 10, Y = (v: number) => T + ((H - T - B) * (ymax - v)) / ymax;
  return (
    <div className="widget not-content">
      <h4>Gauss sieve: 목록은 얼마나 커지나</h4>
      <p className="widget-sub">격자 벡터를 계속 뽑아 목록의 벡터들로 줄이고(‖v ± w‖ &lt; ‖v‖ 이면 교체), 목록끼리도 서로 줄입니다. 0 으로 줄어든 표본(충돌)이 400 번 나오면 멈춥니다. 차원을 바꿔 가며 돌려 보세요.</p>
      <div className="controls">
        <label className="slider">차원 n <b>{n}</b>
          <input type="range" min={16} max={34} step={2} value={n} onChange={(e) => setN(+e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button className="primary" disabled={busy} onClick={go}>{busy ? '체 치는 중…' : `n = ${n} 에서 체 돌리기`}</button>
        <button disabled={busy} onClick={() => { setSeed((s) => s + 1); setRuns([]); }}>새 격자</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="차원별 목록 크기 (log₂)">
        {[0, 2, 4, 6, 8, 10].map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">2^{t}</text></g>)}
        <line x1={X(nmin)} y1={Y(0.2075 * nmin)} x2={X(nmax)} y2={Y(0.2075 * nmax)} stroke="var(--w-good)" strokeDasharray="6 4" strokeWidth={2} />
        <text x={X(nmax)} y={Y(0.2075 * nmax) + 16} fontSize="12" textAnchor="end" fill="var(--w-good)">(4/3)^(n/2) = 2^(0.2075n)</text>
        {runs.map((r) => <circle key={r.n} cx={X(r.n)} cy={Y(Math.log2(r.maxList))} r={5} fill="var(--w-b1)" />)}
        {[16, 20, 24, 28, 32].map((v) => <text key={v} x={X(v)} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-muted)">{v}</text>)}
      </svg>
      <div className="stats">
        <div className="stat"><span>최대 목록 크기 (n = {n})</span><b>{last ? `${last.maxList} ≈ 2^${Math.log2(last.maxList).toFixed(1)}` : '—'}</b></div>
        <div className="stat"><span>찾은 가장 짧은 벡터 / GH</span><b>{last ? `${last.norm.toFixed(1)} / ${last.gh.toFixed(1)}` : '—'}</b></div>
        <div className="stat"><span>LLL 의 ‖b₁‖</span><b>{last ? last.lllb1.toFixed(1) : '—'}</b></div>
        <div className="stat"><span>반복 · 시간</span><b>{last ? `${last.it.toLocaleString()} · ${last.ms.toFixed(0)}ms` : '—'}</b></div>
      </div>
      <p className="note">점(측정)이 초록 점선과 <b>평행하게</b> 오르면 목록 크기가 2^(0.2075n) 꼴로 큰다는 뜻입니다(상수 배는 다를 수 있음). 왜 4/3 인가: 같은 길이의 두 벡터 사이 각이 60° 보다 작으면 차가 더 짧아지므로, 줄일 것이 없는 목록은 서로 60° 이상 떨어진 벡터들이고, n 차원 구면에 그런 점을 놓을 수 있는 개수가 대략 (4/3)^(n/2) 입니다. 목록을 다 비교하면 시간은 그 제곱(2^0.415n)이고, 근접 이웃 탐색으로 2^0.292n 까지 줄인 것이 현재 최선입니다.</p>
    </div>
  );
}
