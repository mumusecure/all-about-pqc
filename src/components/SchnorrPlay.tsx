import { useState } from 'react';
import { G, P_ORD, Q, type Transcript, extract, fsChallenge, keyGen, prove, sign, simulate, verify } from '../lib/sigma';
import { modPow } from '../lib/algebra';
import { mulberry32 } from '../lib/lwe';

type Tab = 'honest' | 'sim' | 'reuse';

/**
 * Schnorr 식별 프로토콜 놀이터 (군: ℤ₄₆₇^* 의 위수 233 부분군, g = 4).
 * 정직한 실행 / 비밀 없이 대화록을 만드는 시뮬레이터 / 논스 재사용으로 비밀키 추출.
 */
export default function SchnorrPlay() {
  const [tab, setTab] = useState<Tab>('honest');
  const [seed, setSeed] = useState(1);
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const rng = mulberry32(seed * 6151);
  const { x, X } = keyGen(rng);
  const k = 1 + Math.floor(rng() * (P_ORD - 1));
  const c = Math.floor(rng() * P_ORD);
  const t = prove(x, k, c);
  const simT = simulate(X, Math.floor(rng() * P_ORD), Math.floor(rng() * P_ORD));
  const m1 = '송금 1만원', m2 = '송금 100만원';
  const sig1 = sign(x, k, m1), sig2 = sign(x, k, m2);
  const xRec = extract(sig1, sig2);

  const Row = ({ who, text }: { who: string; text: string }) => (
    <div style={{ display: 'flex', gap: 8, fontSize: '0.86rem', margin: '3px 0' }}>
      <b style={{ minWidth: '4.2rem', color: who === '증명자' ? 'var(--w-b1)' : who === '검증자' ? 'var(--w-b2)' : 'var(--w-gs)' }}>{who}</b>
      <span style={{ fontFamily: 'var(--sl-font-mono, monospace)' }}>{text}</span>
    </div>
  );
  const vt = (tr: Transcript) => `g^s = ${modPow(G, tr.s, Q)},  R·X^c = ${(tr.R * modPow(X, tr.c, Q)) % Q}  → ${verify(X, tr) ? '✓ 통과' : '✗ 실패'}`;

  return (
    <div className="widget not-content">
      <h4>Schnorr 프로토콜 놀이터</h4>
      <p className="widget-sub">군 ℤ_{Q}^* 의 위수 {P_ORD} 부분군, 생성원 g = {G}. 비밀키 x, 공개키 X = g^x = {X}.</p>
      <div className="row">
        <button className={tab === 'honest' ? 'primary' : ''} onClick={() => { setTab('honest'); setStep(0); }}>정직한 실행</button>
        <button className={tab === 'sim' ? 'primary' : ''} onClick={() => setTab('sim')}>시뮬레이터 (영지식)</button>
        <button className={tab === 'reuse' ? 'primary' : ''} onClick={() => setTab('reuse')}>논스 재사용 공격</button>
        <button onClick={() => { setSeed((s) => s + 1); setStep(0); }}>새 키</button>
        <label style={{ fontSize: '0.85rem' }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> 비밀 x 보기 {show ? `(x = ${x})` : ''}</label>
      </div>
      <div className="log" style={{ maxHeight: 'none' }}>
        {tab === 'honest' && (
          <>
            <Row who="증명자" text={`무작위 k${show ? ` = ${k}` : ''} 를 고르고 약속 R = g^k = ${t.R} 을 보낸다`} />
            {step >= 1 && <Row who="검증자" text={`무작위 도전 c = ${c} 를 보낸다`} />}
            {step >= 2 && <Row who="증명자" text={`응답 s = k + c·x mod ${P_ORD} = ${t.s} 를 보낸다`} />}
            {step >= 3 && <Row who="검증자" text={vt(t)} />}
          </>
        )}
        {tab === 'sim' && (
          <>
            <Row who="시뮬레이터" text={`x 를 모른 채 c = ${simT.c}, s = ${simT.s} 를 먼저 고른다`} />
            <Row who="시뮬레이터" text={`R = g^s · X^(−c) = ${simT.R} 로 정한다`} />
            <Row who="검증자" text={vt(simT)} />
            <div style={{ fontSize: '0.82rem', marginTop: 6 }}>정직한 대화록 (R, c, s) 에서 c, s 는 균등하고 R 은 그 둘로 정해집니다. 시뮬레이터의 출력도 정확히 같은 분포라서, 대화록을 본 사람은 x 에 대해 아무것도 배우지 못합니다(정직한 검증자 영지식). 단, 시뮬레이터는 <b>c 를 먼저 알아야</b> 하므로 실제 검증자를 속일 수는 없습니다.</div>
          </>
        )}
        {tab === 'reuse' && (
          <>
            <Row who="증명자" text={`같은 k 로 두 메시지에 Fiat–Shamir 서명 (c = H(R, m))`} />
            <Row who="서명 1" text={`“${m1}”: R = ${sig1.R}, c = ${sig1.c}, s = ${sig1.s}`} />
            <Row who="서명 2" text={`“${m2}”: R = ${sig2.R}, c = ${sig2.c}, s = ${sig2.s}`} />
            <Row who="공격자" text={`R 이 같다! x = (s₁ − s₂)/(c₁ − c₂) mod ${P_ORD} = ${xRec}`} />
            <div style={{ fontSize: '0.82rem', marginTop: 6 }}>{xRec === x ? <b className="bad">비밀키 복구 성공 (실제 x = {x})</b> : '이번엔 c₁ = c₂ 라 실패. 새 키로 다시.'} 같은 R, 다른 c 의 두 대화록에서 비밀이 나온다는 <b>특수 건전성</b> 이 그대로 공격이 됩니다. 실제로 ECDSA 서명에서 논스를 재사용한 게임기 펌웨어 서명 키가 이렇게 유출된 사례가 있습니다.</div>
          </>
        )}
      </div>
      {tab === 'honest' && (
        <div className="row">
          <button className="primary" onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={step >= 3}>다음 단계</button>
          <button onClick={() => setStep(0)}>처음부터</button>
          <span className="note">도전 c 를 먼저 알 수 있다면? → ‘시뮬레이터’ 탭. Fiat–Shamir 에서는 c = H(R, m) = {fsChallenge(t.R, 'msg')} 처럼 해시로 정합니다.</span>
        </div>
      )}
    </div>
  );
}
