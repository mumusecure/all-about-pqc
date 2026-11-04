import { useState } from 'react';

/**
 * 부호 기반 암호의 안전성 감: Prange 정보 집합 복호(ISD)의 시도 횟수 C(n, t) / C(n−k, t).
 * 무작위로 고른 k 개 좌표(정보 집합)에 오류가 하나도 없으면 가우스 소거 한 번으로 복호된다.
 */
const lg2C = (n: number, r: number) => { let s = 0; for (let i = 0; i < r; i++) s += Math.log2((n - i) / (r - i)); return s; };
const PRESETS = [
  { name: 'mceliece348864 (I)', n: 3488, k: 2720, t: 64 },
  { name: 'mceliece460896 (III)', n: 4608, k: 3360, t: 96 },
  { name: 'mceliece6960119 (V)', n: 6960, k: 5413, t: 119 },
  { name: 'mceliece8192128 (V)', n: 8192, k: 6528, t: 128 },
  { name: '원조 McEliece 1978', n: 1024, k: 524, t: 50 },
];
export default function PrangeCalc() {
  const [n, setN] = useState(3488), [k, setK] = useState(2720), [t, setT] = useState(64);
  const kk = Math.min(k, n - 1), tt = Math.min(t, n - kk);
  const work = lg2C(n, tt) - lg2C(n - kk, tt);
  const pk = ((n - kk) * kk) / 8, ct = (n - kk) / 8;
  return (
    <div className="widget not-content">
      <h4>Prange ISD: 오류 t 개를 피하는 정보 집합 찾기</h4>
      <p className="widget-sub">길이 n, 차원 k 인 이진 선형 부호에서 무게 t 의 오류 e 를 신드롬 s = He 로부터 찾는 문제(신드롬 복호). Prange: 좌표 k 개를 무작위로 골라 그곳에 오류가 없기를 바란다. 성공 확률 = C(n−k, t)/C(n, t).</p>
      <div className="row">
        {PRESETS.map((P) => <button key={P.name} className={P.n === n && P.k === k && P.t === t ? 'primary' : ''} onClick={() => { setN(P.n); setK(P.k); setT(P.t); }}>{P.name}</button>)}
      </div>
      <div className="controls">
        <label className="slider">길이 n <b>{n}</b><input type="range" min={256} max={8192} step={16} value={n} onChange={(e) => setN(+e.target.value)} /></label>
        <label className="slider">차원 k <b>{kk}</b><input type="range" min={64} max={n - 16} step={8} value={kk} onChange={(e) => setK(+e.target.value)} /></label>
        <label className="slider">오류 무게 t <b>{tt}</b><input type="range" min={4} max={200} value={tt} onChange={(e) => setT(+e.target.value)} /></label>
      </div>
      <div className="stats">
        <div className="stat"><span>Prange 시도 횟수 (log₂)</span><b>{work.toFixed(1)}</b></div>
        <div className="stat"><span>부호율 k/n</span><b>{(kk / n).toFixed(3)}</b></div>
        <div className="stat"><span>공개키 (n−k)·k 비트</span><b>{pk >= 1e6 ? `${(pk / 1e6).toFixed(2)} MB` : `${Math.round(pk / 1000).toLocaleString()} KB`}</b></div>
        <div className="stat"><span>암호문 = 신드롬 (n−k) 비트</span><b>{Math.ceil(ct)} B</b></div>
      </div>
      <p className="note">다항 인자(가우스 소거 비용)를 뺀 값입니다. mceliece348864 는 Prange 기준 약 2^143 이고, Stern·MMT·BJMM 같은 개선 ISD 는 생일 역설과 표 조합으로 지수를 줄여 실제 추정은 이보다 수십 비트 낮습니다. 그래도 1978년 이후 45년 넘게 개선은 지수의 상수에만 머물렀습니다. 공개키는 체계적 생성 행렬의 비자명 부분 (n−k)×k 비트라 수백 KB~1 MB 로 크고, 대신 암호문은 신드롬 하나라 100~200 바이트로 작습니다.</p>
    </div>
  );
}
