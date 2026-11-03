import { useState } from 'react';
import { egcdSteps, mod } from '../lib/algebra';

/** 확장 유클리드 알고리즘을 한 줄씩 보여 주고, 역원을 계산한다. */
export default function EuclidStepper() {
  const [q, setQ] = useState(3329);
  const [a, setA] = useState(17);
  const [shown, setShown] = useState(2);

  const qq = Math.max(2, Math.floor(q) || 2);
  const aa = Math.max(1, Math.floor(a) || 1);
  const rows = egcdSteps(qq, aa);
  const total = rows.length;
  const done = shown >= total;
  const g = rows[total - 2];
  const inverse = g.r === 1 ? mod(g.t, qq) : null;

  const reset = (nq: number, na: number) => { setQ(nq); setA(na); setShown(2); };

  return (
    <div className="widget not-content">
      <h4>확장 유클리드 알고리즘</h4>
      <p className="widget-sub">각 줄은 rᵢ = sᵢ·q + tᵢ·a 를 만족합니다. r 이 1 이 되는 순간 tᵢ 가 a 의 역원(mod q)입니다.</p>
      <div className="row">
        <label style={{ fontSize: '0.85rem' }}>q = <input type="number" value={q} min={2} onChange={(e) => reset(+e.target.value, a)} style={{ width: '6rem' }} /></label>
        <label style={{ fontSize: '0.85rem' }}>a = <input type="number" value={a} min={1} onChange={(e) => reset(q, +e.target.value)} style={{ width: '6rem' }} /></label>
        <button onClick={() => reset(3329, 17)}>ML-KEM: 17 mod 3329</button>
        <button onClick={() => reset(240, 46)}>gcd(240, 46)</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>i</th><th>몫</th><th>rᵢ</th><th>sᵢ</th><th>tᵢ</th><th>검산 sᵢ·q + tᵢ·a</th></tr></thead>
          <tbody>
            {rows.slice(0, shown).map((r, i) => (
              <tr key={i} style={r.r === g.r && i === total - 2 && done ? { background: 'var(--w-fill)' } : undefined}>
                <td>{i}</td><td>{r.quotient ?? '—'}</td><td>{r.r}</td><td>{r.s}</td><td>{r.t}</td><td>{r.s * qq + r.t * aa}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <button className="primary" onClick={() => setShown((s) => Math.min(total, s + 1))} disabled={done}>다음 단계</button>
        <button onClick={() => setShown(total)} disabled={done}>끝까지</button>
        <button onClick={() => setShown(2)}>처음부터</button>
      </div>
      {done && (
        <div className="stats">
          <div className="stat"><span>gcd(q, a)</span><b>{g.r}</b></div>
          <div className="stat"><span>베주 항등식</span><b>{g.s}·{qq} + {g.t}·{aa} = {g.r}</b></div>
          <div className="stat"><span>a⁻¹ mod q</span><b className={inverse !== null ? 'good' : 'bad'}>{inverse !== null ? `${inverse}` : '없음 (gcd ≠ 1)'}</b></div>
          {inverse !== null && <div className="stat"><span>검산</span><b>{aa}·{inverse} mod {qq} = {mod(aa * inverse, qq)}</b></div>}
        </div>
      )}
      <p className="note">단계 수는 대략 log(q) 에 비례합니다(Lamé 정리). 그래서 수천 자리 정수에서도 역원 계산은 순식간입니다.</p>
    </div>
  );
}
