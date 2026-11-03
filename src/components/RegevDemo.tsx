import { useMemo, useState } from 'react';
import { centerMod, mulberry32, regevDecrypt, regevEncrypt, regevKeyGen, regevPhase } from '../lib/lwe';

/** 상보 오차함수 근사 (Abramowitz–Stegun 7.1.26, 오차 < 1.5e-7) */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * z);
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
  return x >= 0 ? y : 2 - y;
}

const N_TRIALS = 300;

/**
 * Regev 암호의 복호 과정을 원(ℤ_q)에서 보여준다.
 * 위상 w = v − ⟨u,s⟩ = eᵀr + bit·⌊q/2⌋ (mod q).  0 근처 → 0, q/2 근처 → 1.
 */
export default function RegevDemo() {
  const [q, setQ] = useState(257);
  const [m, setM] = useState(64);
  const [sigma, setSigma] = useState(1.5);
  const [seed, setSeed] = useState(1);
  const n = 16;

  const res = useMemo(() => {
    const rng = mulberry32(seed * 1000 + q + m);
    const { pk, sk } = regevKeyGen({ n, m, q, sigma }, rng);
    const trials = Array.from({ length: N_TRIALS }, (_, t) => {
      const bit = (t % 2) as 0 | 1;
      const ct = regevEncrypt(pk, bit, rng);
      const w = regevPhase(sk, ct, q);
      return { bit, w, ok: regevDecrypt(sk, ct, q) === bit, ct };
    });
    const fails = trials.filter((t) => !t.ok).length;
    return { trials, fails, sk };
  }, [q, m, sigma, seed]);

  // 이론값: eᵀr 는 대략 m/2 개의 오차의 합 → 표준편차 σ·√(m/2)
  const noiseSd = sigma * Math.sqrt(m / 2);
  const pFail = erfc(q / 4 / (noiseSd * Math.SQRT2));

  const S = 300, C = S / 2, RAD = 112;
  const pos = (w: number, jitter: number) => {
    const ang = (2 * Math.PI * w) / q - Math.PI / 2;
    const r = RAD + jitter;
    return [C + r * Math.cos(ang), C + r * Math.sin(ang)];
  };
  const arc = (from: number, to: number) => {
    const a0 = (2 * Math.PI * from) / q - Math.PI / 2, a1 = (2 * Math.PI * to) / q - Math.PI / 2;
    const x0 = C + RAD * Math.cos(a0), y0 = C + RAD * Math.sin(a0), x1 = C + RAD * Math.cos(a1), y1 = C + RAD * Math.sin(a1);
    return `M${x0},${y0} A${RAD},${RAD} 0 0 1 ${x1},${y1}`;
  };
  const ex = res.trials[1]; // bit = 1 예시

  return (
    <div className="widget not-content">
      <h4>Regev 암호: 노이즈가 쌓이면 무슨 일이?</h4>
      <p className="widget-sub">원은 ℤ_q 입니다. 위쪽(초록 호)은 “0으로 복호”, 아래쪽(주황 호)은 “1로 복호” 영역. 점 하나가 암호문 하나의 위상 w = v − ⟨u,s⟩ 입니다 (n = {n}).</p>
      <div className="controls">
        <label className="slider">모듈러스 q <b>{q}</b>
          <select value={q} onChange={(e) => setQ(+e.target.value)}>
            {[97, 257, 769, 3329].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="slider">샘플 수 m <b>{m}</b>
          <input type="range" min={8} max={256} step={8} value={m} onChange={(e) => setM(+e.target.value)} />
        </label>
        <label className="slider">오차 표준편차 σ <b>{sigma.toFixed(1)}</b>
          <input type="range" min={0} max={8} step={0.1} value={sigma} onChange={(e) => setSigma(+e.target.value)} />
        </label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <svg viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 300, flex: '1 1 240px' }} role="img" aria-label={`복호 실패 ${res.fails}/${N_TRIALS}`}>
          <circle cx={C} cy={C} r={RAD} fill="none" stroke="var(--w-grid)" strokeWidth={10} />
          <path d={arc(-q / 4, q / 4)} fill="none" stroke="var(--w-good)" strokeWidth={10} opacity={0.35} />
          <path d={arc(q / 4, (3 * q) / 4)} fill="none" stroke="var(--w-bad)" strokeWidth={10} opacity={0.35} />
          <text x={C} y={C - RAD - 16} textAnchor="middle" fontSize="12" fill="var(--w-muted)">0</text>
          <text x={C} y={C + RAD + 24} textAnchor="middle" fontSize="12" fill="var(--w-muted)">⌊q/2⌋</text>
          {res.trials.map((t, i) => {
            const [x, y] = pos(t.w, ((i * 37) % 21) - 10);
            return <circle key={i} cx={x} cy={y} r={t.ok ? 2.4 : 4.2} fill={t.bit ? 'var(--w-b2)' : 'var(--w-b1)'} stroke={t.ok ? 'none' : 'var(--w-text)'} strokeWidth={1.2} opacity={t.ok ? 0.75 : 1} />;
          })}
          <text x={C} y={C - 4} textAnchor="middle" fontSize="13" fill="var(--w-text)" fontWeight="700">실패 {res.fails}/{N_TRIALS}</text>
          <text x={C} y={C + 14} textAnchor="middle" fontSize="11" fill="var(--w-muted)">파랑 = 0 암호화 · 주황 = 1 암호화</text>
        </svg>
        <div style={{ flex: '1 1 220px', fontSize: '0.85rem' }}>
          <b>예시 암호문 (bit = 1)</b>
          <div className="log" style={{ marginTop: 4 }}>
            <div>r 에서 고른 샘플 수 = {ex.ct.r.reduce((a, b) => a + b, 0)}</div>
            <div>u = Aᵀr = ({ex.ct.u.slice(0, 4).join(', ')}, …)</div>
            <div>v = bᵀr + ⌊q/2⌋ = {ex.ct.v}</div>
            <div>w = v − ⟨u,s⟩ = {ex.w}</div>
            <div>w 의 중심 대표값 = {centerMod(ex.w, q)} → {Math.abs(centerMod(ex.w, q)) < q / 4 ? '0' : '1'} 로 복호</div>
          </div>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><span>잡음 eᵀr 표준편차 ≈ σ√(m/2)</span><b>{noiseSd.toFixed(2)}</b></div>
        <div className="stat"><span>허용 한계 q/4</span><b>{(q / 4).toFixed(1)}</b></div>
        <div className="stat"><span>이론 실패확률 (정규근사)</span><b>{pFail < 1e-6 ? '< 10⁻⁶' : pFail.toFixed(4)}</b></div>
        <div className="stat"><span>실측 실패율</span><b className={res.fails ? 'bad' : 'good'}>{(res.fails / N_TRIALS).toFixed(3)}</b></div>
      </div>
      <div className="row"><button onClick={() => setSeed((s) => s + 1)}>새 키로 다시</button></div>
    </div>
  );
}
