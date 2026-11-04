import { useMemo, useState } from 'react';
import { type IsoGraph, cglWalk, f2str, supersingular2Graph, supersingularCount } from '../lib/isogeny';

const PS = [103, 179, 227, 311];

/**
 * 초특이 2-동종 그래프를 실제로 계산한다: 꼭짓점 = F_{p²} 의 초특이 j-불변량, 변 = Φ₂(j, j′) = 0.
 * 모든 꼭짓점의 차수가 3 (중복 포함) 인 확장 그래프이고, 문자열을 비트로 바꿔 걸으면 CGL 해시가 된다.
 */
export default function IsogenyGraph() {
  const [p, setP] = useState(179);
  const [msg, setMsg] = useState('PQC');
  const [G, setG] = useState<IsoGraph | null>(null);
  const [busy, setBusy] = useState(false);
  const build = (pp: number) => { setBusy(true); setTimeout(() => { setG(supersingular2Graph(pp)); setBusy(false); }, 20); };
  const cur = G && G.p === p ? G : null;
  const bits = useMemo(() => Array.from(new TextEncoder().encode(msg)).flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1)).slice(0, 48), [msg]);
  const path = useMemo(() => (cur ? cglWalk(cur, bits) : []), [cur, bits]);
  const S = 360, C = S / 2, Rr = S / 2 - 26;
  const pos = (k: number, n: number) => [C + Rr * Math.cos((2 * Math.PI * k) / n - Math.PI / 2), C + Rr * Math.sin((2 * Math.PI * k) / n - Math.PI / 2)];
  const onPath = new Set(path.slice(1).map((v, i) => `${Math.min(path[i], v)}-${Math.max(path[i], v)}`));
  return (
    <div className="widget not-content">
      <h4>초특이 2-동종 그래프와 CGL 해시</h4>
      <p className="widget-sub">p ≡ 3 (mod 4) 에서 j = 1728 부터 시작해, 모듈러 다항식 Φ₂(j, Y) 의 F_p² 근을 이웃으로 삼아 그래프 전체를 만듭니다. 파랑 = j ∈ F_p, 주황 = j ∈ F_p² \ F_p. 메시지의 비트로 "되돌아가지 않는 걷기"를 하면 도착한 j 가 해시값입니다.</p>
      <div className="row">
        {PS.map((v) => <button key={v} className={p === v ? 'primary' : ''} disabled={busy} onClick={() => { setP(v); build(v); }}>p = {v}</button>)}
        {!cur && <button className="primary" disabled={busy} onClick={() => build(p)}>{busy ? '계산 중…' : '그래프 계산'}</button>}
      </div>
      <div className="controls">
        <label className="slider">해시할 메시지 (앞 6 바이트 = 48 비트)
          <input type="text" value={msg} maxLength={6} onChange={(e) => setMsg(e.target.value)} style={{ font: 'inherit', padding: '0.3rem', borderRadius: '0.4rem', border: '1px solid var(--w-border)', background: 'var(--w-surface)', color: 'var(--w-text)' }} />
        </label>
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 400, margin: '0 auto' }} role="img" aria-label="동종 그래프">
        {cur && cur.adj.flatMap((a, k) => a.filter((m) => m > k).map((m) => {
          const [x1, y1] = pos(k, cur.nodes.length), [x2, y2] = pos(m, cur.nodes.length);
          const hot = onPath.has(`${k}-${m}`);
          return <line key={`${k}-${m}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={hot ? 'var(--w-good)' : 'var(--w-point)'} strokeOpacity={hot ? 1 : 0.45} strokeWidth={hot ? 3 : 1.2} />;
        }))}
        {cur && cur.nodes.map((j, k) => { const [x, y] = pos(k, cur.nodes.length); const last = k === path[path.length - 1]; return <g key={k}><circle cx={x} cy={y} r={last ? 8 : 5} fill={j[1] === 0 ? 'var(--w-b1)' : 'var(--w-b2)'} stroke={last ? 'var(--w-good)' : 'none'} strokeWidth={3} /></g>; })}
        {!cur && <text x={C} y={C} fontSize="14" textAnchor="middle" fill="var(--w-muted)">{busy ? '계산 중…' : '‘그래프 계산’ 을 눌러 보세요'}</text>}
      </svg>
      <div className="stats">
        <div className="stat"><span>꼭짓점 수 · 공식 ⌊p/12⌋ + ε</span><b>{cur ? `${cur.nodes.length} · ${supersingularCount(p)}` : '—'}</b></div>
        <div className="stat"><span>모든 차수가 3 (중복 포함)?</span><b>{cur ? (cur.adj.every((a) => a.length === 3) ? '예' : '아니오') : '—'}</b></div>
        <div className="stat"><span>F_p 위의 j 개수</span><b>{cur ? cur.nodes.filter((j) => j[1] === 0).length : '—'}</b></div>
        <div className="stat"><span>CGL 해시 (도착 j, {bits.length} 걸음)</span><b>{cur ? f2str(cur.nodes[path[path.length - 1]]) : '—'}</b></div>
      </div>
      <p className="note">초특이 j-불변량은 약 p/12 개뿐이고 모두 F_p² 에 있습니다. 2-동종 그래프는 3-정칙이고 연결되어 있으며 라마누잔 그래프(Pizer)라서, 걷기가 O(log p) 걸음 만에 거의 균등하게 퍼집니다. 실제 크기(p ≈ 2²⁵⁶)에서 두 꼭짓점을 잇는 길을 찾는 것이 동종사상 암호의 어려운 문제이고, CGL 해시의 충돌을 찾는 것은 그래프의 짧은 순환, 즉 곡선의 자기준동형을 찾는 것과 같습니다.</p>
    </div>
  );
}
