import { useState } from 'react';
import { qStarDvW } from '../lib/fatigue';

/**
 * 논문 읽기 5: 세 모델의 fatigue point (uSVP 와 밀집 부분격자 쪽이 같은 β 를 주는 log₂ q) 를 n 에 대해 그린다.
 * KF 값은 src/lib/kf17.ts 의 crossingLog2q, DvW 예측기 값은 src/lib/dvw.ts 의 fatiguePoint (순환 NTRU, 8 투어) 로
 * 미리 계산한 것 (tests/dvw.test.ts 가 작은 n 에서 확인).
 */
export const FATIGUE_NS = [128, 256, 384, 512, 768, 1024, 1536, 2048];
export const CROSS = {
  tern: { kf: [12.6, 19.3, 21.6, 23.1, 25.1, 26.5, 28.4, 29.7], dvw: [9.6, 11.9, 13.4, 14.5, 15.9, 17.0, 18.4, 19.5] },
  wide: { kf: [17.2, 24.4, 28.1, 29.9, 32.3, 33.9, 36.0, 37.5], dvw: [14.1, 16.5, 18.0, 19.1, 20.6, 21.7, 23.2, 24.4] },
};
/** 실제 스킴 (n, log₂ q, 비밀 종류). Falcon 은 넓은 비밀 */
const SCHEMES = [
  { name: 'HPS-509', n: 509, lq: 11, wide: false, dx: -4, dy: 12, end: true },
  { name: 'HPS-677', n: 677, lq: 11, wide: false, dx: 0, dy: 13, end: false },
  { name: 'HRSS-701', n: 701, lq: 13, wide: false, dx: -6, dy: 3, end: true },
  { name: 'HPS-821', n: 821, lq: 12, wide: false, dx: 5, dy: 4, end: false },
  { name: 'Falcon-512', n: 512, lq: Math.log2(12289), wide: true, dx: 5, dy: 12, end: false },
  { name: 'Falcon-1024', n: 1024, lq: Math.log2(12289), wide: true, dx: 5, dy: 12, end: false },
];

export default function FatigueLines() {
  const [wide, setWide] = useState(false);
  const c = wide ? CROSS.wide : CROSS.tern;
  const W = 380, H = 210, L = 34, B = 28, T = 10, ymin = 8, ymax = 40;
  const X = (n: number) => L + ((W - L - 12) * (Math.log2(n) - 7)) / 4, Y = (v: number) => T + (H - T - B) * (1 - (v - ymin) / (ymax - ymin));
  const path = (ys: number[]) => FATIGUE_NS.map((n, i) => `${i ? 'L' : 'M'}${X(n).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(' ');
  const dvw = FATIGUE_NS.map((n) => Math.log2(qStarDvW(n)));
  const pts = SCHEMES.filter((s) => s.wide === wide);
  return (
    <div className="widget not-content">
      <h4>세 모델의 fatigue point</h4>
      <p className="widget-sub">각 선 위쪽(큰 q)에서는 밀집 부분격자가, 아래쪽에서는 숨은 벡터 하나가 먼저 드러난다고 예측합니다. 주황 = Kirchner–Fouque 식 충분조건(논문 읽기 4), 보라 = DvW 공개 예측기를 이 교과서가 옮긴 것(P(DSD 먼저) = 1/2 인 q), 초록 점선 = DvW 의 맞춤식 0.004·n^2.484(삼진 비밀). 점은 실제 스킴입니다.</p>
      <div className="row">
        <button className={!wide ? 'primary' : ''} onClick={() => setWide(false)}>삼진 비밀 (NTRU)</button>
        <button className={wide ? 'primary' : ''} onClick={() => setWide(true)}>넓은 비밀 σ = 4 (Falcon 근처)</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 560 }} role="img" aria-label="n 에 따른 세 모델의 fatigue point log q">
        <line x1={L} y1={H - B} x2={W - 12} y2={H - B} stroke="var(--w-border)" />
        <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--w-border)" />
        {[128, 256, 512, 1024, 2048].map((n) => <text key={n} x={X(n)} y={H - B + 14} fontSize="10" textAnchor="middle" fill="var(--w-muted)">{n}</text>)}
        {[10, 15, 20, 25, 30, 35, 40].map((v) => <text key={v} x={L - 4} y={Y(v) + 3} fontSize="10" textAnchor="end" fill="var(--w-muted)">{v}</text>)}
        <path d={path(c.kf)} fill="none" stroke="var(--w-b2)" strokeWidth={2} />
        <path d={path(c.dvw)} fill="none" stroke="var(--w-gs)" strokeWidth={2} />
        {!wide && <path d={path(dvw)} fill="none" stroke="var(--w-good)" strokeWidth={2} strokeDasharray="5 3" />}
        {pts.map((s) => <g key={s.name}><circle cx={X(s.n)} cy={Y(s.lq)} r={3.5} fill="var(--w-text)" /><text x={X(s.n) + s.dx} y={Y(s.lq) + s.dy} fontSize="9" textAnchor={s.end ? 'end' : 'start'} fill="var(--w-muted)">{s.name}</text></g>)}
        <text x={(W + L) / 2} y={H - 2} fontSize="11" textAnchor="middle" fill="var(--w-muted)">n (로그 눈금)</text>
      </svg>
      <div className="table-wrap">
        <table style={{ width: '100%', fontSize: '0.82rem' }}>
          <thead><tr><th>n</th>{FATIGUE_NS.map((n) => <th key={n}>{n}</th>)}</tr></thead>
          <tbody>
            <tr><td>KF 충분조건</td>{c.kf.map((v, i) => <td key={i}>{v.toFixed(1)}</td>)}</tr>
            <tr><td>DvW 예측기</td>{c.dvw.map((v, i) => <td key={i}>{v.toFixed(1)}</td>)}</tr>
            {!wide && <tr><td>DvW 맞춤식</td>{dvw.map((v, i) => <td key={i}>{v.toFixed(1)}</td>)}</tr>}
          </tbody>
        </table>
      </div>
      <p className="note">{wide ? '넓은 비밀(σ² = 16)에서는 키 부분격자의 부피가 커져 두 선이 모두 4~8 비트 올라갑니다. 맞춤식 0.004·n^2.484 는 삼진 비밀용이라 그리지 않았습니다. Falcon 은 예측기 선보다 5~8 비트 아래에 있습니다(Falcon-1024 의 실제 σ 는 약 2.9 라 선이 조금 더 낮습니다).' : '보라(예측기)와 초록(맞춤식)은 n ≥ 128 에서 0.2 비트 안으로 겹칩니다. 맞춤식이 n = 90~500 의 예측 결과를 요약한 식으로 보이기 때문입니다. 주황(KF 충분조건)은 그보다 3~10 비트 위라, 공격자에게 불리한 쪽으로 보수적입니다. 같은 n 에서 선과 점의 세로 거리가 "q 를 몇 비트 더 키워도 uSVP 추정이 유효한가"의 여유입니다.'}</p>
    </div>
  );
}
