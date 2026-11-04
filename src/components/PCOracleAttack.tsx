import { useMemo, useRef, useState } from 'react';
import { PARAMS, kpkeKeyGen } from '../lib/mlkem';
import { mulberry32 } from '../lib/lwe';
import { recoverCoeff, secretOf, zeroOracle } from '../lib/sidechannel';
import type { KPKECipher } from '../lib/mlkem';

const P = PARAMS['ML-KEM-512'];

/**
 * 평문 확인(PC) 오라클 공격: "이 암호문을 복호하면 0 이 나오는가?" 라는 1 비트만으로 실제 크기의 K-PKE 비밀키를 복원.
 * 오라클은 부채널(재암호화 단계의 전력·시간)이나 정적 키를 CPA 암호로 재사용하는 실수에서 생긴다.
 */
export default function PCOracleAttack() {
  const [seed, setSeed] = useState(1);
  const [noise, setNoise] = useState(0);
  const [votes, setVotes] = useState(1);
  const key = useMemo(() => kpkeKeyGen(P, mulberry32(seed * 101)), [seed]);
  const truth = useMemo(() => secretOf(key), [key]);
  const [got, setGot] = useState<(number | null)[]>([]);
  const [queries, setQueries] = useState(0);
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);
  const total = P.k * 256;
  const run = () => {
    setBusy(true); setGot([]); setQueries(0); stop.current = false;
    const rng = mulberry32(seed * 7 + 3);
    const exact = zeroOracle(key);
    let q = 0;
    const oracle = (c: KPKECipher) => {
      let yes = 0;
      for (let v = 0; v < votes; v++) { q++; const a = exact(c); yes += (rng() < noise ? !a : a) ? 1 : 0; }
      return 2 * yes > votes;
    };
    const out: (number | null)[] = [];
    let idx = 0;
    const tick = () => {
      if (stop.current) { setBusy(false); return; }
      for (let t = 0; t < 32 && idx < total; t++, idx++) out.push(recoverCoeff(P, oracle, Math.floor(idx / 256), idx % 256).s);
      setGot(out.slice()); setQueries(q);
      if (idx < total) setTimeout(tick, 0); else setBusy(false);
    };
    setTimeout(tick, 20);
  };
  const flat = truth.flat();
  const correct = got.filter((s, i) => s === flat[i]).length;
  const cell = 8, cols = 64;
  const color = (s: number) => `hsl(${200 + s * 40} 70% ${50 + s * 6}%)`;
  return (
    <div className="widget not-content">
      <h4>1 비트 오라클로 비밀키 읽기</h4>
      <p className="widget-sub">실제 크기(ML-KEM-512, 비밀 512 계수)의 K-PKE 키에 대해, 공격자는 "복호 결과가 0 인가?" 만 알려 주는 오라클을 씁니다. 암호문 u = (상수 208), v = t·xʲ 를 만들면 복호 값의 j 번째 계수가 t − 208·sⱼ 가 되어, t 를 바꿔 가며 sⱼ ∈ [−3, 3] 을 이분 탐색할 수 있습니다.</p>
      <div className="controls">
        <label className="slider">오라클 오답률 (부채널 잡음) <b>{(noise * 100).toFixed(0)}%</b>
          <input type="range" min={0} max={0.2} step={0.01} value={noise} onChange={(e) => setNoise(+e.target.value)} disabled={busy} />
        </label>
        <label className="slider">같은 질의 반복 (다수결) <b>{votes} 번</b>
          <input type="range" min={1} max={9} step={2} value={votes} onChange={(e) => setVotes(+e.target.value)} disabled={busy} />
        </label>
      </div>
      <div className="row">
        <button className="primary" disabled={busy} onClick={run}>{busy ? '복원 중…' : '공격 시작'}</button>
        {busy && <button onClick={() => (stop.current = true)}>멈추기</button>}
        <button disabled={busy} onClick={() => { setSeed((s) => s + 1); setGot([]); setQueries(0); }}>새 키</button>
      </div>
      <svg viewBox={`0 0 ${cols * cell} ${Math.ceil(total / cols) * cell}`} style={{ maxWidth: 520, margin: '0 auto' }} role="img" aria-label="복원한 비밀 계수">
        {flat.map((s, i) => {
          const g = got[i];
          const fill = g === undefined ? 'var(--w-grid)' : g === s ? color(s) : 'var(--w-bad)';
          return <rect key={i} x={(i % cols) * cell} y={Math.floor(i / cols) * cell} width={cell - 1} height={cell - 1} fill={fill} />;
        })}
      </svg>
      <div className="stats">
        <div className="stat"><span>복원한 계수</span><b>{got.length} / {total}</b></div>
        <div className="stat"><span>맞은 계수</span><b className={got.length && correct === got.length ? 'bad' : ''}>{correct} {got.length ? `(${((100 * correct) / got.length).toFixed(1)}%)` : ''}</b></div>
        <div className="stat"><span>오라클 질의 수</span><b>{queries.toLocaleString()} {got.length ? `(계수당 ${(queries / got.length).toFixed(1)})` : ''}</b></div>
      </div>
      <p className="note">잡음이 없으면 계수당 약 3 번, 키 전체를 1,500 번 남짓의 질의로 정확히 읽습니다(빨강 = 틀린 계수). 오답률을 올리면 틀리는 계수가 생기고, 같은 질의를 여러 번 물어 다수결로 고치면 질의 수가 늘어나는 대신 다시 정확해집니다. 실제 부채널 공격의 논문들이 "트레이스 몇 천 개"를 말하는 이유입니다. 정상적인 ML-KEM 의 Decaps 는 이런 오라클을 주지 않지만(FO 와 암묵적 거부), 재암호화 비교가 전력·시간으로 새거나 CPA 용 K-PKE 를 정적 키로 재사용하면 그대로 생깁니다.</p>
    </div>
  );
}
