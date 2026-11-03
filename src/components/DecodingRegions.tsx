import { useMemo, useRef, useState } from 'react';
import { type Basis, type Vec, babaiNearestPlane, babaiRound, closestVector2D, gramSchmidt, norm, sub, voronoiCell2D } from '../lib/lattice';

const bases: { label: string; B: Basis }[] = [
  { label: '좋은 기저 (3,1), (−1,2)', B: [[3, 1], [-1, 2]] },
  { label: '나쁜 기저 (11,6), (19,11)', B: [[11, 6], [19, 11]] },
];
type Alg = 'round' | 'plane' | 'exact';
const algs: { key: Alg; label: string }[] = [
  { key: 'round', label: 'Babai 반올림' },
  { key: 'plane', label: 'Babai 최근접 평면' },
  { key: 'exact', label: '정확한 CVP' },
];

/**
 * 디코딩 영역: 평면의 각 점 t 를 알고리즘으로 복호했을 때 정답(가장 가까운 격자점)이 나오면 초록, 아니면 빨강.
 * 원점 주변의 ‘복호 영역’ 모양: 반올림 = 평행사변형 P₁/₂(B), 최근접 평면 = 직사각형 P₁/₂(B*), 정확 = 보로노이 셀.
 */
export default function DecodingRegions() {
  const [bi, setBi] = useState(1);
  const [alg, setAlg] = useState<Alg>('round');
  const [t, setT] = useState<Vec>([2.5, 2.4]);
  const ref = useRef<SVGSVGElement>(null);
  const B = bases[bi].B;
  const R = 6, S = 360, G = 64;
  const P = (v: Vec): [number, number] => [S / 2 + (v[0] * S) / (2 * R), S / 2 - (v[1] * S) / (2 * R)];
  const decode = (x: Vec) => (alg === 'round' ? babaiRound(B, x) : alg === 'plane' ? babaiNearestPlane(B, x) : closestVector2D(B, x));

  const grid = useMemo(() => {
    const cells: { x: number; y: number; ok: boolean }[] = [];
    let ok = 0;
    for (let i = 0; i < G; i++)
      for (let j = 0; j < G; j++) {
        const x: Vec = [-R + ((i + 0.5) * 2 * R) / G, -R + ((j + 0.5) * 2 * R) / G];
        const good = norm(sub(decode(x), closestVector2D(B, x))) < 1e-9;
        ok += +good;
        cells.push({ x: x[0], y: x[1], ok: good });
      }
    return { cells, rate: ok / (G * G) };
  }, [bi, alg]);

  const region = useMemo(() => {
    if (alg === 'exact') return voronoiCell2D(B);
    const V: Basis = alg === 'round' ? B : gramSchmidt(B).bstar;
    return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([a, b]) => [a * V[0][0] + b * V[1][0], a * V[0][1] + b * V[1][1]]);
  }, [bi, alg]);

  const pts: Vec[] = [];
  for (let a = -12; a <= 12; a++) for (let b = -12; b <= 12; b++) {
    const v = [a * B[0][0] + b * B[1][0], a * B[0][1] + b * B[1][1]];
    if (Math.abs(v[0]) <= R && Math.abs(v[1]) <= R) pts.push(v);
  }
  const out = decode(t), best = closestVector2D(B, t);
  const cw = S / G;

  const click = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setT([(((e.clientX - r.left) / r.width) * S - S / 2) * (2 * R) / S, (S / 2 - ((e.clientY - r.top) / r.height) * S) * (2 * R) / S]);
  };
  const o = P([0, 0]), pt = P(t), po = P(out), pb = P(best);

  return (
    <div className="widget not-content">
      <h4>디코딩 영역: 좋은 기저 vs 나쁜 기저</h4>
      <p className="widget-sub">평면의 각 점을 ‘가장 가까운 격자점’으로 복호합니다. 초록 = 정답, 빨강 = 오답. 그림을 눌러 목표점 t 를 옮겨 보세요.</p>
      <div className="row">{bases.map((b, i) => <button key={i} className={i === bi ? 'primary' : ''} onClick={() => setBi(i)}>{b.label}</button>)}</div>
      <div className="row">{algs.map((a) => <button key={a.key} className={a.key === alg ? 'primary' : ''} onClick={() => setAlg(a.key)}>{a.label}</button>)}</div>
      <svg ref={ref} viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 420, margin: '0 auto', cursor: 'crosshair' }} onClick={click} role="img" aria-label={`복호 성공률 ${(grid.rate * 100).toFixed(0)}%`}>
        {grid.cells.map((c, i) => { const [x, y] = P([c.x, c.y]); return <rect key={i} x={x - cw / 2} y={y - cw / 2} width={cw + 0.3} height={cw + 0.3} fill={c.ok ? 'var(--w-good)' : 'var(--w-bad)'} opacity={0.22} />; })}
        <polygon points={region.map((p) => P(p).join(',')).join(' ')} fill="var(--w-b1)" fillOpacity={0.25} stroke="var(--w-b1)" strokeWidth={2} />
        {pts.map((v, i) => { const [x, y] = P(v); return <circle key={i} cx={x} cy={y} r={3} fill="var(--w-text)" />; })}
        <line x1={o[0]} y1={o[1]} x2={P(B[0])[0]} y2={P(B[0])[1]} stroke="var(--w-b1)" strokeWidth={2} strokeDasharray="4 3" />
        <line x1={o[0]} y1={o[1]} x2={P(B[1])[0]} y2={P(B[1])[1]} stroke="var(--w-b2)" strokeWidth={2} strokeDasharray="4 3" />
        <line x1={pt[0]} y1={pt[1]} x2={pb[0]} y2={pb[1]} stroke="var(--w-good)" strokeWidth={2} />
        <line x1={pt[0]} y1={pt[1]} x2={po[0]} y2={po[1]} stroke={norm(sub(out, best)) < 1e-9 ? 'var(--w-good)' : 'var(--w-bad)'} strokeWidth={2} strokeDasharray="5 3" />
        <circle cx={pt[0]} cy={pt[1]} r={5} fill="var(--w-gs)" stroke="var(--w-bg)" strokeWidth={1.5} />
      </svg>
      <div className="stats">
        <div className="stat"><span>목표점 t</span><b>({t[0].toFixed(2)}, {t[1].toFixed(2)})</b></div>
        <div className="stat"><span>알고리즘 출력</span><b>({out.map((x) => +x.toFixed(2)).join(', ')})</b></div>
        <div className="stat"><span>정답 (가장 가까운 점)</span><b>({best.map((x) => +x.toFixed(2)).join(', ')})</b></div>
        <div className="stat"><span>판정</span><b className={norm(sub(out, best)) < 1e-9 ? 'good' : 'bad'}>{norm(sub(out, best)) < 1e-9 ? '정답' : '오답'}</b></div>
        <div className="stat"><span>그림 전체 정답 비율</span><b>{(grid.rate * 100).toFixed(1)}%</b></div>
      </div>
      <p className="note">파란 영역은 원점이 ‘복호되는’ 영역입니다: 반올림은 평행사변형 P₁/₂(B), 최근접 평면은 GSO 직사각형 P₁/₂(B*), 정확한 CVP 는 보로노이 셀. 기저가 나쁠수록 이 영역이 보로노이 셀에서 멀어집니다.</p>
    </div>
  );
}
