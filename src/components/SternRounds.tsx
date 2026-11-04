import { useMemo, useState } from 'react';
import { type SternStrategy, sternInstance, sternRound, sternRoundBits } from '../lib/zk';
import { mulberry32 } from '../lib/lwe';

const I = sternInstance(64, 16, 257, 12, 1);
const LABEL: Record<SternStrategy, string> = { honest: '정직한 증명자 (s 를 앎)', 'cheat-weight': '속임 A: 무게만 맞는 가짜', 'cheat-equation': '속임 B: 식만 맞는 가짜' };

/**
 * Stern 식 3-이동 프로토콜을 여러 라운드 반복한다. 비밀을 모르는 증명자도 세 도전 중 둘에는 답할 수 있어,
 * 한 라운드의 건전성 오차가 2/3 이다. 2^{−128} 을 얻으려면 219 라운드가 필요하다.
 */
export default function SternRounds() {
  const [strat, setStrat] = useState<SternStrategy>('cheat-weight');
  const [rounds, setRounds] = useState(10);
  const [seed, setSeed] = useState(1);
  const res = useMemo(() => {
    const r = mulberry32(seed * 977 + rounds);
    const one = Array.from({ length: rounds }, () => sternRound(I, strat, r));
    let acc = 0; const T = 400;
    for (let t = 0; t < T; t++) { let ok = true; for (let k = 0; k < rounds && ok; k++) ok = sternRound(I, strat, r).ok; if (ok) acc++; }
    return { one, rate: acc / T };
  }, [strat, rounds, seed]);
  const accepted = res.one.every((x) => x.ok);
  const theory = strat === 'honest' ? 1 : (2 / 3) ** rounds;
  const need = Math.ceil(128 / Math.log2(1.5));
  const kb = (sternRoundBits(512, 3329) * need) / 8 / 1024;
  return (
    <div className="widget not-content">
      <h4>Stern 식 증명: 한 라운드의 건전성은 2/3</h4>
      <p className="widget-sub">"이진이고 무게가 12 인 s 로 A s = t (mod 257) 를 안다"를 증명합니다. 증명자는 순열 π 와 마스크 r 로 세 개를 커밋하고, 검증자의 도전(1, 2, 3)에 따라 일부만 엽니다. 비밀을 모르는 증명자도 두 도전에는 답을 준비할 수 있습니다.</p>
      <div className="row">
        {(Object.keys(LABEL) as SternStrategy[]).map((k) => <button key={k} className={strat === k ? 'primary' : ''} onClick={() => setStrat(k)}>{LABEL[k]}</button>)}
      </div>
      <div className="controls">
        <label className="slider">라운드 수 <b>{rounds}</b>
          <input type="range" min={1} max={40} value={rounds} onChange={(e) => setRounds(+e.target.value)} />
        </label>
      </div>
      <div className="row"><button onClick={() => setSeed((s) => s + 1)}>다시 증명</button></div>
      <div className="row" style={{ gap: '0.3rem' }}>
        {res.one.map((x, i) => (
          <span key={i} style={{ padding: '0.1rem 0.4rem', borderRadius: '0.35rem', fontSize: '0.78rem', border: '1px solid var(--w-border)', background: x.ok ? 'var(--w-surface)' : 'var(--w-bad)', color: x.ok ? 'var(--w-text)' : 'var(--w-on-accent)' }}>
            도전{x.ch} {x.ok ? '✓' : '✗'}
          </span>
        ))}
      </div>
      <div className="stats">
        <div className="stat"><span>이번 증명</span><b className={accepted ? (strat === 'honest' ? 'good' : 'bad') : 'good'}>{accepted ? '받아들임' : '거부'}</b></div>
        <div className="stat"><span>통과율 (400 번 시도 · 이론)</span><b>{(res.rate * 100).toFixed(1)}% · {(theory * 100).toFixed(theory < 0.01 ? 3 : 1)}%</b></div>
        <div className="stat"><span>2⁻¹²⁸ 에 필요한 라운드</span><b>{need}</b></div>
        <div className="stat"><span>실제 크기 (m = 512, q = 3329) 의 증명</span><b>약 {kb.toFixed(0)} KB</b></div>
      </div>
      <p className="note">속임 A 는 이진이고 무게가 맞는 가짜 s′ 를 써서 도전 1·3 에 답하고(2 에서 A s′ ≠ t 가 드러남), 속임 B 는 A s″ = t 인 이진이 아닌 해를 풀어서 도전 2·3 에 답합니다(1 에서 드러남). 두 성질을 동시에 가진 s 를 아는 것이 곧 비밀을 아는 것이라, 세 도전 모두에 답하면 추출기가 s 를 뽑을 수 있습니다(특수 건전성의 3-분기 판). 문제는 크기입니다. 라운드마다 길이 m 의 벡터를 보내야 해서 실제 크기에서는 수백 KB 가 됩니다.</p>
    </div>
  );
}
