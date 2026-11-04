import { useRef, useState } from 'react';
import { bkzTour } from '../lib/bkz';
import { type TernaryKey, classify, fatigueLattice, qStarDvW, scanBasis, ternaryKeyGen } from '../lib/fatigue';
import { type Basis, lll } from '../lib/lattice';
import { mulberry32 } from '../lib/lwe';

/**
 * 논문 읽기 5: DvW 식 실험을 작은 n 에서. 진행형 BKZ 사다리를 오르며 키 부분격자의 벡터가
 * "하나씩(SKR)" 나타나는지 "한꺼번에(DSD)" 나타나는지 본다. 시드는 tests/fatigue.test.ts·본문 표와 같은 규칙.
 */
const N = 40;
const QS = [23, 31, 37, 47, 61, 79];
/** 이 교과서의 DvW 예측기 이식본으로 계산한 n = 40 의 fatigue point (tests/dvw.test.ts 가 확인) */
const Q_EST = 60;
interface Step { beta: number; inKey: number; rotations: number; ms: number; }

/** 미리 잰 값: n = 40, 키 1~4 (같은 시드라 위에서 직접 돌리면 같은 결과가 나와야 함). [사건, β] */
const MEASURED: Record<number, ['SKR' | 'DSD', number][]> = {
  23: [['SKR', 10], ['SKR', 16], ['SKR', 16], ['SKR', 16]],
  31: [['DSD', 10], ['DSD', 10], ['SKR', 10], ['SKR', 6]],
  37: [['DSD', 4], ['SKR', 6], ['SKR', 4], ['SKR', 4]],
  47: [['DSD', 4], ['SKR', 2], ['DSD', 4], ['SKR', 2]],
  61: [['DSD', 2], ['DSD', 2], ['DSD', 2], ['DSD', 2]],
  79: [['DSD', 2], ['DSD', 2], ['DSD', 2], ['DSD', 2]],
};

export const seedOf = (n: number, q: number, s: number) => n * 100000 + q * 10 + s;

export default function FatigueExperiment() {
  const [q, setQ] = useState(37);
  const [seed, setSeed] = useState(1);
  const [steps, setSteps] = useState<Step[]>([]);
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'gaveup'>('idle');
  const run = useRef<{ B: Basis; key: TernaryKey; beta: number; stop: boolean } | null>(null);
  const start = () => {
    setSteps([]); setState('running');
    setTimeout(() => {
      const t = performance.now();
      const key = ternaryKeyGen(N, q, mulberry32(seedOf(N, q, seed)));
      const B = lll(fatigueLattice(key), 0.99).basis;
      const s = { beta: 2, ...scanBasis(B, key), ms: performance.now() - t };
      setSteps([s]);
      run.current = { B, key, beta: 2, stop: false };
      if (s.inKey) { setState('done'); return; }
      setTimeout(tick, 30);
    }, 30);
  };
  const tick = () => {
    const r = run.current;
    if (!r || r.stop) return;
    r.beta += 2;
    const t = performance.now();
    for (let i = 0; i < 2; i++) r.B = bkzTour(r.B, r.beta).basis;
    const s = { beta: r.beta, ...scanBasis(r.B, r.key), ms: performance.now() - t };
    setSteps((ss) => [...ss, s]);
    if (s.inKey) { setState('done'); return; }
    if (r.beta >= 24) { setState('gaveup'); return; }
    setTimeout(tick, 30);
  };
  const stop = () => { if (run.current) run.current.stop = true; setState('idle'); };
  const last = steps[steps.length - 1];
  const ev = state === 'done' && last ? classify(last, N) : null;
  return (
    <div className="widget not-content">
      <h4>바늘이 먼저인가, 다발이 먼저인가: 작은 n 에서 재 보기</h4>
      <p className="widget-sub">n = {N}(격자 차원 80)의 삼진 NTRU 키에 LLL, BKZ-4, 6, … 을 두 바퀴씩 돌리며, 기저에 키 부분격자 L_key = {'{'}(a·g, a·f){'}'} 의 벡터가 처음 들어오는 순간 몇 개가 함께, 어떤 모양으로 들어왔는지 봅니다. 회전 ±xⁱ(g, f) 가 아닌(키보다 긴) L_key 벡터가 섞여 있거나 n/4 = {N / 4} 개 이상이 한꺼번에 들어오면 다발(DSD), 회전 몇 개뿐이면 바늘(SKR)로 봅니다. n = {N} 의 fatigue point 는 DvW 예측기(이 교과서 이식본)로 q* ≈ {Q_EST}, 맞춤식 0.004·n^2.484 를 외삽하면 {qStarDvW(N).toFixed(0)} 입니다.</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {QS.map((v) => <button key={v} className={q === v ? 'primary' : ''} disabled={state === 'running'} onClick={() => setQ(v)}>q = {v}</button>)}
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {[1, 2, 3, 4].map((s) => <button key={s} className={seed === s ? 'primary' : ''} disabled={state === 'running'} onClick={() => setSeed(s)}>키 {s}</button>)}
        <button className="primary" disabled={state === 'running'} onClick={start}>사다리 오르기</button>
        {state === 'running' && <button onClick={stop}>멈추기</button>}
      </div>
      <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
        {steps.map((s) => (
          <span key={s.beta} style={{ padding: '0.15rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.8rem', border: '1px solid var(--w-border)', background: s.inKey ? 'var(--w-good)' : 'var(--w-surface)', color: s.inKey ? 'var(--w-on-accent)' : 'var(--w-text)' }}>
            β={s.beta}{s.inKey ? ` ✓ L_key 벡터 ${s.inKey}개 (회전 ${s.rotations})` : ''}
          </span>
        ))}
        {state === 'running' && <span style={{ fontSize: '0.8rem', color: 'var(--w-muted)' }}>계산 중…</span>}
      </div>
      <div className="stats">
        <div className="stat"><span>사건</span><b>{ev === 'DSD' ? '다발 (DSD)' : ev === 'SKR' ? '바늘 (SKR)' : state === 'gaveup' ? 'β ≤ 24 로는 아직' : state === 'running' ? '진행 중' : '—'}</b></div>
        <div className="stat"><span>그때 β</span><b>{state === 'done' && last ? last.beta : '—'}</b></div>
        <div className="stat"><span>q / q*(예측기)</span><b>{(q / Q_EST).toFixed(2)}</b></div>
        <div className="stat"><span>마지막 칸 시간</span><b>{last ? `${(last.ms / 1000).toFixed(1)} s` : '—'}</b></div>
      </div>
      <div className="table-wrap">
        <table style={{ width: '100%', fontSize: '0.82rem' }}>
          <thead><tr><th>미리 잰 값 (q =)</th>{QS.map((x) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>{[0, 1, 2, 3].map((k) => (
            <tr key={k}><td>키 {k + 1}</td>{QS.map((x) => { const [e, b] = MEASURED[x][k]; return <td key={x} style={{ textAlign: 'center', color: e === 'DSD' ? 'var(--w-b2)' : 'var(--w-b1)' }}>{e} β={b}</td>; })}</tr>
          ))}</tbody>
        </table>
      </div>
      <p className="note">q 가 작으면 BKZ 가 키의 회전을 한두 개씩 찾고(바늘), q 가 커지면 LLL 이나 아주 작은 β 에서 회전 수십 개가 한꺼번에 나타납니다(다발). 이 크기에서는 키마다 흔들림이 커서, 본문 5절의 표처럼 여러 키로 세어야 경계가 보입니다. 작은 q 는 몇십 초 걸릴 수 있습니다.</p>
    </div>
  );
}
