import { useState } from 'react';
import { type Goal, planRoadmap } from '../lib/roadmap';

/** 마감까지 남은 기간·주당 시간·속도로 공부 단계와 고정 일정(연락, 서류, 면접)을 배치한다. */
export default function RoadmapTimeline() {
  const [goal, setGoal] = useState<Goal>('grad');
  const [months, setMonths] = useState(10);
  const [hpw, setHpw] = useState(10);
  const [pace, setPace] = useState(1);
  const weeks = Math.round(months * 4.33);
  const P = planRoadmap(goal, weeks, hpw, pace);
  const end = Math.max(weeks + 6, ...P.phases.map((p) => p.endWeek)) + 1;
  const W = 560, L = 150, R = 14, rowH = 26, top = 26;
  const X = (w: number) => L + ((W - L - R) * w) / end;
  const H = top + P.phases.length * rowH + 8;
  const mark = (k: string) => (k === 'contact' ? 'var(--w-good)' : 'var(--w-bad)');
  const cols = ['var(--w-b1)', 'var(--w-b1)', 'var(--w-gs)', 'var(--w-gs)', 'var(--w-b2)', 'var(--w-b2)'];
  return (
    <div className="widget not-content">
      <h4>준비 일정 짜 보기</h4>
      <p className="widget-sub">마감(대학원 원서 마감 또는 학부연구생으로 합류하고 싶은 학기 시작)까지 남은 기간과 주당 공부 시간을 넣으면, 이 교과서 기준의 단계들을 순서대로 놓고 마감에서 거꾸로 센 일정(연락, 서류, 면접)과 겹쳐 보여 줍니다. 시간 추정은 대략값입니다.</p>
      <div className="row">
        <button className={goal === 'intern' ? 'primary' : ''} onClick={() => setGoal('intern')}>학부연구생</button>
        <button className={goal === 'grad' ? 'primary' : ''} onClick={() => setGoal('grad')}>석사 진학</button>
      </div>
      <div className="controls">
        <label className="slider">마감까지 <b>{months} 개월</b><input type="range" min={2} max={18} value={months} onChange={(e) => setMonths(+e.target.value)} /></label>
        <label className="slider">주당 시간 <b>{hpw} 시간</b><input type="range" min={3} max={30} value={hpw} onChange={(e) => setHpw(+e.target.value)} /></label>
        <label className="slider">속도 배율 (선수 과목을 들었으면 낮게) <b>×{pace.toFixed(1)}</b><input type="range" min={0.5} max={1.5} step={0.1} value={pace} onChange={(e) => setPace(+e.target.value)} /></label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="준비 일정">
        {Array.from({ length: Math.floor(end / 4.33) + 1 }, (_, m) => (
          <g key={m}>
            <line x1={X(m * 4.33)} x2={X(m * 4.33)} y1={top - 6} y2={H} stroke="var(--w-grid)" />
            {m % 2 === 0 && <text x={X(m * 4.33)} y={top - 14} fontSize="10" textAnchor="middle" fill="var(--w-muted)">{m}개월</text>}
          </g>
        ))}
        {P.phases.map((p, i) => (
          <g key={p.key}>
            <text x={L - 6} y={top + i * rowH + 16} fontSize="12" textAnchor="end" fill="var(--w-text)">{p.label}</text>
            <rect x={X(p.startWeek)} y={top + i * rowH + 4} width={Math.max(2, X(p.endWeek) - X(p.startWeek))} height={16} rx={3} fill={cols[i % cols.length]} opacity={p.endWeek > weeks ? 0.35 : 0.85} />
          </g>
        ))}
        {P.anchors.map((a, i) => (
          <g key={a.key}>
            <line x1={X(a.week)} x2={X(a.week)} y1={top - 4} y2={H} stroke={mark(a.key)} strokeWidth={2} strokeDasharray={a.key === 'interview' ? '4 3' : undefined} />
            <circle cx={X(a.week)} cy={top - 4} r={7} fill={mark(a.key)} />
            <text x={X(a.week)} y={top - 0.5} fontSize="10" textAnchor="middle" fill="var(--w-bg)" fontWeight={700}>{i + 1}</text>
          </g>
        ))}
      </svg>
      <p className="widget-sub" style={{ marginTop: '0.25rem' }}>{P.anchors.map((a, i) => <span key={a.key} style={{ marginRight: '0.9rem', whiteSpace: 'nowrap' }}><b style={{ color: mark(a.key) }}>{i + 1}</b> {a.label} ({(a.week / 4.33).toFixed(1)} 개월)</span>)}</p>
      <div className="stats">
        <div className="stat"><span>필요한 시간</span><b>{P.totalHours} 시간</b></div>
        <div className="stat"><span>마감까지 쓸 수 있는 시간</span><b>{P.availableHours} 시간</b></div>
        <div className="stat"><span>연락 전에 핵심 경로 + 첫 실습</span><b className={P.readyForContact ? 'good' : 'bad'}>{P.readyForContact ? '끝남' : '못 끝남'}</b></div>
        <div className="stat"><span>마감 전에 모든 단계</span><b className={P.fits ? 'good' : 'bad'}>{P.fits ? '끝남' : '넘침'}</b></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>단계</th><th>범위</th><th>시간</th><th>기간</th></tr></thead>
          <tbody>{P.phases.map((p) => <tr key={p.key}><td>{p.label}</td><td>{p.chapters}</td><td>{p.hours}</td><td>{(p.startWeek / 4.33).toFixed(1)}~{(p.endWeek / 4.33).toFixed(1)} 개월</td></tr>)}</tbody>
        </table>
      </div>
      <p className="note">{P.readyForContact
        ? '연락할 때 "핵심 경로를 마쳤고 첫 실습 보고서가 있다"고 말할 수 있는 일정입니다. 나머지 단계는 연락 뒤 연구실의 조언을 듣고 순서를 바꿔도 됩니다.'
        : '연락 시점까지 핵심 경로와 첫 실습이 끝나지 않습니다. 주당 시간을 늘리거나, 연락을 미루거나, 연락 메일에 "지금 어디까지 했고 언제까지 무엇을 끝낼지"를 구체적으로 적는 방법이 있습니다. 준비가 덜 되었다고 연락을 포기할 필요는 없습니다.'}
        {' '}입시 일정은 학교·학과마다 다르니 반드시 입학처 공지로 확인하세요(한국 대학원은 대체로 전기 입학 원서를 전년도 가을에, 후기 입학 원서를 봄에 받습니다).</p>
    </div>
  );
}
