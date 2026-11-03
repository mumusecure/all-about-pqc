import { useMemo, useState } from 'react';
import { gcd, modPow } from '../lib/algebra';
import { convergents, factorFromOrder, orderFromMeasurement, shorDistribution } from '../lib/quantum';

const Ns = [15, 21, 33, 35];

/**
 * 쇼어 알고리즘의 축소판: 양자 부분(주기 찾기)의 측정 분포를 정확히 계산하고,
 * 측정값 y 에서 연분수로 위수 r 을 찾은 뒤 gcd 로 인수분해한다.
 */
export default function ShorSim() {
  const [N, setN] = useState(21);
  const coprimes = useMemo(() => Array.from({ length: N - 2 }, (_, i) => i + 2).filter((a) => gcd(a, N) === 1), [N]);
  const [a, setA] = useState(2);
  const aa = coprimes.includes(a) ? a : coprimes[0];
  const t = Math.ceil(2 * Math.log2(N));
  const { Q, r, P } = useMemo(() => shorDistribution(aa, N, t), [aa, N, t]);
  const [y, setY] = useState<number | null>(null);

  const measure = () => {
    let u = Math.random(), acc = 0;
    for (let i = 0; i < Q; i++) { acc += P[i]; if (u <= acc) { setY(i); return; } }
    setY(Q - 1);
  };
  const rFound = y === null ? null : orderFromMeasurement(y, Q, aa, N);
  const fac = rFound ? factorFromOrder(aa, rFound, N) : null;

  const W = 620, H = 150, L = 10, R = 10, T = 10, B = 22;
  const pmax = Math.max(...P);
  const X = (i: number) => L + ((W - L - R) * i) / Q;
  const bw = Math.max(0.6, (W - L - R) / Q);

  return (
    <div className="widget not-content">
      <h4>쇼어 알고리즘: 주기를 찾아 인수분해하기</h4>
      <p className="widget-sub">f(x) = aˣ mod N 의 주기(= a 의 위수 r)를 양자 푸리에 변환으로 찾습니다. 아래 그래프는 첫 레지스터(크기 Q = 2^{t} = {Q})를 측정할 때 각 y 가 나올 확률을 <b>정확히</b> 계산한 것입니다. 봉우리는 Q/r 의 배수 근처에 있습니다.</p>
      <div className="controls">
        <label className="slider">인수분해할 N
          <select value={N} onChange={(e) => { setN(+e.target.value); setY(null); }}>{Ns.map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label>
        <label className="slider">무작위 밑 a (gcd(a, N) = 1)
          <select value={aa} onChange={(e) => { setA(+e.target.value); setY(null); }}>{coprimes.map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label>
      </div>
      <div className="log" style={{ maxHeight: 'none', marginBottom: 6 }}>
        <div>고전 부분(답 확인용): a^x mod N = {Array.from({ length: Math.min(12, r + 2) }, (_, x) => modPow(aa, x, N)).join(', ')}, … → 위수 r = {r}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="측정 분포">
        {P.map((p, i) => p > pmax * 0.002 && <rect key={i} x={X(i)} y={T + (H - T - B) * (1 - p / pmax)} width={bw} height={(H - T - B) * (p / pmax)} fill={y === i ? 'var(--w-b2)' : 'var(--w-b1)'} />)}
        {y !== null && <line x1={X(y) + bw / 2} x2={X(y) + bw / 2} y1={T} y2={H - B} stroke="var(--w-b2)" strokeWidth={1.5} />}
        <text x={L} y={H - 6} fontSize="10" fill="var(--w-muted)">y = 0</text>
        <text x={W - R} y={H - 6} fontSize="10" textAnchor="end" fill="var(--w-muted)">y = {Q - 1}</text>
      </svg>
      <div className="row"><button className="primary" onClick={measure}>양자 레지스터 측정 (y 뽑기)</button></div>
      {y !== null && (
        <div className="stats">
          <div className="stat"><span>측정값 y, y/Q</span><b>{y}, {(y / Q).toFixed(4)}</b></div>
          <div className="stat"><span>연분수 근사분수 (분모 &lt; N)</span><b>{convergents(y, Q, N).map(([h, k]) => `${h}/${k}`).join(', ') || '없음'}</b></div>
          <div className="stat"><span>찾은 위수 후보</span><b className={rFound ? 'good' : 'bad'}>{rFound ?? '실패 → 다시 측정'}</b></div>
          <div className="stat"><span>인수분해</span><b className={fac ? 'good' : 'bad'}>{fac ? `${N} = ${fac[0]} × ${fac[1]}` : rFound ? (rFound % 2 ? 'r 이 홀수 → 다른 a' : `a^(r/2) ≡ −1 → 다른 a`) : '-'}</b></div>
        </div>
      )}
      <p className="note">y = 0 처럼 정보가 없는 측정이 나오거나 r 이 홀수이면 다시 시도합니다. 성공 확률은 상수 이상이라 몇 번이면 충분합니다. 실제 RSA-2048 에서는 이 ‘측정 분포’를 만드는 양자 회로(모듈러 거듭제곱 + QFT)를 오류 정정된 수천 개의 논리 큐비트로 돌려야 합니다.</p>
    </div>
  );
}
