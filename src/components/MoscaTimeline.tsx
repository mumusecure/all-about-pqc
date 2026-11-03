import { useState } from 'react';

const NOW = 2026;
const SPAN = 50; // 그림에 표시할 연수

const presets = [
  { label: '메신저 대화', x: 5, y: 3 },
  { label: '금융 거래 기록', x: 10, y: 7 },
  { label: '의료·유전체 정보', x: 30, y: 8 },
  { label: '국가 기밀', x: 40, y: 12 },
];

/**
 * Mosca 부등식 x + y > z 시각화.
 * x: 데이터가 비밀이어야 하는 기간, y: PQC 전환에 걸리는 기간, z: 암호를 깨는 양자컴퓨터(CRQC)까지 남은 기간.
 */
export default function MoscaTimeline() {
  const [x, setX] = useState(10);
  const [y, setY] = useState(7);
  const [z, setZ] = useState(15);

  const W = 640, H = 190, L = 110, R = 16;
  const px = (t: number) => L + ((W - L - R) * Math.min(t, SPAN)) / SPAN;
  const danger = x + y > z;
  const exposed = Math.max(0, x + y - z);

  const rows = [
    { label: 'PQC 전환 중', from: 0, to: y, color: 'var(--w-b1)' },
    { label: '비밀 유지 필요', from: 0, to: y + x, color: 'var(--w-gs)' },
  ];

  return (
    <div className="widget not-content">
      <h4>Mosca 부등식 계산기</h4>
      <p className="widget-sub">슬라이더를 움직여 “지금 훔친 암호문이 언제 풀리는가”를 확인해 보세요. (z 는 불확실한 가정값입니다)</p>

      <div className="row">
        {presets.map((p) => (
          <button key={p.label} onClick={() => { setX(p.x); setY(p.y); }}>{p.label}</button>
        ))}
      </div>

      <div className="controls">
        <label className="slider">x · 데이터 보존 기간 <b>{x}년</b>
          <input type="range" min={0} max={40} value={x} onChange={(e) => setX(+e.target.value)} />
        </label>
        <label className="slider">y · 전환에 걸리는 기간 <b>{y}년</b>
          <input type="range" min={0} max={20} value={y} onChange={(e) => setY(+e.target.value)} />
        </label>
        <label className="slider">z · CRQC 등장까지 (가정) <b>{z}년</b>
          <input type="range" min={3} max={40} value={z} onChange={(e) => setZ(+e.target.value)} />
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`x=${x}, y=${y}, z=${z} 타임라인`}>
        {/* 연도 눈금 */}
        {Array.from({ length: SPAN / 10 + 1 }, (_, i) => i * 10).map((t) => (
          <g key={t}>
            <line x1={px(t)} x2={px(t)} y1={20} y2={H - 30} stroke="var(--w-grid)" />
            <text x={px(t)} y={H - 12} fontSize="12" textAnchor="middle" fill="var(--w-muted)">{NOW + t}</text>
          </g>
        ))}
        {/* 위험 구간 */}
        {danger && (
          <rect x={px(z)} y={20} width={px(x + y) - px(z)} height={H - 50} fill="var(--w-bad)" opacity={0.13} />
        )}
        {rows.map((r, i) => (
          <g key={r.label}>
            <text x={L - 8} y={52 + i * 40} fontSize="13" textAnchor="end" fill="var(--w-text)">{r.label}</text>
            <rect x={px(r.from)} y={38 + i * 40} width={Math.max(2, px(r.to) - px(r.from))} height={20} rx={4} fill={r.color} opacity={0.85} />
          </g>
        ))}
        {/* CRQC 선 */}
        <line x1={px(z)} x2={px(z)} y1={20} y2={H - 30} stroke="var(--w-bad)" strokeWidth={2.5} strokeDasharray="6 4" />
        <text x={Math.min(px(z) + 4, W - 120)} y={130} fontSize="13" fill="var(--w-bad)" fontWeight="700">CRQC 등장 ({NOW + z})</text>
      </svg>

      <div className="stats">
        <div className="stat"><span>x + y</span><b>{x + y}년</b></div>
        <div className="stat"><span>z</span><b>{z}년</b></div>
        <div className="stat"><span>판정</span><b className={danger ? 'bad' : 'good'}>{danger ? '이미 늦음' : '아직 여유'}</b></div>
        <div className="stat"><span>노출 기간</span><b>{exposed}년</b></div>
      </div>
      <p className="note">
        {danger
          ? `x + y > z: ${NOW + z}년부터 ${NOW + x + y}년까지, 지금 수집된 암호문이 비밀 유지 기간 안에 해독될 수 있습니다(빨간 구간).`
          : `x + y ≤ z: 이 가정에서는 전환을 마친 뒤 마지막 데이터의 비밀 유지 기간이 끝날 때까지 CRQC 가 등장하지 않습니다. 단, z 는 불확실합니다.`}
      </p>
    </div>
  );
}
