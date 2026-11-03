import { useMemo, useState } from 'react';
import { mulMatrix } from '../lib/rlwe';
import { mulberry32 } from '../lib/lwe';

const Q = 97;
type Mode = 'lwe' | 'mlwe';

/**
 * LWE·Ring-LWE·Module-LWE 의 행렬 A 를 색으로 그린다.
 * 무작위 LWE 는 (nk)² 개의 독립된 수, Module-LWE 는 k² 개 블록 각각이 다항식 하나(n 개의 수)로 정해지는 negacyclic 행렬.
 */
export default function StructureMatrix() {
  const [n, setN] = useState(8);
  const [k, setK] = useState(2);
  const [mode, setMode] = useState<Mode>('mlwe');
  const [seed, setSeed] = useState(1);
  const N = n * k;
  const A = useMemo(() => {
    const r = mulberry32(seed * 31 + n * 7 + k);
    if (mode === 'lwe') return Array.from({ length: N }, () => Array.from({ length: N }, () => Math.floor(r() * Q)));
    const blocks = Array.from({ length: k }, () => Array.from({ length: k }, () => mulMatrix(Array.from({ length: n }, () => Math.floor(r() * Q)), Q, 'nega')));
    return Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => blocks[Math.floor(i / n)][Math.floor(j / n)][i % n][j % n]));
  }, [n, k, mode, seed]);
  const S = 360, cell = S / N;
  const color = (v: number) => `hsl(${(v * 360) / Q} 65% 55%)`;
  const indep = mode === 'lwe' ? N * N : k * k * n;
  const full = 768;
  return (
    <div className="widget not-content">
      <h4>구조의 모양: 행렬 A 는 몇 개의 수로 정해지나</h4>
      <p className="widget-sub">색 = 성분 값(mod {Q}). Module-LWE 에서는 각 n×n 블록이 다항식 하나의 ‘곱셈 행렬’이라 대각선 방향으로 같은 색이 흐르고, 블록을 넘어갈 때(xⁿ = −1) 부호가 바뀝니다.</p>
      <div className="row">
        <button className={mode === 'lwe' ? 'primary' : ''} onClick={() => setMode('lwe')}>LWE (무작위)</button>
        <button className={mode === 'mlwe' ? 'primary' : ''} onClick={() => setMode('mlwe')}>{k === 1 ? 'Ring-LWE' : `Module-LWE (k = ${k})`}</button>
        <button onClick={() => setSeed((s) => s + 1)}>새 A</button>
      </div>
      <div className="controls">
        <label className="slider">다항식 차수 n <b>{n}</b>
          <select value={n} onChange={(e) => setN(+e.target.value)}>{[4, 8, 16].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label>
        <label className="slider">모듈 랭크 k <b>{k}</b> (k = 1 이면 Ring-LWE)
          <input type="range" min={1} max={3} value={k} onChange={(e) => setK(+e.target.value)} />
        </label>
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 380, margin: '0 auto' }} role="img" aria-label="행렬 A">
        {A.map((row, i) => row.map((v, j) => <rect key={`${i}-${j}`} x={j * cell} y={i * cell} width={cell + 0.3} height={cell + 0.3} fill={color(v)} />))}
        {mode === 'mlwe' && Array.from({ length: k + 1 }, (_, t) => <g key={t}><line x1={t * n * cell} x2={t * n * cell} y1={0} y2={S} stroke="var(--w-bg)" strokeWidth={2.5} /><line y1={t * n * cell} y2={t * n * cell} x1={0} x2={S} stroke="var(--w-bg)" strokeWidth={2.5} /></g>)}
      </svg>
      <div className="stats">
        <div className="stat"><span>전체 차원 nk</span><b>{N}</b></div>
        <div className="stat"><span>A 를 정하는 독립된 수</span><b>{indep.toLocaleString()} {mode === 'lwe' ? '= (nk)²' : '= k²·n'}</b></div>
        <div className="stat"><span>A·s 곱셈 (교과서식 / NTT)</span><b>{mode === 'lwe' ? `${(N * N).toLocaleString()} 곱` : `${(k * k * n * n).toLocaleString()} / ≈${Math.round(k * k * n * Math.log2(n)).toLocaleString()}`}</b></div>
        <div className="stat"><span>실제 크기: ML-KEM-768 (n=256, k=3)</span><b>{(9 * 256).toLocaleString()} vs LWE {(full * full).toLocaleString()}</b></div>
      </div>
      <p className="note">실제 ML-KEM 은 A 를 32바이트 시드에서 생성하므로 키 크기는 시드 덕분에 이미 작습니다. 구조의 이득은 주로 <b>계산</b>(NTT 로 nk·log n 수준)과 <b>표본 하나당 n 개의 식</b>에서 옵니다. 대가는 안전성이 ‘구조화된’ 문제에 기댄다는 점입니다.</p>
    </div>
  );
}
