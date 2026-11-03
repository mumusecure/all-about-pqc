import { useMemo, useState } from 'react';
import { type MLKEMParams, N, PARAMS, Q, decryptionNoise, kpkeDecrypt, kpkeEncrypt, kpkeKeyGen, noiseVariance } from '../lib/mlkem';
import { mulberry32 } from '../lib/lwe';

type Preset = keyof typeof PARAMS;
interface Run { noise: number[]; wrong: number; }

/**
 * 실제 크기(n = 256, q = 3329)의 K-PKE 를 돌려 256 개 계수의 복호 잡음을 본다.
 * 산술(NTT, 압축)은 FIPS 203 과 같고 난수만 토이 생성기다.
 */
export default function DecryptionNoise() {
  const [base, setBase] = useState<Preset>('ML-KEM-768');
  const [boost, setBoost] = useState(1);
  const [dv, setDv] = useState(PARAMS['ML-KEM-768'].dv);
  const [seed, setSeed] = useState(1);
  const [runs, setRuns] = useState<Run[]>([]);
  const P: MLKEMParams = { ...PARAMS[base], eta1: PARAMS[base].eta1 * boost, dv };
  const rng = useMemo(() => mulberry32(seed * 7919 + boost * 31 + dv), [seed, boost, dv, base]);
  const key = useMemo(() => kpkeKeyGen(P, rng), [rng]);
  const encryptMany = (t: number) => {
    const out: Run[] = [];
    for (let i = 0; i < t; i++) {
      const bits = Array.from({ length: N }, () => (rng() < 0.5 ? 1 : 0));
      const { w, bits: got } = kpkeDecrypt(key, kpkeEncrypt(key, bits, rng));
      out.push({ noise: decryptionNoise(w, bits), wrong: got.filter((b, j) => b !== bits[j]).length });
    }
    setRuns((r) => [...r, ...out].slice(-400));
  };
  const reset = (f: () => void) => { f(); setRuns([]); };
  const last = runs[runs.length - 1];
  const all = runs.flatMap((r) => r.noise);
  const obsSd = all.length ? Math.sqrt(all.reduce((s, x) => s + x * x, 0) / all.length) : 0;
  const maxAbs = all.length ? Math.max(...all.map(Math.abs)) : 0;
  const wrong = runs.reduce((s, r) => s + r.wrong, 0);

  const W = 620, H = 280, L = 44, R = 10, T = 10, B = 20;
  const X = (i: number) => L + (i / (N - 1)) * (W - L - R);
  const Y = (v: number) => T + (H - T - B) * (0.5 - v / Q);
  return (
    <div className="widget not-content">
      <h4>복호 잡음 관찰: 실제 크기의 K-PKE</h4>
      <p className="widget-sub">메시지 256 비트를 암호화하고 복호해서, 계수마다 잡음 w − μ 를 점으로 찍습니다. 점선(±q/4) 밖으로 나간 계수는 비트가 뒤집힙니다.</p>
      <div className="row">
        {(Object.keys(PARAMS) as Preset[]).map((k) => <button key={k} className={base === k && boost === 1 && dv === PARAMS[k].dv ? 'primary' : ''} onClick={() => reset(() => { setBase(k); setBoost(1); setDv(PARAMS[k].dv); })}>{k}</button>)}
      </div>
      <div className="controls">
        <label className="slider">η₁ 배율 (잡음 키우기) <b>×{boost} → η₁ = {P.eta1}</b>
          <input type="range" min={1} max={10} value={boost} onChange={(e) => reset(() => setBoost(+e.target.value))} />
        </label>
        <label className="slider">dv (v 압축 비트) <b>{dv}</b>
          <input type="range" min={1} max={8} value={dv} onChange={(e) => reset(() => setDv(+e.target.value))} />
        </label>
      </div>
      <div className="row">
        <button className="primary" onClick={() => encryptMany(1)}>암호화 1번</button>
        <button onClick={() => encryptMany(50)}>50번 더</button>
        <button onClick={() => reset(() => setSeed((s) => s + 1))}>새 키</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="계수별 복호 잡음">
        {[-Q / 4, Q / 4].map((v) => <line key={v} x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--w-bad)" strokeDasharray="5 4" />)}
        <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="var(--w-grid)" />
        <text x={L - 4} y={Y(Q / 4) + 4} fontSize="12" textAnchor="end" fill="var(--w-bad)">q/4</text>
        <text x={L - 4} y={Y(-Q / 4) + 4} fontSize="12" textAnchor="end" fill="var(--w-bad)">−q/4</text>
        <text x={L - 4} y={Y(0) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">0</text>
        {last?.noise.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r={3} fill={Math.abs(v) > Q / 4 ? 'var(--w-bad)' : 'var(--w-b1)'} />)}
        {!last && <text x={W / 2} y={H / 2 - 12} fontSize="15" textAnchor="middle" fill="var(--w-muted)">‘암호화 1번’ 을 눌러 보세요</text>}
      </svg>
      <div className="stats">
        <div className="stat"><span>암호화 횟수 · 계수 수</span><b>{runs.length} · {all.length.toLocaleString()}</b></div>
        <div className="stat"><span>잡음 표준편차 (관측 / 이론)</span><b>{obsSd.toFixed(1)} / {Math.sqrt(noiseVariance(P)).toFixed(1)}</b></div>
        <div className="stat"><span>최대 |잡음| (경계 832)</span><b>{maxAbs}</b></div>
        <div className="stat"><span>틀린 비트</span><b className={wrong ? 'bad' : 'good'}>{wrong}</b></div>
      </div>
      <p className="note">표준 파라미터에서는 잡음의 표준편차가 경계의 10% 정도라, 수만 개 계수를 찍어도 틀린 비트가 나오지 않습니다(δ ≈ 2⁻¹⁶⁵ 이니 당연합니다). η₁ 을 10배로 키우거나 dv 를 1~2 로 줄이면 점이 경계를 넘기 시작합니다. 실제 공격자는 이런 실패를 일부러 일으킬 수 없도록 FO 가 동전을 해시로 고정합니다(3장).</p>
    </div>
  );
}
