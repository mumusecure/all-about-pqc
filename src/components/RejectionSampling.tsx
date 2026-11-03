import { useState } from 'react';
import { zDistribution } from '../lib/sigma';

/**
 * 거절 샘플링: z = y + c·s 가 비밀 s 를 흘리지 않게 만드는 방법 (Lyubashevsky 의 Fiat–Shamir with aborts, 1차원 축소판).
 * 회색 = 비밀이 0 일 때의 z 분포, 파랑 = 비밀이 s 일 때. 둘이 같아지면 응답 z 는 s 에 대해 아무것도 알려주지 않는다.
 */
export default function RejectionSampling() {
  const [s, setS] = useState(6);
  const [B, setB] = useState(40);
  const [reject, setReject] = useState(false);
  const beta = 10; // 허용하는 |c·s| 의 최댓값
  const ref = zDistribution(0, B, beta, reject);
  const cur = zDistribution(s, B, beta, reject);
  const lo = -(B + beta), hi = B + beta;
  let sd = 0;
  for (let z = lo; z <= hi; z++) sd += Math.abs((cur.dist.get(z) ?? 0) - (ref.dist.get(z) ?? 0));
  sd /= 2;

  const W = 620, H = 170, L = 10, R = 10, T = 12, Bm = 22;
  const pmax = Math.max(...[...cur.dist.values(), ...ref.dist.values()]) * 1.1;
  const X = (z: number) => L + ((W - L - R) * (z - lo)) / (hi - lo);
  const Y = (p: number) => T + (H - T - Bm) * (1 - p / pmax);
  const bw = Math.max(1, (W - L - R) / (hi - lo + 1));
  return (
    <div className="widget not-content">
      <h4>거절 샘플링: 응답이 비밀을 흘리지 않게</h4>
      <p className="widget-sub">격자 Fiat–Shamir 서명의 응답 z = y + c·s 를 1차원으로 줄인 모형입니다. y ← [−B, B] 균등, c ← {'{−1, 0, 1}'}, 비밀 |s| ≤ β = {beta}. 회색 = s = 0 일 때, 파랑 = 선택한 s 일 때의 z 분포.</p>
      <div className="controls">
        <label className="slider">비밀 s <b>{s}</b>
          <input type="range" min={0} max={beta} value={s} onChange={(e) => setS(+e.target.value)} />
        </label>
        <label className="slider">마스크 범위 B <b>{B}</b>
          <input type="range" min={12} max={120} value={B} onChange={(e) => setB(+e.target.value)} />
        </label>
        <label style={{ fontSize: '0.9rem', alignSelf: 'end' }}><input type="checkbox" checked={reject} onChange={(e) => setReject(e.target.checked)} /> 거절: |z| &gt; B − β 이면 버리고 다시 시도</label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="z 분포 비교">
        {[...ref.dist.entries()].map(([z, p]) => <rect key={`r${z}`} x={X(z) - bw / 2} y={Y(p)} width={bw} height={H - Bm - Y(p)} fill="var(--w-point)" opacity={0.45} />)}
        {[...cur.dist.entries()].map(([z, p]) => <rect key={`c${z}`} x={X(z) - bw / 4} y={Y(p)} width={bw / 2} height={H - Bm - Y(p)} fill="var(--w-b1)" opacity={0.85} />)}
        {reject && [-(B - beta), B - beta].map((z) => <line key={z} x1={X(z)} x2={X(z)} y1={T} y2={H - Bm} stroke="var(--w-bad)" strokeDasharray="4 3" />)}
        <text x={X(0)} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--w-muted)">0</text>
        <text x={X(lo)} y={H - 6} fontSize="11" fill="var(--w-muted)">{lo}</text>
        <text x={X(hi)} y={H - 6} fontSize="11" textAnchor="end" fill="var(--w-muted)">{hi}</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>Δ(z 분포 | s, z 분포 | 0)</span><b className={sd < 1e-9 ? 'good' : 'bad'}>{sd < 1e-9 ? '0 (구별 불가)' : sd.toFixed(3)}</b></div>
        <div className="stat"><span>수락 확률 (한 번에 서명될 확률)</span><b>{(cur.acceptRate * 100).toFixed(1)}%</b></div>
        <div className="stat"><span>평균 시도 횟수</span><b>{(1 / cur.acceptRate).toFixed(2)}</b></div>
      </div>
      <p className="note">거절하지 않으면 분포의 가장자리가 |s| 만큼 밀려나 비밀이 드러납니다(통계적 거리 &gt; 0). 거절하면 받아들인 z 는 [−(B−β), B−β] 위의 균등분포로 s 와 무관해집니다. 대가는 가끔 다시 서명해야 한다는 것: B 가 β 에 비해 클수록 덜 거절하지만 서명이 커집니다. 이 절충이 ML-DSA·HAETAE 설계의 중심입니다(17장).</p>
    </div>
  );
}
