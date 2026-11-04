import { useEffect, useState } from 'react';

/**
 * 격자 PQC 연구실 준비도 자가 점검. 항목마다 근거가 되는 장·실습을 붙였다.
 * 체크 상태는 이 브라우저에만 저장된다(localStorage, 실패해도 동작).
 */
const AREAS: { name: string; items: [string, string][] }[] = [
  { name: '수학 기초', items: [
    ['몫환 ℤ_q[x]/(xⁿ+1) 에서 곱셈을 손으로 할 수 있다', '2장'],
    ['Gram–Schmidt 직교화와 행렬식의 관계를 설명할 수 있다', '6장'],
    ['이산 가우시안과 꼬리 한계(tail bound)를 쓸 수 있다', '6장'],
  ] },
  { name: '격자 기초', items: [
    ['기저, 부피, 쌍대 격자, 연속 최소값을 정의할 수 있다', '7장'],
    ['Minkowski 정리와 Gaussian heuristic 으로 λ₁ 을 어림할 수 있다', '7·8장'],
    ['SVP·CVP·BDD·uSVP 의 관계와 근사 인자를 말할 수 있다', '8장'],
  ] },
  { name: '격자 알고리즘', items: [
    ['LLL 을 직접 구현하고 Lovász 조건을 설명할 수 있다', '9장, Lab 1'],
    ['BKZ 의 블록 크기 β 와 근 Hermite 인자 δ 의 관계를 쓸 수 있다', '10장'],
    ['열거와 체(sieve)의 비용 2^Θ(β log β) 대 2^0.292β 를 비교할 수 있다', '10장, Lab 4'],
  ] },
  { name: '암호 설계', items: [
    ['Regev 암호의 정확성과 IND-CPA 안전성 논증을 쓸 수 있다', '14장'],
    ['NTRU 키와 NTRU 격자를 만들 수 있다', '15장'],
    ['ML-KEM 의 압축, NTT, FO 변환이 왜 있는지 설명할 수 있다', '16장, Lab 3'],
  ] },
  { name: '암호해석', items: [
    ['primal uSVP 공격의 성공 조건으로 β 를 구할 수 있다', '18장, Lab 5'],
    ['overstretched NTRU 가 왜 약한지 설명할 수 있다', '19장, Lab 6'],
    ['복호 실패나 평문 확인 오라클이 키를 흘리는 이유를 말할 수 있다', '20장, Lab 7'],
  ] },
  { name: '대수적 격자', items: [
    ['원분체와 canonical embedding 을 정의할 수 있다', '11장'],
    ['Ring-LWE·Module-LWE 가 일반 LWE 와 무엇이 다른지 말할 수 있다', '12장'],
    ['모듈 격자 축소의 아이디어를 한 단락으로 설명할 수 있다', '13장'],
  ] },
  { name: '연구 실무', items: [
    ['암호해석 논문 한 편을 읽고 핵심 수치를 재계산했다', '논문 읽기 1'],
    ['실험 결과를 1쪽 보고서(설정·표·관찰·한계)로 썼다', 'Lab 1'],
    ['SageMath 나 fpylll 로 BKZ 를 돌려 봤다', '10장'],
    ['코드와 보고서를 공개 저장소에 정리했다', '25장 5절'],
  ] },
];
const KEY = 'pqc-readiness-v1';
const total = AREAS.reduce((s, a) => s + a.items.length, 0);

export default function ReadinessCheck() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setDone(JSON.parse(s)); } catch { /* 저장소 없음 */ } }, []);
  const toggle = (id: string) => setDone((d) => { const n = { ...d, [id]: !d[id] }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* 무시 */ } return n; });
  const count = Object.values(done).filter(Boolean).length;
  const scores = AREAS.map((a, ai) => a.items.filter((_, i) => done[`${ai}-${i}`]).length / a.items.length);
  const weakest = AREAS.map((a, ai) => ({ a, ai, s: scores[ai] })).filter((x) => x.s < 1).sort((x, y) => x.s - y.s).slice(0, 2);
  const W = 380, rowH = 22, L = 90;
  return (
    <div className="widget not-content">
      <h4>준비도 자가 점검</h4>
      <p className="widget-sub">"설명할 수 있다"는 교재를 보지 않고 다른 사람에게 5분 동안 설명할 수 있다는 뜻입니다. 체크 상태는 이 브라우저에만 저장됩니다.</p>
      <svg viewBox={`0 0 ${W} ${AREAS.length * rowH + 6}`} style={{ maxWidth: 520 }} role="img" aria-label="분야별 준비도">
        {AREAS.map((a, i) => (
          <g key={a.name}>
            <text x={L - 6} y={i * rowH + 16} fontSize="12" textAnchor="end" fill="var(--w-text)">{a.name}</text>
            <rect x={L} y={i * rowH + 5} width={W - L - 50} height={14} rx={3} fill="var(--w-surface)" stroke="var(--w-border)" />
            <rect x={L} y={i * rowH + 5} width={(W - L - 50) * scores[i]} height={14} rx={3} fill={scores[i] === 1 ? 'var(--w-good)' : 'var(--w-b1)'} />
            <text x={W - 42} y={i * rowH + 16} fontSize="11" fill="var(--w-muted)">{Math.round(scores[i] * 100)}%</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))', gap: '0.5rem 1rem', marginTop: '0.5rem' }}>
        {AREAS.map((a, ai) => (
          <fieldset key={a.name} style={{ border: '1px solid var(--w-border)', borderRadius: '0.5rem', padding: '0.4rem 0.6rem', margin: 0 }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 700 }}>{a.name}</legend>
            {a.items.map(([t, ref], i) => {
              const id = `${ai}-${i}`;
              return (
                <label key={id} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.82rem', alignItems: 'flex-start', margin: '0.2rem 0' }}>
                  <input type="checkbox" checked={!!done[id]} onChange={() => toggle(id)} style={{ marginTop: '0.2rem' }} />
                  <span>{t} <span style={{ color: 'var(--w-muted)' }}>({ref})</span></span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      <div className="stats">
        <div className="stat"><span>전체</span><b>{count} / {total}</b></div>
        <div className="stat"><span>다음에 볼 곳</span><b style={{ fontSize: '0.85rem' }}>{weakest.length ? weakest.map((w) => `${w.a.name}: ${w.a.items.find((_, i) => !done[`${w.ai}-${i}`])![1]}`).join(' · ') : '모두 체크!'}</b></div>
      </div>
      <p className="note">학부연구생으로 시작하는 데는 앞의 네 분야(수학 기초 ~ 암호 설계)의 대부분과 "연구 실무"의 앞 두 항목이면 충분합니다. 나머지는 연구실에서 배우는 것이 정상입니다. 석사 면접 전에는 암호해석과 연구 실무까지 채워 두면 대화의 깊이가 달라집니다.</p>
    </div>
  );
}
