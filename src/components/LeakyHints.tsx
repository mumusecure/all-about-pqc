import { useMemo, useState } from 'react';
import { sigmaCBD } from '../lib/estimator';
import { leakyBeta } from '../lib/leaky';

/**
 * 논문 읽기 3: 비밀 좌표에 대한 힌트(완전·모듈러·근사)가 primal 공격의 β 를 얼마나 줄이는가.
 * DDGR20 의 틀을 좌표 힌트로 단순화한 모델(src/lib/leaky.ts).
 */
const SCHEMES = [
  { key: '512', label: 'ML-KEM-512', n: 512, sigma: sigmaCBD(3) },
  { key: '768', label: 'ML-KEM-768', n: 768, sigma: sigmaCBD(2) },
];
const lq = Math.log2(3329);

export default function LeakyHints() {
  const [key, setKey] = useState('512');
  const S = SCHEMES.find((s) => s.key === key)!;
  const [perfect, setPerfect] = useState(0);
  const [modular, setModular] = useState(0);
  const [modK, setModK] = useState(2);
  const [approx, setApprox] = useState(0);
  const [sigmaH, setSigmaH] = useState(1);
  const h = { perfect, modular, modK, approx, sigmaH };
  const r = useMemo(() => leakyBeta(S.n, lq, S.sigma, S.sigma, S.n, h, 8), [key, perfect, modular, modK, approx, sigmaH]);
  const base = useMemo(() => leakyBeta(S.n, lq, S.sigma, S.sigma, S.n, { perfect: 0, modular: 0, modK: 2, approx: 0, sigmaH: 1 }, 8)!.beta, [key]);
  const curve = useMemo(() => Array.from({ length: 17 }, (_, i) => {
    const k = Math.round((i * S.n) / 16);
    return { k, beta: leakyBeta(S.n, lq, S.sigma, S.sigma, S.n, { perfect: k, modular: 0, modK: 2, approx: 0, sigmaH: 1 }, 16)?.beta ?? 40 };
  }), [key]);
  const used = perfect + modular + approx;
  const W = 380, H = 190, L = 38, B = 28, T = 10;
  const X = (k: number) => L + ((W - L - 10) * k) / S.n, Y = (b: number) => T + (H - T - B) * (1 - b / (base + 20));
  const beta = r?.beta ?? 40;
  const feasible = beta <= 90;
  return (
    <div className="widget not-content">
      <h4>힌트 하나가 β 를 얼마나 깎나</h4>
      <p className="widget-sub">비밀 계수 n 개 가운데 일부에 대해 부채널·복호 실패·오라클로 얻은 정보가 있다고 하자. 완전 힌트(값을 앎), 모듈러 힌트(값 mod k 를 앎), 근사 힌트(값 + 잡음 σ_h 를 앎)를 서로 다른 좌표에 줍니다.</p>
      <div className="row">
        {SCHEMES.map((s) => <button key={s.key} className={key === s.key ? 'primary' : ''} onClick={() => { setKey(s.key); setPerfect(0); setModular(0); setApprox(0); }}>{s.label}</button>)}
      </div>
      <div className="controls">
        <label className="slider">완전 힌트 <b>{perfect}</b><input type="range" min={0} max={S.n} step={8} value={perfect} onChange={(e) => setPerfect(+e.target.value)} /></label>
        <label className="slider">모듈러 힌트 <b>{modular}</b> (mod {modK})<input type="range" min={0} max={S.n} step={8} value={modular} onChange={(e) => setModular(+e.target.value)} /></label>
        <label className="slider">모듈러 힌트의 k <b>{modK}</b><input type="range" min={2} max={8} value={modK} onChange={(e) => setModK(+e.target.value)} /></label>
        <label className="slider">근사 힌트 <b>{approx}</b><input type="range" min={0} max={S.n} step={8} value={approx} onChange={(e) => setApprox(+e.target.value)} /></label>
        <label className="slider">근사 힌트의 잡음 σ_h <b>{sigmaH.toFixed(2)}</b><input type="range" min={0.1} max={3} step={0.05} value={sigmaH} onChange={(e) => setSigmaH(+e.target.value)} /></label>
      </div>
      <div className="stats">
        <div className="stat"><span>힌트를 받은 좌표</span><b className={used > S.n ? 'bad' : ''}>{Math.min(used, S.n)} / {S.n}{used > S.n ? ' (넘친 만큼 무시)' : ''}</b></div>
        <div className="stat"><span>primal β (힌트 없음 {base})</span><b>{beta <= 40 ? '≤ 40' : beta}</b></div>
        <div className="stat"><span>core-SVP 고전 0.292β</span><b>{(0.292 * beta).toFixed(1)}</b></div>
        <div className="stat"><span>노트북 체로 가능한가 (대략 β ≲ 90)</span><b className={feasible ? 'bad' : 'good'}>{feasible ? '가능' : '아직 어려움'}</b></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 560 }} role="img" aria-label="완전 힌트 개수에 따른 β">
        <line x1={L} y1={H - B} x2={W - 10} y2={H - B} stroke="var(--w-border)" />
        <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--w-border)" />
        {[0, 100, 200, 300, 400, 500, 600].filter((b) => b < base + 20).map((b) => <g key={b}><line x1={L - 3} x2={L} y1={Y(b)} y2={Y(b)} stroke="var(--w-muted)" /><text x={L - 6} y={Y(b) + 4} fontSize="10" textAnchor="end" fill="var(--w-muted)">{b}</text></g>)}
        <line x1={L} x2={W - 10} y1={Y(90)} y2={Y(90)} stroke="var(--w-bad)" strokeDasharray="4 3" />
        <text x={W - 12} y={Y(90) - 4} fontSize="10" textAnchor="end" fill="var(--w-bad)">β = 90</text>
        <polyline fill="none" stroke="var(--w-b1)" strokeWidth={2} points={curve.map((c) => `${X(c.k)},${Y(c.beta)}`).join(' ')} />
        <circle cx={X(Math.min(perfect, S.n))} cy={Y(leakyBeta(S.n, lq, S.sigma, S.sigma, S.n, { perfect, modular: 0, modK: 2, approx: 0, sigmaH: 1 }, 16)?.beta ?? 40)} r={5} fill="var(--w-b2)" />
        <text x={(W + L) / 2} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--w-muted)">완전 힌트 개수 (다른 힌트 없음)</text>
      </svg>
      <p className="note">완전 힌트는 차원을 하나씩 지우고, 모듈러 힌트는 그 좌표의 불확실성을 1/k 로, 근사 힌트는 사후 분산 σ²σ_h²/(σ² + σ_h²) 로 줄입니다. 비밀 계수를 전부 알아낼 필요가 없다는 것이 핵심입니다. ML-KEM-512 는 계수 약 350 개만 알면 β 가 80 근처로 떨어져 나머지는 격자 축소로 풀립니다. Lab 7 의 평문 확인 오라클은 계수 하나에 질의 약 3 번이 들었으니, 약 1,000 번에서 멈추고 격자로 넘어갈 수 있다는 뜻입니다. (좌표 힌트만 다루는 단순화이고, 모듈러 힌트의 가우시안 근사는 σ/k 가 작으면 부정확합니다.)</p>
    </div>
  );
}
