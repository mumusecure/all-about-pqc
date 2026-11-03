import { useState } from 'react';
import { Q, compress, compressError, decompress } from '../lib/mlkem';

/**
 * 압축: ℤ_q 의 수를 d 비트로 줄였다가 되돌리면 가장 가까운 '대표값'으로 반올림된다.
 * 대표값 간격 q/2ᵈ, 오차는 최대 ⌈q/2^{d+1}⌋.
 */
export default function CompressLab() {
  const [d, setD] = useState(4);
  const [x, setX] = useState(1000);
  const y = compress(x, d), x2 = decompress(y, d), err = compressError(x, d);
  const step = Q / 2 ** d, bound = Math.round(Q / 2 ** (d + 1));
  // x 주변 대표값 8 칸 정도를 확대해서 보여 준다 (d 가 작으면 전체)
  const span = Math.min(Q, 8 * step);
  const lo = Math.max(0, Math.min(Q - span, x - span / 2)), hi = lo + span;
  const W = 480, H = 120, L = 20, R = 20, Y0 = 58;
  const X = (v: number) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  const reps: number[] = [];
  for (let t = 0; t < 2 ** d; t++) { const r = decompress(t, d); if (r >= lo && r <= hi) reps.push(r); }
  const role = d === 1 ? '메시지 비트 (Compress₁ = 복호의 반올림)' : d <= 5 ? 'v 에 쓰는 크기 (dv = 4, 5)' : d <= 11 ? 'u 에 쓰는 크기 (du = 10, 11)' : '압축 없음 (12비트 그대로)';
  return (
    <div className="widget not-content">
      <h4>압축: 12비트 수를 d 비트로</h4>
      <p className="widget-sub">Compress_d(x) = ⌈(2ᵈ/q)·x⌋ mod 2ᵈ 는 ℤ_q 를 2ᵈ 칸으로 나눈 눈금 번호, Decompress_d 는 그 칸의 대표값입니다. 되돌린 값은 원래 값과 조금 다르고, 그 차이가 <b>또 하나의 작은 오차</b>로 복호 잡음에 더해집니다.</p>
      <div className="controls">
        <label className="slider">비트 수 d <b>{d}</b> <span>{role}</span>
          <input type="range" min={1} max={12} value={d} onChange={(e) => setD(+e.target.value)} />
        </label>
        <label className="slider">원래 값 x ∈ ℤ_q <b>{x}</b>
          <input type="range" min={0} max={Q - 1} value={x} onChange={(e) => setX(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="압축 눈금">
        <line x1={L} x2={W - R} y1={Y0} y2={Y0} stroke="var(--w-grid)" strokeWidth={2} />
        {reps.map((r) => <g key={r}><line x1={X(r)} x2={X(r)} y1={Y0 - 10} y2={Y0 + 10} stroke="var(--w-point)" /></g>)}
        <line x1={X(x)} x2={X(x2)} y1={Y0} y2={Y0} stroke="var(--w-bad)" strokeWidth={4} />
        <circle cx={X(x)} cy={Y0} r={6} fill="var(--w-b1)" />
        <circle cx={X(x2)} cy={Y0} r={5} fill="none" stroke="var(--w-good)" strokeWidth={2.5} />
        <text x={X(x)} y={Y0 - 18} fontSize="16" textAnchor="middle" fill="var(--w-b1)">x = {x}</text>
        <text x={X(x2)} y={Y0 + 30} fontSize="16" textAnchor="middle" fill="var(--w-good)">x′ = {x2}</text>
        <text x={L} y={H - 4} fontSize="14" fill="var(--w-muted)">{Math.round(lo)}</text>
        <text x={W - R} y={H - 4} fontSize="14" textAnchor="end" fill="var(--w-muted)">{Math.round(hi)}{hi >= Q ? ' (= q ≡ 0)' : ''}</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>Compress_{d}(x) (보내는 값)</span><b>{y} / {2 ** d}</b></div>
        <div className="stat"><span>오차 x′ − x</span><b>{err > 0 ? '+' : ''}{err}</b></div>
        <div className="stat"><span>최대 오차 ⌈q/2^{d + 1}⌋ · 칸 간격</span><b>{bound} · {step.toFixed(1)}</b></div>
        <div className="stat"><span>다항식 하나의 크기</span><b>{32 * d} B (압축 전 384 B)</b></div>
      </div>
      <p className="note">d = 1 은 특별합니다. 대표값이 0 과 ⌈q/2⌋ = 1665 둘뿐이라 Compress₁ 은 “0 과 1665 중 어디에 가까운가”, 즉 복호의 반올림 그 자체입니다. 공개키 t̂ 는 압축하지 않고(NTT 영역 그대로 12비트), 암호문의 u 는 du 비트, v 는 dv 비트로 줄입니다.</p>
    </div>
  );
}
