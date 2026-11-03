import { useMemo, useState } from 'react';
import { PRESETS, primalSides, primalUSVP } from '../lib/estimator';
import { deltaBeta } from '../lib/bkz';

const KEYS = ['ML-KEM-512', 'ML-KEM-768', 'ML-KEM-1024'] as const;

/**
 * primal 공격의 성공 조건을 그림으로: BKZ-β 후 GSA 프로파일의 β 번째 끝 ‖b*_{d−β+1}‖ 이
 * 숨은 벡터의 사영 길이 σ√β 보다 길면, 마지막 블록의 SVP 가 숨은 벡터를 찾아낸다.
 */
export default function PrimalCondition() {
  const [key, setKey] = useState<(typeof KEYS)[number]>('ML-KEM-512');
  const P = PRESETS[key];
  const opt = useMemo(() => primalUSVP(P)!, [key]);
  const [m, setM] = useState(opt.m);
  const [beta, setBeta] = useState(350);
  const mm = Math.min(m, P.mMax);
  const s = primalSides(P, mm, beta);
  const d = s.d;
  const bmin = useMemo(() => { for (let b = 50; b <= d; b++) { const t = primalSides(P, mm, b); if (t.lhs <= t.rhs) return b; } return null; }, [key, mm, d]);
  const ok = s.lhs <= s.rhs;
  const ld = Math.log2(deltaBeta(beta));
  const prof = (i: number) => s.logVolPerDim + (d + 1 - 2 * i) * ld;           // log₂‖b_i*‖ (GSA)
  const W = 640, H = 240, L = 40, R = 10, T = 10, B = 24;
  const ymax = Math.ceil(Math.max(prof(1), s.lhs) + 0.5), ymin = Math.floor(Math.min(prof(d), s.lhs) - 0.5);
  const X = (i: number) => L + ((W - L - R) * (i - 1)) / (d - 1);
  const Y = (v: number) => T + ((H - T - B) * (ymax - v)) / (ymax - ymin);
  const k0 = d - beta + 1;
  return (
    <div className="widget not-content">
      <h4>primal 공격의 성공 조건: 선이 점 위로 올라가는가</h4>
      <p className="widget-sub">임베딩 격자(차원 d = m + n + 1)를 BKZ-β 로 축소하면 GSO 가 직선(주황, GSA)으로 떨어진다고 봅니다. 숨은 짧은 벡터 (e, s, 1) 을 마지막 β 개 방향으로 사영한 길이는 약 σ√β (파랑). 위치 d − β + 1 에서 <b>주황 선이 파랑 위에 있으면</b> 마지막 블록의 SVP 가 숨은 벡터를 찾습니다.</p>
      <div className="row">
        {KEYS.map((k) => <button key={k} className={key === k ? 'primary' : ''} onClick={() => { setKey(k); const o = primalUSVP(PRESETS[k])!; setM(o.m); }}>{k}</button>)}
      </div>
      <div className="controls">
        <label className="slider">사용하는 표본 수 m <b>{mm}</b>
          <input type="range" min={Math.floor(P.n / 4)} max={P.mMax} step={8} value={mm} onChange={(e) => setM(+e.target.value)} />
        </label>
        <label className="slider">블록 크기 β <b>{beta}</b>
          <input type="range" min={50} max={Math.min(d, 1000)} step={1} value={Math.min(beta, d)} onChange={(e) => setBeta(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="GSA 프로파일과 숨은 벡터의 사영">
        {Array.from({ length: ymax - ymin + 1 }, (_, i) => ymin + i).filter((t) => t % 2 === 0).map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">{t}</text></g>)}
        <rect x={X(k0)} y={T} width={X(d) - X(k0)} height={H - T - B} fill="var(--w-fill)" />
        <line x1={X(1)} y1={Y(prof(1))} x2={X(d)} y2={Y(prof(d))} stroke="var(--w-b2)" strokeWidth={2.5} />
        <line x1={X(k0)} x2={X(d)} y1={Y(s.lhs)} y2={Y(s.lhs)} stroke="var(--w-b1)" strokeWidth={2.5} />
        <circle cx={X(k0)} cy={Y(prof(k0))} r={5} fill={ok ? 'var(--w-good)' : 'var(--w-bad)'} />
        <text x={X(k0) - 4} y={T + 14} fontSize="12" textAnchor="end" fill="var(--w-muted)">d − β + 1</text>
        <text x={W - R} y={H - 6} fontSize="12" textAnchor="end" fill="var(--w-muted)">i → d = {d}</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>log₂ σ√β (숨은 벡터 사영)</span><b>{s.lhs.toFixed(2)}</b></div>
        <div className="stat"><span>log₂ ‖b*_(d−β+1)‖ (GSA)</span><b>{s.rhs.toFixed(2)}</b></div>
        <div className="stat"><span>판정</span><b className={ok ? 'good' : 'bad'}>{ok ? '성공: 숨은 벡터가 드러남' : '실패: β 가 모자람'}</b></div>
        <div className="stat"><span>이 m 의 최소 β · 최적 (β, m)</span><b>{bmin ?? '—'} · ({opt.beta}, {opt.m}) → 2^{(0.292 * opt.beta).toFixed(1)}</b></div>
      </div>
      <p className="note">m 을 줄이면 차원은 작아지지만 부피(q^m)가 줄어 선이 내려가고, m 을 늘리면 그 반대입니다. 그래서 공격자는 표본을 <b>다 쓰지 않는</b> 최적의 m 을 고릅니다. ML-KEM-512 에서 최적 β ≈ 406 이고, core-SVP 0.292β ≈ 118.6 비트는 Kyber 명세의 118 과 맞습니다. 공식 δ_β 는 β ≥ 50 에서만 씁니다.</p>
    </div>
  );
}
