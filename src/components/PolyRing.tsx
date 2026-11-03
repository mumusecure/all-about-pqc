import { useState } from 'react';
import { centerMod } from '../lib/lwe';
import { mod, negacyclicRoots, polyEval, polyMulNegacyclic } from '../lib/algebra';
import { mulberry32 } from '../lib/lwe';

const Q = 17;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (k: number) => String(k).split('').map((d) => SUP[+d]).join('');

function Bars({ label, p, color, hl }: { label: string; p: number[]; color: string; hl?: number }) {
  const n = p.length;
  const W = 300, H = 112, mid = 52, sc = 40 / 8;
  const bw = (W - 40) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 520 }} role="img" aria-label={`${label} = ${p.join(', ')}`}>
      <text x={0} y={mid + 4} fontSize="13" fontWeight="700" fill="var(--w-text)">{label}</text>
      <line x1={36} x2={W} y1={mid} y2={mid} stroke="var(--w-grid)" />
      {p.map((c, i) => {
        const v = centerMod(c, Q);
        const h = Math.max(1, Math.abs(v) * sc);
        return (
          <g key={i}>
            <rect x={38 + i * bw} y={v >= 0 ? mid - h : mid} width={bw - 4} height={h} rx={2} fill={i === hl ? 'var(--w-bad)' : color} opacity={0.85} />
            <text x={38 + i * bw + (bw - 4) / 2} y={v >= 0 ? mid - h - 3 : mid + h + 11} fontSize="10" textAnchor="middle" fill="var(--w-text)">{v}</text>
            <text x={38 + i * bw + (bw - 4) / 2} y={H - 2} fontSize="10" textAnchor="middle" fill="var(--w-muted)">{i === 0 ? '1' : i === 1 ? 'x' : `x${sup(i)}`}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * 몫환 ℤ_17[x]/(xⁿ + 1).
 * (1) x 를 곱하면 계수가 한 칸씩 돌고, 맨 끝에서 넘어온 계수는 부호가 바뀐다 (xⁿ = −1).
 * (2) CRT 관점: xⁿ + 1 의 근 ω 에서의 값 f(ω) 끼리 곱하면 곱 f·g 의 값이 된다 → NTT 의 원리.
 */
export default function PolyRing() {
  const [n, setN] = useState(4);
  const [f, setF] = useState<number[]>([1, 2, 0, 0]);
  const [g, setG] = useState<number[]>([3, 0, 1, 0]);
  const [wrapped, setWrapped] = useState<number | undefined>(undefined);
  const [seed, setSeed] = useState(1);

  const setDim = (k: number) => {
    setN(k);
    setF([1, 2, ...new Array(k - 2).fill(0)]);
    setG([3, 0, 1, ...new Array(k - 3).fill(0)]);
    setWrapped(undefined);
  };
  const timesX = () => {
    setF((p) => [mod(-p[p.length - 1], Q), ...p.slice(0, -1)]);
    setWrapped(0);
  };
  const randomize = () => {
    const r = mulberry32(seed * 977 + n);
    const small = () => Math.floor(r() * 5) - 2;
    setF(Array.from({ length: n }, () => mod(small(), Q)));
    setG(Array.from({ length: n }, () => mod(small(), Q)));
    setSeed((s) => s + 1);
    setWrapped(undefined);
  };

  const h = polyMulNegacyclic(f, g, Q);
  const roots = negacyclicRoots(n, Q);
  const show = (p: number[]) => p.map((c, i) => ({ c: centerMod(c, Q), i })).filter((t) => t.c !== 0)
    .map(({ c, i }) => `${c < 0 ? '−' : '+'} ${Math.abs(c) === 1 && i > 0 ? '' : Math.abs(c)}${i === 0 ? '' : i === 1 ? 'x' : `x${sup(i)}`}`)
    .join(' ').replace(/^\+ /, '').replace(/^− /, '−') || '0';

  return (
    <div className="widget not-content">
      <h4>다항식 환 ℤ₁₇[x]/(xⁿ + 1)</h4>
      <p className="widget-sub">ML-KEM 이 계산하는 세계의 축소판입니다(ML-KEM 은 ℤ₃₃₂₉[x]/(x²⁵⁶ + 1)). ‘f × x’ 를 여러 번 눌러 보세요.</p>
      <div className="row">
        <button className={n === 4 ? 'primary' : ''} onClick={() => setDim(4)}>n = 4</button>
        <button className={n === 8 ? 'primary' : ''} onClick={() => setDim(8)}>n = 8</button>
        <button onClick={timesX}>f × x</button>
        <button onClick={randomize}>작은 무작위 f, g</button>
      </div>
      <Bars label="f" p={f} color="var(--w-b1)" hl={wrapped} />
      <Bars label="g" p={g} color="var(--w-b2)" />
      <Bars label="f·g" p={h} color="var(--w-gs)" />
      <div className="log">
        <div>f = {show(f)}</div>
        <div>g = {show(g)}</div>
        <div>f·g mod (xⁿ+1, 17) = {show(h)}</div>
      </div>
      {wrapped !== undefined && <p className="note">빨간 막대: 방금 x⁰ 자리로 넘어온 계수. xⁿ = −1 이므로 부호가 바뀌었습니다.</p>}

      <h4 style={{ marginTop: '1rem' }}>CRT 관점: 근에서의 값으로 곱하기</h4>
      <p className="widget-sub">17 ≡ 1 (mod 2n) 이므로 xⁿ + 1 은 ℤ₁₇ 에서 서로 다른 일차식 n 개로 쪼개집니다. 근 ω 에서 값만 곱해도 f·g 가 완전히 정해집니다.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>근 ω</th><th>f(ω)</th><th>g(ω)</th><th>f(ω)·g(ω)</th><th>(f·g)(ω)</th><th>일치</th></tr></thead>
          <tbody>
            {roots.map((w) => {
              const a = polyEval(f, w, Q), b = polyEval(g, w, Q), p = mod(a * b, Q), c = polyEval(h, w, Q);
              return <tr key={w}><td>{w}</td><td>{a}</td><td>{b}</td><td>{p}</td><td>{c}</td><td className={p === c ? 'good' : 'bad'}>{p === c ? '✓' : '✗'}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="note">교과서식 곱셈은 n² 번의 곱이 필요하지만, ‘값으로 바꾸기 → 점별 곱 n 번 → 되돌리기’를 빠르게(n log n) 하면 훨씬 빠릅니다. 이것이 16장의 NTT 입니다.</p>
    </div>
  );
}
