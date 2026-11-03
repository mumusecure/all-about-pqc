import { useMemo, useState } from 'react';
import { type MLDSAParams, PARAMS, type Reject, beta, expectedRepetitions, keyGen, sign, sizes, verify } from '../lib/mldsa';
import { mulberry32 } from '../lib/lwe';

type Preset = keyof typeof PARAMS;
interface Done { attempts: Reject[]; ok: boolean; zMax: number; r0Max: number; }

const LABEL: Record<Reject | 'ok', string> = { z: '‖z‖ 초과', r0: 'LowBits 초과', ct0: '‖ct₀‖ 초과', hint: '힌트 > ω', ok: '통과' };

/**
 * ML-DSA 서명 루프를 실제 크기(n = 256, q = 8380417)로 돌린다.
 * 각 시도의 거절 이유와, 성공한 서명의 검증 결과를 보여 준다. (해시는 토이)
 */
export default function MLDSALoop() {
  const [name, setName] = useState<Preset>('ML-DSA-44');
  const [seed, setSeed] = useState(1);
  const [done, setDone] = useState<Done[]>([]);
  const P: MLDSAParams = PARAMS[name];
  const rng = useMemo(() => mulberry32(seed * 101 + P.k), [seed, name]);
  const key = useMemo(() => keyGen(P, rng), [rng]);
  const run = (t: number) => {
    const out: Done[] = [];
    for (let i = 0; i < t; i++) {
      const msg = Math.floor(rng() * 2 ** 31);
      const s = sign(key, msg, rng);
      out.push({ attempts: s.attempts, ok: verify(key, msg, s.sig), zMax: s.zMax, r0Max: s.r0Max });
    }
    setDone((d) => [...d, ...out].slice(-500));
  };
  const pick = (k: Preset) => { setName(k); setDone([]); };
  const last = done[done.length - 1];
  const tries = done.reduce((s, d) => s + d.attempts.length + 1, 0);
  const reasons: Record<string, number> = {};
  done.forEach((d) => d.attempts.forEach((a) => (reasons[a] = (reasons[a] ?? 0) + 1)));
  const allOk = done.every((d) => d.ok);
  const sz = sizes(P), b = beta(P);
  return (
    <div className="widget not-content">
      <h4>ML-DSA 서명 루프: 몇 번 만에 통과하나</h4>
      <p className="widget-sub">실제 크기의 행렬·비밀·마스크로 서명합니다. 시도마다 <b>‖z‖∞ &lt; γ₁ − β</b>, <b>‖LowBits(w − cs₂)‖∞ &lt; γ₂ − β</b>, <b>‖ct₀‖∞ &lt; γ₂</b>, <b>힌트 1 의 개수 ≤ ω</b> 를 차례로 검사하고, 하나라도 어기면 처음부터 다시 합니다.</p>
      <div className="row">
        {(Object.keys(PARAMS) as Preset[]).map((k) => <button key={k} className={name === k ? 'primary' : ''} onClick={() => pick(k)}>{k}</button>)}
      </div>
      <div className="row">
        <button className="primary" onClick={() => run(1)}>서명 1개</button>
        <button onClick={() => run(20)}>20개 더</button>
        <button onClick={() => { setSeed((s) => s + 1); setDone([]); }}>새 키</button>
      </div>
      <div className="row" aria-label="마지막 서명의 시도들" style={{ gap: '0.35rem' }}>
        {last ? [...last.attempts, 'ok' as const].map((a, i) => (
          <span key={i} style={{ padding: '0.15rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.8rem', border: '1px solid var(--w-border)', background: a === 'ok' ? 'var(--w-good)' : 'var(--w-surface)', color: a === 'ok' ? 'var(--w-on-accent)' : 'var(--w-text)' }}>
            {i + 1}. {LABEL[a]}
          </span>
        )) : <span style={{ color: 'var(--w-muted)', fontSize: '0.85rem' }}>‘서명 1개’ 를 눌러 보세요</span>}
      </div>
      <div className="stats">
        <div className="stat"><span>서명 수 · 평균 시도 (이론)</span><b>{done.length} · {done.length ? (tries / done.length).toFixed(2) : '—'} ({expectedRepetitions(P).toFixed(2)})</b></div>
        <div className="stat"><span>거절 이유 누계</span><b>{Object.keys(reasons).length ? Object.entries(reasons).map(([k, v]) => `${LABEL[k as Reject]} ${v}`).join(' · ') : '—'}</b></div>
        <div className="stat"><span>마지막 서명: ‖z‖∞ / 한계 γ₁ − β</span><b>{last ? `${last.zMax.toLocaleString()} / ${(P.gamma1 - b).toLocaleString()}` : '—'}</b></div>
        <div className="stat"><span>검증</span><b className={done.length && allOk ? 'good' : ''}>{done.length ? (allOk ? `모두 통과 (${done.length})` : '실패 있음!') : '—'}</b></div>
      </div>
      <p className="note">β = τη = {b}, γ₁ = 2^{Math.log2(P.gamma1)}, γ₂ = (q−1)/{(8380417 - 1) / P.gamma2}. 크기: 공개키 {sz.pk.toLocaleString()} B, 서명 {sz.sig.toLocaleString()} B. 거절은 거의 다 앞의 두 검사에서 일어납니다. ‖z‖ 검사는 서명이 비밀 s₁ 을 흘리지 않게 하는 <b>거절 샘플링</b>이고, LowBits 검사는 검증자가 w 의 상위 비트를 똑같이 복원하도록 보장하는 <b>정확성 조건</b>입니다. (해시는 토이로 대신했지만 산술과 거절 통계는 실제와 같습니다.)</p>
    </div>
  );
}
