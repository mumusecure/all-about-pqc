import { useState } from 'react';

/**
 * 근사 인자 γ 에 따른 GapSVP/SVP 의 복잡도 지도 (n 차원).
 * x 축은 log₂ γ 를 n 에 대한 비율로 대략적으로 배치한 개념도이다(눈금은 실제 비율이 아님).
 */
const bands = [
  { from: 0, to: 18, color: 'var(--w-bad)', title: 'NP-어려움', range: 'γ = 1 ~ n^{c/log log n}',
    detail: 'SVP 는 γ = 1 에서 (무작위 환원 하에) NP-어렵고(Ajtai 1998), 상수 및 거의 다항식 크기 인자까지 NP-어려움이 알려져 있습니다(Khot 2005; Haviv–Regev 2007, 복잡도 가정 하). CVP 는 n^{c/log log n} 까지 NP-어렵습니다(Dinur–Kindler–Raz–Safra 2003).' },
  { from: 18, to: 34, color: 'var(--w-gs)', title: 'NP ∩ coNP (NP-어렵지 않을 것)', range: 'γ ≈ √(n/log n) ~ √n',
    detail: 'GapSVP_γ 는 γ = √(n/log n) 에서 NP ∩ coAM (Goldreich–Goldwasser 2000), γ = √n 에서 NP ∩ coNP (Aharonov–Regev 2005) 에 속합니다. 이 구간의 문제가 NP-어렵다면 다항 위계가 붕괴하므로, NP-어렵지 않다고 믿어집니다. 하지만 효율적 알고리즘도 모릅니다.' },
  { from: 34, to: 62, color: 'var(--w-b1)', title: '암호가 사는 곳', range: 'γ = poly(n), 예: Õ(n), Õ(n^1.5)',
    detail: 'Ajtai(1996)의 SIS, Regev(2005)의 LWE(γ = Õ(n/α)) 같은 최악→평균 환원이 이 구간의 근사 인자를 씁니다. 가장 좋은 알고리즘도 2^{Θ(n)} 시간이 걸린다고 믿어집니다(양자 포함). “NP-어려움”이 아닌 이 구간의 어려움에 기대는 것이 격자 암호의 현실입니다.' },
  { from: 62, to: 100, color: 'var(--w-good)', title: '다항 시간에 풀림', range: 'γ = 2^{O(n log log n / log n)} 이상',
    detail: 'LLL(1982)은 γ = 2^{O(n)} 을 다항 시간에 달성하고, Schnorr 의 블록 축소 계열은 2^{O(n (log log n)²/log n)} 까지 내립니다. 지수적 근사 인자는 ‘쉽다’.' },
];

export default function HardnessMap() {
  const [sel, setSel] = useState(2);
  return (
    <div className="widget not-content">
      <h4>근사 인자 γ 에 따른 격자 문제의 난이도 지도</h4>
      <p className="widget-sub">구간을 눌러 설명을 보세요. 왼쪽일수록 정확한(어려운) 문제, 오른쪽일수록 느슨한(쉬운) 문제입니다. 눈금은 개념도이며 실제 비율이 아닙니다.</p>
      <div style={{ fontSize: '0.75rem', color: 'var(--w-muted)', textAlign: 'center', marginBottom: 4 }}>← 더 정확(어려움) · 근사 인자 γ (로그 척도) · 더 느슨(쉬움) →</div>
      <div style={{ display: 'flex', gap: 3 }} role="group" aria-label="난이도 지도">
        {bands.map((b, i) => (
          <button key={i} onClick={() => setSel(i)} aria-pressed={sel === i}
            style={{ flex: `${b.to - b.from} 1 0`, minWidth: 0, padding: '0.6rem 0.3rem', borderRadius: 6, border: 'none',
              background: b.color, opacity: sel === i ? 1 : 0.5, color: 'var(--w-on-accent)', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.25, whiteSpace: 'normal', wordBreak: 'keep-all' }}>
            {b.title.split(' (')[0]}
          </button>
        ))}
      </div>
      <div style={{ position: 'relative', height: '1.4rem', fontSize: '0.75rem', color: 'var(--w-muted)' }}>
        {([[0, 'γ = 1'], [26, '√n'], [48, 'poly(n)'], [100, '2ⁿ']] as const).map(([f, l]) => (
          <span key={l} style={{ position: 'absolute', left: `${f}%`, transform: f === 0 ? 'none' : f === 100 ? 'translateX(-100%)' : 'translateX(-50%)', top: 2 }}>{l}</span>
        ))}
      </div>
      <div className="stats">
        <div className="stat" style={{ gridColumn: '1 / -1' }}><span>{bands[sel].range}</span><b>{bands[sel].title}</b><div style={{ marginTop: 4, fontSize: '0.88rem' }}>{bands[sel].detail}</div></div>
      </div>
    </div>
  );
}
