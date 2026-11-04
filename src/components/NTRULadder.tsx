import { useRef, useState } from 'react';
import { bkzTour, norm2 } from '../lib/bkz';
import { type Basis, lll } from '../lib/lattice';
import { mulberry32 } from '../lib/lwe';
import { type NTRUKey, isRotationOfKey, ntruKeyGen, ntruLattice } from '../lib/ntru';

const N = 40;
const QS = [37, 67, 131, 257, 521];
interface Step { beta: number; rot: number; b1: number; ms: number; }

/** 저자가 이 교과서용으로 측정한 값 (TS BKZ, 바퀴 2 번씩 진행형, 키 하나) */
const MEASURED: { n: number; rows: [number, number | null][] }[] = [
  { n: 40, rows: [[17, null], [37, null], [67, 20], [131, 14]] },
  { n: 48, rows: [[37, null], [67, null], [131, 26], [257, 12], [521, 4]] },
  { n: 64, rows: [[257, 28], [521, 16], [1031, 6], [2053, 2], [4099, 2]] },
];
const COLS = [...new Set(MEASURED.flatMap((m) => m.rows.map(([q]) => q)))].filter((q) => q >= 37).sort((a, b) => a - b);

/**
 * BKZ 사다리: 블록 크기를 2(LLL), 4, 6, … 로 올리며 NTRU 키의 회전이 나타나는 순간을 찾는다.
 * q 가 클수록 사다리의 낮은 칸에서 무너진다.
 */
export default function NTRULadder() {
  const [q, setQ] = useState(131);
  const [steps, setSteps] = useState<Step[]>([]);
  const [state, setState] = useState<'idle' | 'running' | 'found' | 'gaveup'>('idle');
  const run = useRef<{ B: Basis; key: NTRUKey; beta: number; stop: boolean } | null>(null);
  const keyNorm = (k: NTRUKey) => Math.sqrt(norm2([...k.g, ...k.f]));
  const start = () => {
    const key = ntruKeyGen(N, q, mulberry32(q * 13));
    setSteps([]); setState('running');
    setTimeout(() => {
      const t = performance.now();
      const B = lll(ntruLattice(key), 0.99).basis;
      const rot = B.slice(0, N).filter((v) => isRotationOfKey(v, key)).length;
      const s: Step = { beta: 2, rot, b1: Math.sqrt(norm2(B[0])) / keyNorm(key), ms: performance.now() - t };
      setSteps([s]);
      run.current = { B, key, beta: 2, stop: false };
      if (rot) { setState('found'); return; }
      setTimeout(tick, 30);
    }, 30);
  };
  const tick = () => {
    const r = run.current;
    if (!r || r.stop) return;
    r.beta += 2;
    const t = performance.now();
    for (let i = 0; i < 2; i++) r.B = bkzTour(r.B, r.beta).basis;
    const rot = r.B.slice(0, N).filter((v) => isRotationOfKey(v, r.key)).length;
    setSteps((ss) => [...ss, { beta: r.beta, rot, b1: Math.sqrt(norm2(r.B[0])) / keyNorm(r.key), ms: performance.now() - t }]);
    if (rot) { setState('found'); return; }
    if (r.beta >= 24) { setState('gaveup'); return; }
    setTimeout(tick, 30);
  };
  const stop = () => { if (run.current) run.current.stop = true; setState('idle'); };
  const last = steps[steps.length - 1];
  return (
    <div className="widget not-content">
      <h4>BKZ 사다리: q 가 클수록 일찍 무너진다</h4>
      <p className="widget-sub">n = {N} (격자 차원 80) 의 NTRU 키를 만들고, LLL(β = 2) 다음 BKZ-4, 6, 8, … 을 두 바퀴씩 돌리며 기저의 앞 {N} 개에 비밀키의 회전 xⁱ(g, f) 가 나타나는지 봅니다. 브라우저에서 실제로 계산하므로 q 가 작으면 몇십 초 걸립니다.</p>
      <div className="row">
        {QS.map((v) => <button key={v} className={q === v ? 'primary' : ''} disabled={state === 'running'} onClick={() => setQ(v)}>q = {v}</button>)}
      </div>
      <div className="row">
        <button className="primary" disabled={state === 'running'} onClick={start}>사다리 오르기</button>
        {state === 'running' && <button onClick={stop}>멈추기</button>}
      </div>
      <div className="row" style={{ gap: '0.35rem' }}>
        {steps.map((s) => (
          <span key={s.beta} style={{ padding: '0.15rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.8rem', border: '1px solid var(--w-border)', background: s.rot ? 'var(--w-good)' : 'var(--w-surface)', color: s.rot ? 'var(--w-on-accent)' : 'var(--w-text)' }}>
            β={s.beta}{s.rot ? ` ✓ 회전 ${s.rot}개` : ''}
          </span>
        ))}
        {state === 'running' && <span style={{ fontSize: '0.8rem', color: 'var(--w-muted)' }}>계산 중…</span>}
      </div>
      <div className="stats">
        <div className="stat"><span>결과</span><b className={state === 'found' ? 'bad' : state === 'gaveup' ? 'good' : ''}>{state === 'found' ? `β = ${last.beta} 에서 키 복구` : state === 'gaveup' ? 'β ≤ 24 로는 실패' : state === 'running' ? '진행 중' : '—'}</b></div>
        <div className="stat"><span>‖b₁‖ / ‖(g, f)‖</span><b>{last ? last.b1.toFixed(2) : '—'}</b></div>
        <div className="stat"><span>마지막 칸 시간</span><b>{last ? `${(last.ms / 1000).toFixed(1)} s` : '—'}</b></div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
          <thead><tr style={{ color: 'var(--w-muted)' }}><th style={{ textAlign: 'left' }}>미리 잰 값 (q =)</th>{COLS.map((qq) => <th key={qq}>{qq}</th>)}</tr></thead>
          <tbody>{MEASURED.map((m) => (
            <tr key={m.n} style={{ borderTop: '1px solid var(--w-border)' }}>
              <td>n = {m.n}</td>
              {COLS.map((qq) => { const r = m.rows.find(([x]) => x === qq); return <td key={qq} style={{ textAlign: 'center' }}>{r ? (r[1] === null ? '> 30' : `β = ${r[1]}`) : '—'}</td>; })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="note">q 가 두 배가 될 때마다 필요한 β 가 크게 줄고, β 가 작아지는 영역에서는 회전이 하나가 아니라 <b>한꺼번에 여러 개</b>(n = 48, q = 521 에서 48 개, n = 64, q = 1031 에서 64 개 전부) 나타납니다. 회전들이 펼치는 밀집 부분격자가 통째로 드러나는 것, 즉 overstretched 쪽의 현상입니다. 표의 값은 다른 키로 잰 것이라 직접 돌린 결과와 β 가 몇 칸 다를 수 있습니다(키마다 흔들림). 작은 차원이라 fatigue point 의 상수를 재기에는 부족하지만, 같은 실험을 큰 n 에서 수천 번 돌린 것이 Ducas–van Woerden(2021)의 근거입니다.</p>
    </div>
  );
}
