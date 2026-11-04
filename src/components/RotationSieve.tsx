import { useState } from 'react';
import { idealSieve, l2, principalIdeal } from '../lib/modules';
import { mulberry32 } from '../lib/lwe';

interface Run { n: number; plain: ReturnType<typeof idealSieve> & { ms: number }; rot: ReturnType<typeof idealSieve> & { ms: number }; g: number; }

/**
 * 이데알 격자에서 짧은 벡터 v 를 찾으면 xⁱv (i < n) 와 그 부호가 모두 같은 길이의 격자 벡터다.
 * Gauss sieve 의 목록에 대표 하나만 두고 회전 전체를 쓰면 메모리가 약 1/(2n) 로 준다. 이득은 다항 인자.
 */
export default function RotationSieve() {
  const [n, setN] = useState(24);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const r = mulberry32(n + 7), g = Array.from({ length: n }, () => Math.floor(r() * 41) - 20);
      const B = principalIdeal(g);
      let t = performance.now();
      const plain = { ...idealSieve(B, false, 300, 1), ms: performance.now() - t };
      t = performance.now();
      const rot = { ...idealSieve(B, true, 300, 1), ms: performance.now() - t };
      setRuns((rs) => [...rs.filter((x) => x.n !== n), { n, plain, rot, g: l2(g) }].sort((a, b) => a.n - b.n));
      setBusy(false);
    }, 20);
  };
  return (
    <div className="widget not-content">
      <h4>대칭을 쓰는 체: 이데알 격자의 회전</h4>
      <p className="widget-sub">주이데알 gR (R = ℤ[x]/(xⁿ+1), 차원 n) 에 Gauss sieve 를 두 번 돌립니다. 보통 판은 목록의 벡터를 그대로 쓰고, 회전 판은 목록의 각 벡터 w 를 ±xⁱw 전체(2n 개)로 취급해 대표 하나만 저장합니다.</p>
      <div className="row">
        {[16, 24, 32].map((v) => <button key={v} className={n === v ? 'primary' : ''} disabled={busy} onClick={() => setN(v)}>n = {v}</button>)}
        <button className="primary" disabled={busy} onClick={go}>{busy ? '체 치는 중…' : '두 판 비교'}</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <thead><tr style={{ color: 'var(--w-muted)', textAlign: 'right' }}><th style={{ textAlign: 'left' }}>n</th><th>찾은 길이</th><th>최대 목록 (보통 → 회전)</th><th>줄어든 배수</th><th>시간 (보통 → 회전)</th></tr></thead>
          <tbody>{runs.map((r) => (
            <tr key={r.n} style={{ borderTop: '1px solid var(--w-border)', textAlign: 'right' }}>
              <td style={{ textAlign: 'left' }}>{r.n}</td>
              <td>{r.plain.norm.toFixed(1)} / {r.rot.norm.toFixed(1)}</td>
              <td>{r.plain.maxList} → {r.rot.maxList}</td>
              <td>{(r.plain.maxList / r.rot.maxList).toFixed(1)}×</td>
              <td>{r.plain.ms.toFixed(0)} → {r.rot.ms.toFixed(0)} ms</td>
            </tr>
          ))}
          {!runs.length && <tr><td colSpan={5} style={{ color: 'var(--w-muted)' }}>‘두 판 비교’ 를 눌러 보세요 (n = 32 는 1~2 초)</td></tr>}</tbody>
        </table>
      </div>
      <p className="note">두 판이 같은 최단 벡터를 찾고, 회전 판의 목록은 n 이 클수록 더 많이(대략 n 에 비례해) 작아집니다. 대신 비교 한 번이 2n 번의 비교라 시간은 비슷합니다. 이것이 대수 구조가 일반 격자 알고리즘에 주는 전형적인 이득입니다: <b>다항 인자</b>(메모리·시간 n 배 안팎)이지 지수적이 아닙니다. 그래서 Ring/Module-LWE 의 보안 추정은 구조를 무시한 18장의 추정에서 몇 비트를 빼는 정도로 충분하다고 여겨집니다.</p>
    </div>
  );
}
