import { useState } from 'react';
import { crt, gcd, mod } from '../lib/algebra';

/**
 * ℤ_{mn} → ℤ_m × ℤ_n,  x ↦ (x mod m, x mod n) 를 격자에 그린다.
 * m, n 이 서로소이면 모든 칸이 정확히 한 번씩 채워진다(전단사).
 */
export default function CRTGrid() {
  const [m, setM] = useState(3);
  const [n, setN] = useState(5);
  const [x, setX] = useState(7);
  const [y, setY] = useState(11);
  const N = m * n;
  const coprime = gcd(m, n) === 1;

  const cells: Map<string, number[]> = new Map();
  for (let t = 0; t < N; t++) {
    const k = `${t % m},${t % n}`;
    cells.set(k, [...(cells.get(k) ?? []), t]);
  }
  const C = Math.min(46, 300 / Math.max(m, n));
  const W = n * C + 30, H = m * C + 30;
  const xx = mod(x, N), yy = mod(y, N);
  const sum = mod(xx + yy, N), prod = mod(xx * yy, N);
  const hl = new Map<number, string>([[xx, 'var(--w-b1)'], [yy, 'var(--w-b2)'], [prod, 'var(--w-gs)']]);

  return (
    <div className="widget not-content">
      <h4>중국인의 나머지 정리: ℤ<sub>{m * n}</sub> ≅ ℤ<sub>{m}</sub> × ℤ<sub>{n}</sub></h4>
      <p className="widget-sub">0 부터 {N - 1} 까지의 수 x 를 행 = x mod {m}, 열 = x mod {n} 인 칸에 넣습니다. 서로소일 때와 아닐 때를 비교해 보세요.</p>
      <div className="controls">
        <label className="slider">m <b>{m}</b><input type="range" min={2} max={8} value={m} onChange={(e) => setM(+e.target.value)} /></label>
        <label className="slider">n <b>{n}</b><input type="range" min={2} max={8} value={n} onChange={(e) => setN(+e.target.value)} /></label>
        <label className="slider">x (파랑) <b>{xx}</b><input type="range" min={0} max={N - 1} value={xx} onChange={(e) => setX(+e.target.value)} /></label>
        <label className="slider">y (주황) <b>{yy}</b><input type="range" min={0} max={N - 1} value={yy} onChange={(e) => setY(+e.target.value)} /></label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: Math.max(260, W * 1.2), margin: '0 auto' }} role="img" aria-label="CRT 격자">
        {Array.from({ length: n }, (_, j) => <text key={j} x={30 + j * C + C / 2} y={14} fontSize="11" textAnchor="middle" fill="var(--w-muted)">{j}</text>)}
        {Array.from({ length: m }, (_, i) => (
          <g key={i}>
            <text x={22} y={30 + i * C + C / 2 + 4} fontSize="11" textAnchor="end" fill="var(--w-muted)">{i}</text>
            {Array.from({ length: n }, (_, j) => {
              const v = cells.get(`${i},${j}`) ?? [];
              const c = v.length === 1 ? hl.get(v[0]) : undefined;
              return (
                <g key={j}>
                  <rect x={30 + j * C} y={24 + i * C} width={C - 2} height={C - 2} rx={4}
                    fill={v.length === 0 ? 'var(--w-surface)' : c ?? (v.length > 1 ? 'var(--w-bad)' : 'var(--w-fill)')}
                    opacity={c ? 0.9 : v.length > 1 ? 0.35 : 1} stroke="var(--w-border)" />
                  <text x={30 + j * C + C / 2 - 1} y={24 + i * C + C / 2 + 4} fontSize={v.length > 1 ? 9 : 12} textAnchor="middle" fill="var(--w-text)">
                    {v.length === 0 ? '·' : v.join(',')}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="stats">
        <div className="stat"><span>m, n 서로소?</span><b className={coprime ? 'good' : 'bad'}>{coprime ? '예 → 전단사' : `아니오 (gcd = ${gcd(m, n)})`}</b></div>
        <div className="stat"><span>x ↦</span><b>({xx % m}, {xx % n})</b></div>
        <div className="stat"><span>y ↦</span><b>({yy % m}, {yy % n})</b></div>
        <div className="stat"><span>x + y = {sum} ↦</span><b>({sum % m}, {sum % n})</b></div>
        <div className="stat"><span>x · y = {prod} (보라) ↦</span><b>({prod % m}, {prod % n})</b></div>
        {coprime && <div className="stat"><span>역방향 CRT({xx % m}, {xx % n})</span><b>{crt([xx % m, xx % n], [m, n])}</b></div>}
      </div>
      <p className="note">
        {coprime
          ? `각 성분에서 따로 더하고 곱한 결과가 x + y, x · y 의 성분과 일치합니다: 큰 환의 계산을 작은 환 여러 개로 나눠 할 수 있다는 뜻입니다. 이 아이디어를 다항식에 적용한 것이 NTT 입니다.`
          : `서로소가 아니면 어떤 칸은 비고(·), 어떤 칸에는 여러 수가 겹칩니다(빨강). 대응이 전단사가 아니므로 CRT 가 성립하지 않습니다.`}
      </p>
    </div>
  );
}
