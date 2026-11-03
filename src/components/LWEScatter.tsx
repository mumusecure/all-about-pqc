import { useMemo, useState } from 'react';
import { centerMod, mod, mulberry32, roundedGaussian } from '../lib/lwe';

const Q = 97;
const M = 160;

/**
 * 1차원 LWE 의 직관: b = a·s + e (mod q) 샘플을 (a, b) 평면에 찍는다.
 * 오차가 없으면 점들이 ‘감긴 직선’ 위에 놓이고, 오차가 커질수록 균등 분포와 구별이 어려워진다.
 * 오른쪽에서는 비밀 후보 s' 마다 잔차 b − a·s' 가 얼마나 0에 몰리는지 본다.
 */
export default function LWEScatter() {
  const [sigma, setSigma] = useState(0);
  const [guess, setGuess] = useState(30);
  const [seed, setSeed] = useState(3);
  const [reveal, setReveal] = useState(false);
  const s = 23;

  const samples = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: M }, () => {
      const a = Math.floor(rng() * Q);
      const e = roundedGaussian(rng, sigma);
      return { a, b: mod(a * s + e, Q) };
    });
  }, [sigma, seed]);

  // 각 후보 s' 에 대한 점수: 잔차가 작은(|r| ≤ 2σ+1) 샘플의 비율
  const scores = useMemo(() => {
    const thr = Math.max(1, Math.round(2 * sigma + 1));
    return Array.from({ length: Q }, (_, g) => samples.filter(({ a, b }) => Math.abs(centerMod(b - a * g, Q)) <= thr).length / M);
  }, [samples, sigma]);
  const best = scores.indexOf(Math.max(...scores));

  const S = 300, P = 24;
  const X = (a: number) => P + ((S - 2 * P) * a) / (Q - 1);
  const Y = (b: number) => S - P - ((S - 2 * P) * b) / (Q - 1);

  const W2 = 320, H2 = 300;
  const bx = (g: number) => 30 + ((W2 - 40) * g) / (Q - 1);
  const by = (v: number) => H2 - 30 - (H2 - 60) * v;

  return (
    <div className="widget not-content">
      <h4>1차원 LWE 를 눈으로 보기</h4>
      <p className="widget-sub">q = {Q}, 숨은 비밀 s = ? 인 샘플 (a, b = a·s + e mod q) {M}개. 오차 σ 를 키우며 점들의 구조가 어떻게 사라지는지 보세요.</p>
      <div className="controls">
        <label className="slider">오차 표준편차 σ <b>{sigma.toFixed(1)}</b>
          <input type="range" min={0} max={20} step={0.5} value={sigma} onChange={(e) => setSigma(+e.target.value)} />
        </label>
        <label className="slider">비밀 후보 s′ (왼쪽 그림의 직선) <b>{guess}</b>
          <input type="range" min={0} max={Q - 1} value={guess} onChange={(e) => setGuess(+e.target.value)} />
        </label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        <svg viewBox={`0 0 ${S} ${S}`} style={{ flex: '1 1 260px', maxWidth: 340 }} role="img" aria-label="LWE 샘플 산점도">
          <rect x={P} y={P} width={S - 2 * P} height={S - 2 * P} fill="var(--w-surface)" />
          {/* 후보 s' 의 감긴 직선 b = a s' mod q */}
          {Array.from({ length: Q }, (_, a) => <circle key={a} cx={X(a)} cy={Y(mod(a * guess, Q))} r={1.2} fill="var(--w-b2)" opacity={0.6} />)}
          {samples.map(({ a, b }, i) => <circle key={i} cx={X(a)} cy={Y(b)} r={2.6} fill="var(--w-b1)" opacity={0.8} />)}
          <text x={S / 2} y={S - 4} textAnchor="middle" fontSize="11" fill="var(--w-muted)">a</text>
          <text x={8} y={S / 2} fontSize="11" fill="var(--w-muted)">b</text>
        </svg>
        <svg viewBox={`0 0 ${W2} ${H2}`} style={{ flex: '1 1 260px', maxWidth: 360 }} role="img" aria-label="비밀 후보별 점수">
          <text x={30} y={18} fontSize="12" fill="var(--w-text)">후보 s′ 별 ‘잔차가 작은 샘플’ 비율</text>
          <line x1={30} x2={W2 - 10} y1={by(0)} y2={by(0)} stroke="var(--w-grid)" />
          {scores.map((v, g) => (
            <rect key={g} x={bx(g) - 1.2} y={by(v)} width={2.4} height={by(0) - by(v)} fill={g === guess ? 'var(--w-b2)' : g === best ? 'var(--w-good)' : 'var(--w-point)'} />
          ))}
          <text x={30} y={H2 - 10} fontSize="11" fill="var(--w-muted)">s′ = 0</text>
          <text x={W2 - 10} y={H2 - 10} fontSize="11" textAnchor="end" fill="var(--w-muted)">s′ = {Q - 1}</text>
        </svg>
      </div>
      <div className="stats">
        <div className="stat"><span>현재 후보 s′ 의 점수</span><b>{(scores[guess] * 100).toFixed(0)}%</b></div>
        <div className="stat"><span>최고 점수 후보</span><b>s′ = {best} ({(scores[best] * 100).toFixed(0)}%)</b></div>
        <div className="stat"><span>정답 s</span><b>{reveal ? s : <button onClick={() => setReveal(true)}>정답 보기</button>}</b></div>
      </div>
      <p className="note">
        n = 1 이면 후보가 q 개뿐이라 이렇게 전수조사로 풀립니다. 하지만 n 차원 비밀의 후보는 qⁿ 개(예: 3329²⁵⁶)라 전수조사가 불가능합니다. 그래서 공격자는 격자 축소 같은 훨씬 영리한 방법을 써야 합니다.
      </p>
      <div className="row"><button onClick={() => setSeed((x) => x + 1)}>새 샘플</button></div>
    </div>
  );
}
