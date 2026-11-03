import { useState } from 'react';
import { type RingKind, evalAt, rootAttackScores, sampleRLWE, someRoot } from '../lib/rlwe';
import { mod } from '../lib/algebra';
import { mulberry32 } from '../lib/lwe';

const n = 16, q = 97;

/**
 * 근에서의 값 공격: 변환 다항식의 근 r 에서 b(r) = a(r)·s(r) + e(r) (mod q).
 * xⁿ − 1 의 근 r = 1 에서는 e(1) = Σeᵢ 가 작아 s(1) 이 드러난다. xⁿ + 1 의 근에서는 e(r) 이 퍼져 정보가 없다.
 */
export default function RootAttack() {
  const [kind, setKind] = useState<RingKind>('cyclic');
  const [sigma, setSigma] = useState(1);
  const [m, setM] = useState(40);
  const [seed, setSeed] = useState(1);
  const { s, samples } = sampleRLWE(n, q, sigma, m, kind, mulberry32(seed * 977 + (kind === 'cyclic' ? 1 : 2)));
  const r = someRoot(n, q, kind)!;
  const thr = Math.max(4, Math.round(3 * sigma * Math.sqrt(n)));
  const scores = rootAttackScores(samples, r, q, thr);
  const truth = evalAt(s.map((x) => mod(x, q)), r, q);
  const best = scores.indexOf(Math.max(...scores));
  const sorted = [...scores].sort((a, b) => b - a);
  const W = 620, H = 170, L = 10, R = 10, T = 12, B = 26;
  const bw = (W - L - R) / q;
  const Y = (v: number) => T + (H - T - B) * (1 - v);
  return (
    <div className="widget not-content">
      <h4>근에서의 값 공격: 왜 xⁿ + 1 인가</h4>
      <p className="widget-sub">Ring-LWE 표본 {m}개(n = {n}, q = {q})를 근 r = {r} 에서 계산하면 b(r) = a(r)·s(r) + e(r) 인 ‘1차원 LWE’ 가 됩니다. 후보 g 마다 b(r) − a(r)·g 가 작은(|·| ≤ {thr}) 표본의 비율을 셉니다.</p>
      <div className="row">
        <button className={kind === 'cyclic' ? 'primary' : ''} onClick={() => setKind('cyclic')}>xⁿ − 1 (근 r = 1)</button>
        <button className={kind === 'nega' ? 'primary' : ''} onClick={() => setKind('nega')}>xⁿ + 1 (근 r = {someRoot(n, q, 'nega')})</button>
        <button onClick={() => setSeed((x) => x + 1)}>새 표본</button>
      </div>
      <div className="controls">
        <label className="slider">오차 σ <b>{sigma.toFixed(1)}</b>
          <input type="range" min={0.5} max={3} step={0.5} value={sigma} onChange={(e) => setSigma(+e.target.value)} />
        </label>
        <label className="slider">표본 수 m <b>{m}</b>
          <input type="range" min={10} max={80} step={10} value={m} onChange={(e) => setM(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="후보별 점수">
        <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="var(--w-grid)" />
        {scores.map((v, g) => <rect key={g} x={L + g * bw} y={Y(v)} width={Math.max(1, bw - 1)} height={Y(0) - Y(v)} fill={g === truth ? 'var(--w-good)' : g === best ? 'var(--w-bad)' : 'var(--w-point)'} />)}
        <text x={L} y={H - 6} fontSize="14" fill="var(--w-muted)">g = 0</text>
        <text x={W - R} y={H - 6} fontSize="14" textAnchor="end" fill="var(--w-muted)">g = {q - 1}</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>정답 s(r) (초록)</span><b>{truth}</b></div>
        <div className="stat"><span>최고 점수 후보</span><b className={best === truth ? 'bad' : 'good'}>{best} {best === truth ? '= 정답 (유출!)' : '(정답 아님)'}</b></div>
        <div className="stat"><span>1등 / 2등 점수</span><b>{(sorted[0] * 100).toFixed(0)}% / {(sorted[1] * 100).toFixed(0)}%</b></div>
      </div>
      <p className="note">xⁿ − 1 = (x − 1)(…) 은 기약이 아니라서 r = 1 에서 오차가 e(1) = Σeᵢ (표준편차 σ√n 정도)로 작게 남습니다. 그러면 s(1) = 비밀 계수의 합이 드러나 결정 문제가 깨집니다. xⁿ + 1 의 근 r 에서는 e(r) = Σ eᵢ rⁱ 이 ℤ_q 전체에 퍼져 아무 정보도 없습니다. 오차 분포를 정규 임베딩에 맞게 고르지 않은 환에서 이런 ‘약한 인스턴스’가 실제로 발견되었습니다.</p>
    </div>
  );
}
