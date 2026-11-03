import { useState } from 'react';
import { gcd, isPrime, mod, modInverse } from '../lib/algebra';

/**
 * ℤ_q 의 덧셈표·곱셈표 히트맵.
 * 곱셈표에서 a 의 행이 0..q−1 을 한 번씩 모두 지나면(순열이면) a 는 가역원이다.
 */
export default function ModTable() {
  const [q, setQ] = useState(12);
  const [op, setOp] = useState<'+' | '×'>('×');
  const [sel, setSel] = useState<[number, number] | null>([5, 7]);

  const f = (a: number, b: number) => (op === '+' ? mod(a + b, q) : mod(a * b, q));
  const units = Array.from({ length: q }, (_, a) => a).filter((a) => gcd(a, q) === 1);
  const zeroDiv = Array.from({ length: q - 1 }, (_, i) => i + 1).filter((a) => gcd(a, q) !== 1);
  const prime = isPrime(q);

  const S = 360, P = 22;
  const cell = (S - P) / q;
  const color = (v: number) => `hsl(${220 - (200 * v) / Math.max(1, q - 1)} 70% ${55}% / 0.85)`;
  const rowA = sel?.[0] ?? null;
  const inv = rowA !== null ? modInverse(rowA, q) : null;

  return (
    <div className="widget not-content">
      <h4>ℤ_q 의 연산표</h4>
      <p className="widget-sub">칸을 눌러 a {op} b 를 확인하세요. 곱셈표에서 한 행에 모든 색이 한 번씩 나오면 그 원소는 역원이 있습니다.</p>
      <div className="controls">
        <label className="slider">모듈러스 q <b>{q}</b> {prime ? '(소수)' : '(합성수)'}
          <input type="range" min={2} max={30} value={q} onChange={(e) => { setQ(+e.target.value); setSel(null); }} />
        </label>
        <div className="row">
          <button className={op === '+' ? 'primary' : ''} onClick={() => setOp('+')}>덧셈표</button>
          <button className={op === '×' ? 'primary' : ''} onClick={() => setOp('×')}>곱셈표</button>
          <button onClick={() => setQ(13)}>q = 13</button>
          <button onClick={() => setQ(12)}>q = 12</button>
        </div>
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 420, margin: '0 auto' }} role="img" aria-label={`ℤ_${q} ${op === '+' ? '덧셈' : '곱셈'}표`}>
        {Array.from({ length: q }, (_, a) => (
          <g key={a}>
            {q <= 20 && <text x={P - 4} y={P + a * cell + cell * 0.68} fontSize={Math.min(11, cell * 0.7)} textAnchor="end" fill={rowA === a ? 'var(--w-accent)' : 'var(--w-muted)'}>{a}</text>}
            {q <= 20 && <text x={P + a * cell + cell / 2} y={P - 6} fontSize={Math.min(11, cell * 0.7)} textAnchor="middle" fill="var(--w-muted)">{a}</text>}
            {Array.from({ length: q }, (_, b) => {
              const v = f(a, b);
              const isSel = sel && sel[0] === a && sel[1] === b;
              return (
                <rect key={b} x={P + b * cell} y={P + a * cell} width={cell - 0.6} height={cell - 0.6}
                  fill={op === '×' && v === 0 && a && b ? 'var(--w-bad)' : color(v)}
                  opacity={rowA === null || rowA === a ? 1 : 0.35}
                  stroke={isSel ? 'var(--w-text)' : 'none'} strokeWidth={2}
                  style={{ cursor: 'pointer' }} onClick={() => setSel([a, b])} />
              );
            })}
          </g>
        ))}
      </svg>
      <div className="stats">
        {sel && <div className="stat"><span>선택</span><b>{sel[0]} {op} {sel[1]} ≡ {f(sel[0], sel[1])} (mod {q})</b></div>}
        {op === '×' && rowA !== null && (
          <div className="stat"><span>{rowA} 의 역원</span><b className={inv !== null ? 'good' : 'bad'}>{inv !== null ? `${inv}  (${rowA}·${inv} ≡ 1)` : `없음 (gcd(${rowA}, ${q}) = ${gcd(rowA, q)})`}</b></div>
        )}
        <div className="stat"><span>가역원 개수 φ(q)</span><b>{units.length} / {q - 1}</b></div>
        <div className="stat"><span>영인자 (빨간 칸의 원인)</span><b>{zeroDiv.length ? zeroDiv.join(', ') : '없음 → ℤ_q 는 체'}</b></div>
      </div>
      <p className="note">곱셈표의 빨간 칸은 a·b ≡ 0 인데 a, b 가 모두 0 이 아닌 경우입니다. q 가 소수이면 빨간 칸이 하나도 없고, 0 이 아닌 모든 원소가 역원을 가집니다.</p>
    </div>
  );
}
