import { useState } from 'react';
import { mulberry32 } from '../lib/lwe';
import { type NTRUAttack, ntruAttack, ntruKeyGen } from '../lib/ntru';

interface Row { n: number; q: number; r: NTRUAttack; }

/**
 * NTRU 격자(차원 2n, 부피 qⁿ)에 LLL 을 돌려 비밀키 (g, f) 의 회전을 찾는다.
 * 성공하면 축소 기저의 로그 노름 프로파일이 n 번째에서 ‘절벽’처럼 뛴다: 앞 n 개가 회전들이 펼치는 밀집 부분격자.
 */
export default function NTRUAttackLab() {
  const [n, setN] = useState(32);
  const [q, setQ] = useState(257);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const r = ntruAttack(ntruKeyGen(n, q, mulberry32(Date.now() % 1e9)));
      setRows((rs) => [{ n, q, r }, ...rs].slice(0, 10));
      setBusy(false);
    }, 30);
  };
  const last = rows[0];

  const W = 620, H = 170, L = 40, R = 10, T = 10, B = 22;
  let chart = null;
  if (last) {
    const ln = last.r.logNorms;
    const hi = Math.ceil(Math.max(...ln)) + 1, lo = Math.floor(Math.min(...ln)) - 1;
    const X = (i: number) => L + ((W - L - R) * i) / (ln.length - 1);
    const Y = (v: number) => T + ((H - T - B) * (hi - v)) / (hi - lo);
    chart = (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="축소 기저의 로그 노름">
        {[lo, (lo + hi) / 2, hi].map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--w-grid)" /><text x={L - 5} y={Y(t) + 4} fontSize="10" textAnchor="end" fill="var(--w-muted)">{t.toFixed(0)}</text></g>)}
        <line x1={X(last.n - 0.5)} x2={X(last.n - 0.5)} y1={T} y2={H - B} stroke="var(--w-bad)" strokeDasharray="4 3" />
        <text x={X(last.n - 0.5) + 4} y={T + 12} fontSize="11" fill="var(--w-bad)">i = n</text>
        <line x1={L} x2={W - R} y1={Y(Math.log2(last.r.gh))} y2={Y(Math.log2(last.r.gh))} stroke="var(--w-muted)" strokeDasharray="2 3" />
        <text x={W - R} y={Y(Math.log2(last.r.gh)) - 4} fontSize="10" textAnchor="end" fill="var(--w-muted)">GH</text>
        {ln.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r={2.4} fill={i < last.n ? 'var(--w-b1)' : 'var(--w-b2)'} />)}
        <text x={L} y={H - 6} fontSize="10" fill="var(--w-muted)">i = 1 (log₂‖bᵢ‖)</text>
        <text x={W - R} y={H - 6} fontSize="10" textAnchor="end" fill="var(--w-muted)">i = 2n</text>
      </svg>
    );
  }

  return (
    <div className="widget not-content">
      <h4>실험실: LLL 로 NTRU 비밀키 찾기</h4>
      <p className="widget-sub">토이 NTRU 키를 만들고 NTRU 격자(차원 2n)에 LLL(δ = 0.99)을 돌립니다. q 가 클수록 공격이 쉬워지는 것(overstretched 쪽으로)을 확인해 보세요.</p>
      <div className="controls">
        <label className="slider">차수 n <b>{n}</b> (격자 차원 {2 * n})
          <input type="range" min={8} max={64} step={8} value={n} onChange={(e) => setN(+e.target.value)} />
        </label>
        <label className="slider">모듈러스 q <b>{q}</b>
          <select value={q} onChange={(e) => setQ(+e.target.value)}>{[257, 3329, 65537, 1048583].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label>
      </div>
      <div className="row">
        <button className="primary" onClick={go} disabled={busy}>{busy ? 'LLL 실행 중…' : '공격 실행'}</button>
        <button onClick={() => setRows([])} disabled={busy}>기록 지우기</button>
      </div>
      {chart}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>n</th><th>q</th><th>‖(g,f)‖</th><th>GH</th><th>gap</th><th>b₁ = 키 회전?</th><th>앞 n 개 중 회전</th><th>시간</th></tr></thead>
            <tbody>
              {rows.map(({ n: nn, q: qq, r }, i) => (
                <tr key={i}>
                  <td>{nn}</td><td>{qq}</td><td>{r.keyNorm.toFixed(1)}</td><td>{r.gh.toFixed(1)}</td><td>{(r.gh / r.keyNorm).toFixed(1)}</td>
                  <td className={r.b1IsKey ? 'good' : 'bad'}>{r.b1IsKey ? '예' : '아니오'}</td>
                  <td>{r.rotationsInFirstN}/{nn}</td><td>{r.ms.toFixed(0)}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">gap = GH ÷ ‖(g, f)‖ ≈ √(q/(2πe))·(상수) 이므로 q 에 따라 커집니다. 성공하면 파란 점(앞 n 개)과 주황 점(뒤 n 개) 사이에 절벽이 생깁니다. ‘앞 n 개 중 회전’ 은 xⁱ·(g, f) 그 자체인 벡터 수이고, 나머지도 대부분 회전들의 짧은 정수 결합입니다.</p>
    </div>
  );
}
