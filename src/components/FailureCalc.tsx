import { useDeferredValue, useMemo, useState } from 'react';
import { FIPS_LOG2_DELTA, type MLKEMParams, N, PARAMS, Q, log2FailureProb, noisePMF, noiseVariance, sizes } from '../lib/mlkem';

type Preset = keyof typeof PARAMS;

/**
 * 복호 실패 확률 δ 의 정확 계산. 잡음 eᵀr + e2 + Δv − sᵀ(e1 + Δu) 의 한 계수 분포를 합성곱으로 구하고
 * δ ≈ 256 · Pr[|잡음| > q/4].
 */
export default function FailureCalc() {
  const [P, setP] = useState<MLKEMParams>(PARAMS['ML-KEM-768']);
  const dp = useDeferredValue(P);
  const { D, l2 } = useMemo(() => { const D = noisePMF(dp); return { D, l2: log2FailureProb(dp, D) }; }, [dp]);
  const preset = (Object.keys(PARAMS) as Preset[]).find((k) => JSON.stringify(PARAMS[k]) === JSON.stringify(P));
  const sz = sizes(P), sd = Math.sqrt(noiseVariance(dp));
  const set = (k: keyof MLKEMParams) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...P, [k]: +e.target.value });

  const W = 620, H = 220, L = 44, R = 10, T = 10, B = 26, YMIN = -300;
  const xr = Q / 2;
  const X = (v: number) => L + ((v + xr) / (2 * xr)) * (W - L - R);
  const Y = (lp: number) => T + (H - T - B) * (Math.max(lp, YMIN) / YMIN);
  const pts: string[] = [];
  const stride = Math.max(1, Math.floor(D.p.length / 700));
  for (let i = 0; i < D.p.length; i += stride) {
    const v = D.min + i;
    if (Math.abs(v) <= xr && D.p[i] > 0) pts.push(`${X(v).toFixed(1)},${Y(Math.log2(D.p[i])).toFixed(1)}`);
  }
  const verdict = l2 === -Infinity ? '< 2⁻²⁹⁰ (계산 범위 밖)' : l2 >= 0 ? '≥ 1: 거의 항상 어딘가 틀림' : `2^${l2.toFixed(1)}`;
  return (
    <div className="widget not-content">
      <h4>복호 실패 확률 계산기</h4>
      <p className="widget-sub">잡음 한 계수의 분포를 <b>표본 없이 정확히</b>(합성곱) 구해 로그 눈금으로 그립니다. 빨간 영역(|잡음| &gt; q/4 ≈ 832)에 들어갈 확률에 n = {N} 을 곱한 값이 δ 입니다.</p>
      <div className="row">
        {(Object.keys(PARAMS) as Preset[]).map((k) => <button key={k} className={preset === k ? 'primary' : ''} onClick={() => setP(PARAMS[k])}>{k}</button>)}
      </div>
      <div className="controls">
        <label className="slider">모듈 랭크 k <b>{P.k}</b><input type="range" min={2} max={4} value={P.k} onChange={set('k')} /></label>
        <label className="slider">η₁ (s, e, r) <b>{P.eta1}</b><input type="range" min={1} max={4} value={P.eta1} onChange={set('eta1')} /></label>
        <label className="slider">η₂ (e1, e2) <b>{P.eta2}</b><input type="range" min={1} max={4} value={P.eta2} onChange={set('eta2')} /></label>
        <label className="slider">du (u 압축) <b>{P.du}</b><input type="range" min={8} max={12} value={P.du} onChange={set('du')} /></label>
        <label className="slider">dv (v 압축) <b>{P.dv}</b><input type="range" min={2} max={8} value={P.dv} onChange={set('dv')} /></label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="잡음 분포 (로그 눈금)">
        <rect x={L} y={T} width={X(-Q / 4) - L} height={H - T - B} fill="var(--w-bad)" opacity={0.12} />
        <rect x={X(Q / 4)} y={T} width={W - R - X(Q / 4)} height={H - T - B} fill="var(--w-bad)" opacity={0.12} />
        {[0, -100, -200, -300].map((g) => <g key={g}><line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="var(--w-grid)" /><text x={L - 4} y={Y(g) + 4} fontSize="12" textAnchor="end" fill="var(--w-muted)">2^{g}</text></g>)}
        {[-Q / 4, Q / 4].map((v) => <line key={v} x1={X(v)} x2={X(v)} y1={T} y2={H - B} stroke="var(--w-bad)" strokeDasharray="4 3" />)}
        <polyline points={pts.join(' ')} fill="none" stroke="var(--w-b1)" strokeWidth={2} />
        <text x={X(-Q / 4)} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-bad)">−q/4</text>
        <text x={X(Q / 4)} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-bad)">q/4</text>
        <text x={X(0)} y={H - 8} fontSize="12" textAnchor="middle" fill="var(--w-muted)">0</text>
      </svg>
      <div className="stats">
        <div className="stat"><span>잡음 표준편차</span><b>{sd.toFixed(1)} (q/4 의 {(100 * sd / (Q / 4)).toFixed(0)}%)</b></div>
        <div className="stat"><span>복호 실패 확률 δ</span><b className={l2 < -128 ? 'good' : 'bad'}>{verdict}</b></div>
        <div className="stat"><span>FIPS 203 표 값</span><b>{preset ? `2^${FIPS_LOG2_DELTA[preset]}` : '— (사용자 설정)'}</b></div>
        <div className="stat"><span>ek / ct 크기</span><b>{sz.ek.toLocaleString()} B / {sz.ct.toLocaleString()} B</b></div>
      </div>
      <p className="note">이 계산은 잡음의 계수들을 서로 독립으로 보고(실제로는 약하게 상관) 256 개 계수에 합집합 상한을 씁니다. 설계 문서와 같은 모델이며, FIPS 표 값과 0.5비트 안에서 맞습니다. η 를 키우면 안전성(LWE 오차)은 오르지만 δ 가 커지고, d 를 줄이면 암호문이 작아지지만 역시 δ 가 커집니다. <b>세 손잡이의 줄다리기</b>가 파라미터 설계입니다. (안전성은 이 위젯이 계산하지 않습니다. 18장의 추정기를 보세요.)</p>
    </div>
  );
}
