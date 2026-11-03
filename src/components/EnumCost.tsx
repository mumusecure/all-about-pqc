import { useState } from 'react';
import { deltaBeta, enumLevelsGSA, log2Sum } from '../lib/bkz';

type Pre = 'LLL' | 'BKZ-20' | 'BKZ-β';

/**
 * Gaussian heuristic 으로 예측한 열거 트리의 레벨별 노드 수 (GSA 기저, 반지름 = GH).
 * 기저가 좋을수록(δ 작을수록) 트리가 작아진다. 체(2^{0.292n})와 비교.
 */
export default function EnumCost() {
  const [n, setN] = useState(100);
  const [pre, setPre] = useState<Pre>('BKZ-20');
  const [bp, setBp] = useState(60);
  const delta = pre === 'LLL' ? 1.0219 : pre === 'BKZ-20' ? 1.0128 : deltaBeta(Math.max(50, bp));
  const lv = enumLevelsGSA(n, delta);
  const total = log2Sum(lv), peak = lv.indexOf(Math.max(...lv)) + 1;
  const sieve = 0.292 * n;
  const W = 620, H = 220, L = 40, R = 10, T = 10, B = 24;
  const ymax = Math.max(20, Math.ceil(Math.max(...lv, sieve) / 20) * 20), ymin = 0;
  const X = (k: number) => L + ((W - L - R) * (k - 1)) / (n - 1);
  const Y = (v: number) => T + ((H - T - B) * (ymax - Math.max(ymin, v))) / (ymax - ymin);
  const path = lv.map((v, i) => `${i ? 'L' : 'M'}${X(i + 1).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  return (
    <div className="widget not-content">
      <h4>열거 트리의 크기: 기저가 좋을수록 작다</h4>
      <p className="widget-sub">차원 n 의 격자에서 반지름 GH 안의 점을 모두 훑는 열거의 레벨별 노드 수를 Gaussian heuristic 으로 예측합니다. 레벨 k 의 노드 수 ≈ V_k(R) / ∏(마지막 k 개의 ‖bᵢ*‖) / 2. 기저 품질은 GSA 와 δ 로 둡니다.</p>
      <div className="row">
        {(['LLL', 'BKZ-20', 'BKZ-β'] as Pre[]).map((p) => <button key={p} className={pre === p ? 'primary' : ''} onClick={() => setPre(p)}>{p === 'BKZ-β' ? `BKZ-${bp} (공식)` : p} 으로 전처리</button>)}
      </div>
      <div className="controls">
        <label className="slider">차원 n <b>{n}</b>
          <input type="range" min={40} max={250} step={10} value={n} onChange={(e) => setN(+e.target.value)} />
        </label>
        {pre === 'BKZ-β' && <label className="slider">전처리 블록 크기 β <b>{bp}</b>
          <input type="range" min={50} max={Math.max(60, n)} step={5} value={Math.min(bp, n)} onChange={(e) => setBp(+e.target.value)} />
        </label>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="레벨별 노드 수">
        {Array.from({ length: ymax / 20 + 1 }, (_, i) => i * 20).map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">2^{t}</text></g>)}
        <line x1={L} x2={W - R} y1={Y(sieve)} y2={Y(sieve)} stroke="var(--w-good)" strokeDasharray="6 4" strokeWidth={2} />
        <text x={W - R} y={Y(sieve) - 5} fontSize="12" textAnchor="end" fill="var(--w-good)">체: 2^(0.292n)</text>
        <path d={path} fill="none" stroke="var(--w-b1)" strokeWidth={2.5} />
        <text x={X(peak)} y={Y(lv[peak - 1]) - 6} fontSize="12" textAnchor="middle" fill="var(--w-b1)">최대: 레벨 {peak}</text>
        <text x={W - R} y={H - 6} fontSize="12" textAnchor="end" fill="var(--w-muted)">레벨 k → {n}</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>전처리 δ</span><b>{delta.toFixed(4)}</b></div>
        <div className="stat"><span>열거 총 노드 수</span><b>2^{total.toFixed(1)}</b></div>
        <div className="stat"><span>체 (시간 / 메모리)</span><b>2^{sieve.toFixed(1)} / 2^{(0.2075 * n).toFixed(1)}</b></div>
        <div className="stat"><span>더 싼 쪽</span><b>{total < sieve ? '열거' : '체'}</b></div>
      </div>
      <p className="note">노드 수는 가운데 레벨(약 n/2)에서 최대가 되는 종 모양입니다. 열거는 메모리가 거의 들지 않지만 비용이 2^Θ(n log n) 로 커지고, 체는 2^(0.292n) 시간에 2^(0.2075n) 메모리가 듭니다. 이 단순 모델은 상수와 가지치기(pruning)를 무시하므로, 실제 교차점은 이보다 낮은 차원에서 나타납니다. 체는 2018년 무렵부터 실험에서도 열거를 앞질렀습니다(G6K). 공식 전처리는 β ≥ 50 에서만 씁니다.</p>
    </div>
  );
}
