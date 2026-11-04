import { useMemo, useState } from 'react';
import { isInvertible, nonInvertibleRate, rewindExtract, sigmaKey } from '../lib/zk';

const QS = [257, 641, 7681, 12289, 4093];
const SPLIT: Record<number, string> = { 257: '64 개 일차식', 641: '64 개 일차식', 7681: '64 개 일차식', 12289: '64 개 일차식', 4093: '2 개 (≡ 5 mod 8)' };

/**
 * Lyubashevsky 식 Σ-프로토콜을 되감아 두 응답에서 (s̄, c̄) 를 뽑는다. 얻는 관계는 a·s̄₁ + s̄₂ = c̄·t.
 * c̄ = c − c′ 가 가역이면 s = c̄⁻¹ s̄ 를 계산할 수 있지만, 보장되는 것은 ‖s̄‖ 의 상한(완화된 건전성)뿐이다.
 */
export default function RelaxedExtract() {
  const [q, setQ] = useState(12289);
  const [tau, setTau] = useState(8);
  const [seed, setSeed] = useState(1);
  const n = 64, B = 2000;
  const ext = useMemo(() => rewindExtract(sigmaKey(n, q, seed), B, tau, seed + 1), [q, tau, seed]);
  const rate = useMemo(() => nonInvertibleRate(n, q, tau, 1500, seed + 2), [q, tau, seed]);
  const inv = ext ? isInvertible(ext.cb, q) : false;
  return (
    <div className="widget not-content">
      <h4>되감기 추출: 무엇을 알게 되는가</h4>
      <p className="widget-sub">R_q = ℤ_q[x]/(x⁶⁴+1) 에서 공개키 t = a·s₁ + s₂ (s 는 삼진) 에 대해 Lyubashevsky 식 Σ-프로토콜(마스크 ‖y‖∞ ≤ {B}, 도전은 ±1 이 τ 개인 희소 다항식)을 돌리고, <b>같은 마스크</b>로 두 도전 c, c′ 에 답하게 해 s̄ = z − z′, c̄ = c − c′ 를 얻습니다.</p>
      <div className="row">
        {QS.map((v) => <button key={v} className={q === v ? 'primary' : ''} onClick={() => setQ(v)}>q = {v}</button>)}
      </div>
      <div className="controls">
        <label className="slider">도전의 무게 τ <b>{tau}</b>
          <input type="range" min={2} max={24} step={2} value={tau} onChange={(e) => setTau(+e.target.value)} />
        </label>
      </div>
      <div className="row"><button onClick={() => setSeed((s) => s + 1)}>다시 추출</button></div>
      <div className="stats">
        <div className="stat"><span>관계 a·s̄₁ + s̄₂ = c̄·t</span><b className={ext?.relationHolds ? 'good' : 'bad'}>{ext ? (ext.relationHolds ? '성립' : '불성립') : '—'}</b></div>
        <div className="stat"><span>‖s̄‖∞ (실제) / 증명이 보장하는 상한 2(B − τ)</span><b>{ext ? `${ext.sbInf} / ${ext.guarantee}` : '—'}</b></div>
        <div className="stat"><span>이번 c̄ 가 가역인가</span><b className={inv ? 'good' : 'bad'}>{inv ? '예 → s = c̄⁻¹·s̄ 계산 가능' : '아니오 → 나눌 수 없음'}</b></div>
        <div className="stat"><span>무작위 도전 차이가 비가역일 비율 (xⁿ+1 의 분해: {SPLIT[q]})</span><b>{(rate * 100).toFixed(2)}%</b></div>
      </div>
      <p className="note">정직한 증명자에게서 뽑으면 s̄ = c̄·s 라 아주 짧지만(‖s̄‖∞ ≤ 2τ), 증명 자체가 보장하는 것은 "‖s̄‖ ≤ 2(B − τ) 인 s̄ 와 작은 c̄ 로 a·s̄₁ + s̄₂ = c̄·t" 뿐입니다. 이것이 <b>완화된(relaxed) 건전성</b>이고, 두 값의 비가 증명의 <b>여유(slack)</b>입니다. 많은 응용(서명, 일부 커밋먼트)은 이것으로 충분하지만, "s 가 정확히 삼진"을 증명하려면 다른 기법이 필요합니다(4절). 또 추출이 의미 있으려면 c̄ 가 가역이어야 합니다. q 가 작고 xⁿ+1 이 일차식으로 완전히 쪼개지면 비가역이 흔하고(약 n/q), 2 개처럼 적은 인수로 쪼개지는 q 를 고르면 작은 차이는 늘 가역입니다(Lyubashevsky–Seiler 2018).</p>
    </div>
  );
}
