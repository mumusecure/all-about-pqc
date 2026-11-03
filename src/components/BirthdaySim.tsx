import { useState } from 'react';
import { birthdayTrial } from '../lib/games';

/** 생일 공격: t 비트 해시에서 충돌이 나기까지의 질의 수를 측정해 √(π/2·2^t) 와 비교한다. */
export default function BirthdaySim() {
  const [t, setT] = useState(20);
  const [res, setRes] = useState<{ t: number; trials: number[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const base = Date.now() % 1e6;
      const trials = Array.from({ length: 100 }, (_, i) => birthdayTrial(t, base + i));
      setRes({ t, trials });
      setBusy(false);
    }, 20);
  };
  const pred = Math.sqrt((Math.PI / 2) * 2 ** t);
  const avg = res ? res.trials.reduce((a, b) => a + b, 0) / res.trials.length : 0;

  const W = 620, H = 150, L = 10, R = 10, BIN = 30;
  let chart = null;
  if (res) {
    const mx = Math.max(...res.trials);
    const hist = new Array(BIN).fill(0);
    res.trials.forEach((x) => hist[Math.min(BIN - 1, Math.floor((x / mx) * BIN))]++);
    const hm = Math.max(...hist);
    const bw = (W - L - R) / BIN;
    const xp = L + ((W - L - R) * pred) / mx;
    chart = (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="충돌까지 질의 수 분포">
        {hist.map((c, i) => <rect key={i} x={L + i * bw} y={H - 20 - ((H - 34) * c) / hm} width={bw - 1} height={((H - 34) * c) / hm} fill="var(--w-b1)" opacity={0.8} />)}
        <line x1={xp} x2={xp} y1={8} y2={H - 20} stroke="var(--w-bad)" strokeDasharray="4 3" strokeWidth={2} />
        <text x={Math.min(xp + 4, W - 120)} y={18} fontSize="11" fill="var(--w-bad)">√(π/2·2^t) ≈ {Math.round(pred).toLocaleString()}</text>
        <text x={L} y={H - 5} fontSize="10" fill="var(--w-muted)">0</text>
        <text x={W - R} y={H - 5} fontSize="10" textAnchor="end" fill="var(--w-muted)">{mx.toLocaleString()} 회</text>
      </svg>
    );
  }
  return (
    <div className="widget not-content">
      <h4>생일 공격: 충돌은 2^t 가 아니라 2^(t/2) 번이면 나온다</h4>
      <p className="widget-sub">출력이 t 비트인 (의사)무작위 함수에 서로 다른 입력을 넣어, 같은 출력이 처음 나올 때까지의 횟수를 100번 측정합니다.</p>
      <label className="slider">출력 길이 t <b>{t} 비트</b> (가능한 출력 2^{t} = {(2 ** t).toLocaleString()} 개)
        <input type="range" min={8} max={28} value={t} onChange={(e) => setT(+e.target.value)} />
      </label>
      <div className="row"><button className="primary" onClick={run} disabled={busy}>{busy ? '측정 중…' : '100번 측정'}</button></div>
      {chart}
      {res && (
        <div className="stats">
          <div className="stat"><span>평균 질의 수 (t = {res.t})</span><b>{Math.round(avg).toLocaleString()}</b></div>
          <div className="stat"><span>예측 √(π/2·2^t)</span><b>{Math.round(Math.sqrt((Math.PI / 2) * 2 ** res.t)).toLocaleString()}</b></div>
          <div className="stat"><span>전수조사 2^t (역상 찾기)</span><b>{(2 ** res.t).toLocaleString()}</b></div>
          <div className="stat"><span>양자 충돌 탐색 (BHT) ~2^(t/3)</span><b>{Math.round(2 ** (res.t / 3)).toLocaleString()}</b></div>
        </div>
      )}
      <p className="note">그래서 충돌 저항성 λ 비트를 원하면 출력이 2λ 비트여야 합니다(SHA-256 → 128비트 충돌 저항). 양자 알고리즘(Brassard–Høyer–Tapp)은 이론상 2^(t/3) 까지 줄이지만 메모리 비용 때문에 실제 위협 평가에서는 논쟁이 있습니다.</p>
    </div>
  );
}
