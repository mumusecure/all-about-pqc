import { useDeferredValue, useMemo, useState } from 'react';
import { type LWEParams, PRESETS, costModels, dualAttack, primalUSVP, sigmaTernary } from '../lib/estimator';

type SecretKind = 'same' | 'ternary';

/**
 * 작은 lattice estimator: primal(uSVP)과 dual 의 최적 β 와 세 가지 비용 모델.
 * 보안 비트 = 공격들 중 가장 싼 것.
 */
export default function AttackTable() {
  const [P, setP] = useState<LWEParams>(PRESETS['ML-KEM-768']);
  const [secret, setSecret] = useState<SecretKind>('same');
  const [name, setName] = useState('ML-KEM-768');
  const Q: LWEParams = { ...P, sigmaS: secret === 'same' ? P.sigmaE : sigmaTernary };
  const dq = useDeferredValue(Q);
  const res = useMemo(() => {
    const p = primalUSVP(dq, 16), d = dualAttack(dq, 16);
    return { p, d };
  }, [dq.n, dq.logq, dq.sigmaE, dq.sigmaS, dq.mMax]);
  const set = (k: keyof LWEParams) => (e: React.ChangeEvent<HTMLInputElement>) => { setName('사용자 설정'); setP({ ...P, [k]: +e.target.value, ...(k === 'n' ? { mMax: +e.target.value } : {}) }); };
  const rows = [
    res.p && { name: 'primal (uSVP)', beta: res.p.beta, m: res.p.m, c: costModels(res.p.beta, res.p.d), extra: 0 },
    res.d && { name: 'dual', beta: res.d.beta, m: res.d.m, c: costModels(res.d.beta, res.d.d), extra: res.d.extra ?? 0 },
  ].filter(Boolean) as { name: string; beta: number; m: number; c: ReturnType<typeof costModels>; extra: number }[];
  const minCls = Math.min(...rows.map((r) => r.c.classical + r.extra));
  const sigmaQ = Math.log2(Q.sigmaE) - Q.logq;
  return (
    <div className="widget not-content">
      <h4>작은 추정기: 이 파라미터는 몇 비트인가</h4>
      <p className="widget-sub">LWE(n 차원 비밀, 모듈러스 q, 오차 표준편차 σ, 표본 최대 m)에 대해 primal 과 dual 공격의 최적 블록 크기 β 를 구하고, β 를 세 비용 모델로 비트로 바꿉니다. ML-KEM 은 키 복구 문제(MLWE 를 nk 차원 LWE 로 본 것)입니다.</p>
      <div className="row">
        {Object.keys(PRESETS).map((k) => <button key={k} className={name === k ? 'primary' : ''} onClick={() => { setName(k); setP(PRESETS[k]); setSecret(k === 'HE-1024' ? 'ternary' : 'same'); }}>{k}</button>)}
      </div>
      <div className="controls">
        <label className="slider">비밀 차원 n <b>{P.n}</b><input type="range" min={256} max={1536} step={64} value={P.n} onChange={set('n')} /></label>
        <label className="slider">log₂ q <b>{P.logq.toFixed(2)}</b><input type="range" min={8} max={32} step={0.25} value={P.logq} onChange={set('logq')} /></label>
        <label className="slider">오차 σ <b>{P.sigmaE.toFixed(2)}</b><input type="range" min={0.5} max={8} step={0.05} value={P.sigmaE} onChange={set('sigmaE')} /></label>
        <label className="slider">비밀 분포
          <select value={secret} onChange={(e) => { setName('사용자 설정'); setSecret(e.target.value as SecretKind); }}>
            <option value="same">오차와 같음 (정규형)</option>
            <option value="ternary">균등 삼진 {'{−1, 0, 1}'}</option>
          </select>
        </label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'right', color: 'var(--w-muted)' }}><th style={{ textAlign: 'left' }}>공격</th><th>β</th><th>m</th><th>core-SVP 고전</th><th>core-SVP 양자</th><th>반복 포함</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} style={{ textAlign: 'right', borderTop: '1px solid var(--w-border)', fontWeight: r.c.classical + r.extra === minCls ? 700 : 400 }}>
                <td style={{ textAlign: 'left' }}>{r.name}</td><td>{r.beta}</td><td>{r.m}</td>
                <td>{(r.c.classical + r.extra).toFixed(1)}</td><td>{(r.c.quantum + r.extra).toFixed(1)}</td><td>{(r.c.withTours + r.extra).toFixed(1)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6}>β ≥ 50 범위에서 공격을 찾지 못함 (너무 쉽거나 너무 큼)</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="stats">
        <div className="stat"><span>보안 (core-SVP 고전, 최솟값)</span><b>{rows.length ? `${minCls.toFixed(1)} 비트` : '—'}</b></div>
        <div className="stat"><span>오차율 log₂(σ/q)</span><b>{sigmaQ.toFixed(1)}</b></div>
        <div className="stat"><span>비밀 σ_s</span><b>{Q.sigmaS.toFixed(3)}</b></div>
      </div>
      <p className="note">세 열은 같은 β 를 다르게 셉니다: core-SVP 는 β 차원 체 한 번(2^0.292β, 양자 2^0.265β), "반복 포함" 은 8d·2^(0.292β+16.4) 처럼 BKZ 바퀴와 상수를 넣은 모델. 같은 파라미터가 모델에 따라 30 비트 가까이 달라집니다. 동형암호 예(n = 1024, q = 2²⁷)는 core-SVP 로 약 101 비트지만 반복 포함 모델로는 130 비트 근처라, "128 비트" 라는 말이 어느 모델 기준인지 늘 확인해야 합니다. 이 dual 은 가장 단순한 판이고, 최신 dual 변형과 하이브리드는 여기서 다루지 않습니다.</p>
    </div>
  );
}
