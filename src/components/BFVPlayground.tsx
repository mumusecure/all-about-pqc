import { useMemo, useState } from 'react';
import { BFV_DEFAULT, type CT, bfvAdd, bfvDecrypt, bfvEncrypt, bfvKeyGen, bfvMul, bfvMulPlain, noiseBudget } from '../lib/fhe';
import { mulberry32 } from '../lib/lwe';

const K0 = bfvKeyGen(BFV_DEFAULT, 1);
const N = BFV_DEFAULT.n, T = BFV_DEFAULT.t;
const rndMsg = (seed: number) => { const r = mulberry32(seed); return Array.from({ length: N }, () => BigInt(Math.floor(r() * Number(T)))); };
interface Step { label: string; budget: number; ok: boolean; }

/**
 * BFV 동형 연산 놀이터: 암호문 하나를 들고 덧셈·곱셈을 계속하며 잡음 예산(비트)이 줄어드는 것을 본다.
 * 예산이 0 아래로 내려가면 복호가 틀린다. '부트스트래핑'은 여기서는 새로 암호화하는 것으로 흉내낸다.
 */
export default function BFVPlayground() {
  const [c, setC] = useState<CT>(() => bfvEncrypt(K0, rndMsg(2), 3));
  const [hist, setHist] = useState<Step[]>([]);
  const [ctr, setCtr] = useState(10);
  const info = useMemo(() => { const nb = noiseBudget(K0, c); const dec = bfvDecrypt(K0, c); return { ...nb, dec, ok: dec.every((x, i) => x === c.m[i]) }; }, [c]);
  const apply = (label: string, f: (x: CT) => CT) => {
    const nc = f(c); const nb = noiseBudget(K0, nc), ok = bfvDecrypt(K0, nc).every((x, i) => x === nc.m[i]);
    setC(nc); setHist((h) => [...h, { label, budget: nb.budget, ok }].slice(-24)); setCtr((k) => k + 2);
  };
  const fresh = () => bfvEncrypt(K0, rndMsg(ctr), ctr + 1);
  const reset = () => { setC(bfvEncrypt(K0, rndMsg(2), 3)); setHist([]); };
  const W = 620, H = 160, L = 34, R = 10, Tm = 10, B = 22;
  const pts = [{ label: '처음', budget: noiseBudget(K0, bfvEncrypt(K0, rndMsg(2), 3)).budget, ok: true }, ...hist];
  const X = (i: number) => L + ((W - L - R) * i) / Math.max(1, pts.length - 1);
  const Y = (b: number) => Tm + ((H - Tm - B) * (55 - Math.max(-10, Math.min(55, b)))) / 65;
  return (
    <div className="widget not-content">
      <h4>BFV 놀이터: 잡음 예산을 써 가며 계산하기</h4>
      <p className="widget-sub">R_q = ℤ_q[x]/(x¹⁶+1), q ≈ 2⁶⁰ (소수), 평문 ℤ₁₇[x]/(x¹⁶+1). 암호문 하나에 연산을 이어 붙입니다. 곱셈은 텐서 → (t/q) 배 반올림 → 재선형화(밑 2¹⁰ 분해) 를 실제로 합니다.</p>
      <div className="row">
        <button onClick={() => apply('+ 새 암호문', (x) => bfvAdd(K0, x, fresh()))}>+ 새 암호문</button>
        <button onClick={() => apply('× 평문 3', (x) => bfvMulPlain(K0, x, [3n, ...new Array(N - 1).fill(0n)]))}>× 평문 3</button>
        <button className="primary" onClick={() => apply('× 새 암호문', (x) => bfvMul(K0, x, fresh()))}>× 새 암호문</button>
        <button onClick={() => apply('제곱', (x) => bfvMul(K0, x, x))}>제곱</button>
        <button onClick={() => apply('부트스트랩(모의)', (x) => bfvEncrypt(K0, x.m, ctr + 7))}>부트스트랩 (모의)</button>
        <button onClick={reset}>처음으로</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="잡음 예산의 변화">
        {[0, 20, 40].map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke={t === 0 ? 'var(--w-bad)' : 'var(--w-grid)'} strokeDasharray={t === 0 ? '5 4' : undefined} /><text x={L - 4} y={Y(t) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">{t}</text></g>)}
        <polyline points={pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.budget).toFixed(1)}`).join(' ')} fill="none" stroke="var(--w-b1)" strokeWidth={2.5} />
        {pts.map((p, i) => <circle key={i} cx={X(i)} cy={Y(p.budget)} r={4} fill={p.ok ? 'var(--w-b1)' : 'var(--w-bad)'} />)}
      </svg>
      <div className="stats">
        <div className="stat"><span>잡음 예산</span><b className={info.budget > 0 ? 'good' : 'bad'}>{info.budget.toFixed(1)} 비트</b></div>
        <div className="stat"><span>복호 (앞 8 계수)</span><b>{info.dec.slice(0, 8).join(' ')}</b></div>
        <div className="stat"><span>기대값 (평문에서 직접 계산)</span><b>{c.m.slice(0, 8).join(' ')}</b></div>
        <div className="stat"><span>맞는가</span><b className={info.ok ? 'good' : 'bad'}>{info.ok ? '일치' : '틀림 — 잡음이 Δ/2 를 넘음'}</b></div>
      </div>
      <p className="note">처음 예산은 약 50 비트이고, 덧셈은 거의 쓰지 않지만 곱셈 한 번에 약 6 비트(≈ log₂(t·n·…))를 씁니다. 새 암호문을 곱해 가면 7~8 번 정도에서 예산이 바닥나 틀리기 시작합니다(제곱은 더 빨리 씁니다). 이것이 <b>깊이</b>의 한계이고, 더 깊은 계산을 하려면 q 를 키우거나(보안을 위해 n 도 키워야 함, 18장) 잡음을 되돌리는 <b>부트스트래핑</b>이 필요합니다. 여기의 부트스트래핑 버튼은 비밀키로 새로 암호화하는 흉내일 뿐이고, 진짜는 복호 회로 자체를 동형으로 계산해 비밀키 없이 잡음을 줄입니다.</p>
    </div>
  );
}
