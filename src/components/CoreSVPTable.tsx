import { useMemo, useState } from 'react';
import { dualAttack, primalUSVP, sigmaCBD } from '../lib/estimator';

/**
 * 논문 읽기 2: ADPS16 의 보안 분석 표를 이 교과서의 추정기로 다시 만든다.
 * core-SVP = 블록 크기 β 의 SVP 한 번의 비용만 센다: 고전 0.292β, 양자 0.265β, 가장 보수적 0.2075β.
 */
const PRESETS = [
  { key: 'newhope', label: 'NewHope', n: 1024, q: 12289, sigma: Math.sqrt(8), note: 'ψ₁₆ (σ = √8)' },
  { key: 'jarjar', label: 'JarJar', n: 512, q: 12289, sigma: Math.sqrt(12), note: 'ψ₂₄ (σ = √12)' },
  { key: 'mlkem512', label: 'ML-KEM-512', n: 512, q: 3329, sigma: sigmaCBD(3), note: 'CBD₃, 모듈 k = 2' },
  { key: 'mlkem768', label: 'ML-KEM-768', n: 768, q: 3329, sigma: sigmaCBD(2), note: 'CBD₂, k = 3' },
  { key: 'mlkem1024', label: 'ML-KEM-1024', n: 1024, q: 3329, sigma: sigmaCBD(2), note: 'CBD₂, k = 4' },
];

export default function CoreSVPTable() {
  const [key, setKey] = useState('newhope');
  const [twoN, setTwoN] = useState(true);
  const P = PRESETS.find((p) => p.key === key)!;
  const r = useMemo(() => {
    const L = { n: P.n, logq: Math.log2(P.q), sigmaS: P.sigma, sigmaE: P.sigma, mMax: twoN ? 2 * P.n : P.n };
    return { p: primalUSVP(L, 8), d: dualAttack(L, 8) };
  }, [key, twoN]);
  const rows = [
    r.p && { name: 'primal (uSVP)', beta: r.p.beta, m: r.p.m, c: 0.292 * r.p.beta, qq: 0.265 * r.p.beta, pl: 0.2075 * r.p.beta },
    r.d && { name: 'dual (구별)', beta: r.d.beta, m: r.d.m, c: r.d.cost, qq: 0.265 * r.d.beta + (r.d.extra ?? 0), pl: 0.2075 * r.d.beta + (r.d.extra ?? 0) },
  ].filter(Boolean) as { name: string; beta: number; m: number; c: number; qq: number; pl: number }[];
  return (
    <div className="widget not-content">
      <h4>core-SVP 표 다시 만들기</h4>
      <p className="widget-sub">ADPS16 의 방법 그대로: 표본 수 m 을 최적화해 primal 성공 조건 σ√β ≤ δ^(2β−d)·vol^(1/d) 를 만족하는 최소 β, dual 은 짧은 쌍대 벡터의 구별 이점과 반복 횟수까지 넣은 최소 비용. 비용은 β 차원 SVP 한 번만 셉니다.</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {PRESETS.map((p) => <button key={p.key} className={key === p.key ? 'primary' : ''} onClick={() => setKey(p.key)}>{p.label}</button>)}
      </div>
      <div className="row">
        <label><input type="checkbox" checked={twoN} onChange={(e) => setTwoN(e.target.checked)} /> 표본 m ≤ 2n 허용 (끄면 m ≤ n)</label>
      </div>
      <p className="widget-sub">n = {P.n}, q = {P.q}, {P.note}, σ ≈ {P.sigma.toFixed(3)}</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>공격</th><th>β</th><th>m</th><th>고전 0.292β</th><th>양자 0.265β</th><th>보수적 0.2075β</th></tr></thead>
          <tbody>{rows.map((x) => <tr key={x.name}><td>{x.name}</td><td>{x.beta}</td><td>{x.m}</td><td>{x.c.toFixed(1)}</td><td>{x.qq.toFixed(1)}</td><td>{x.pl.toFixed(1)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="note">dual 행의 비용에는 반복 횟수 log₂ max(1, 1/(ε²·2^0.2075β)) 가 더해져 있습니다. NewHope 에서는 두 공격이 거의 같은 β(960 대)를 주고, 양자 core-SVP 가 약 255 비트입니다. ML-KEM 은 표본 수가 모듈 구조로 n 개(공개키) 남짓으로 제한되므로 m ≤ n 이 더 현실적이고, 그때 ML-KEM-512 의 primal β 는 406, core-SVP 118.6 비트로 Lab 5 와 같습니다. 숫자가 논문 표와 1~2 정도 다를 수 있는 것은 δ_β 공식과 m·β 탐색 간격 같은 세부 때문입니다.</p>
    </div>
  );
}
