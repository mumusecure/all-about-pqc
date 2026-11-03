import { useState } from 'react';
import { embeddingAttack, mulberry32, sampleLWE } from '../lib/lwe';

interface Row { n: number; m: number; q: number; sigma: number; d: number; target: number; gh: number; ok: number; trials: number; ms: number; }

const TRIALS = 3;

/**
 * 브라우저 안에서 실제로 LWE 를 공격한다: (A, b) → 임베딩 격자 → LLL(δ=0.99) → (e, −s, 1) 탐색.
 * 파라미터를 키워가며 공격이 ‘갑자기’ 실패하는 지점을 찾는 실험실.
 */
export default function LWEAttackLab() {
  const [n, setN] = useState(16);
  const [q, setQ] = useState(97);
  const [sigma, setSigma] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const m = 2 * n;

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      let ok = 0, ms = 0, target = 0, gh = 0, d = 0;
      for (let t = 0; t < TRIALS; t++) {
        const inst = sampleLWE({ n, m, q, sigma }, mulberry32(Date.now() + t * 7919));
        const r = embeddingAttack(inst);
        ok += +r.success; ms += r.ms; target += r.targetNorm / TRIALS; gh = r.gaussianHeuristic; d = r.dim;
      }
      setRows((rs) => [{ n, m, q, sigma, d, target, gh, ok, trials: TRIALS, ms: ms / TRIALS }, ...rs].slice(0, 12));
      setBusy(false);
    }, 30);
  };

  const d = m + n + 1;
  return (
    <div className="widget not-content">
      <h4>실험실: 브라우저에서 LWE 깨기</h4>
      <p className="widget-sub">짧은 비밀 LWE 를 만들고, 임베딩 격자에 LLL 을 돌려 비밀을 복구해 봅니다 (각 설정 {TRIALS}회, m = 2n). n 을 키우다 보면 성공률이 갑자기 0이 되는 구간이 나옵니다.</p>
      <div className="controls">
        <label className="slider">비밀 차원 n <b>{n}</b> (격자 차원 d = {d})
          <input type="range" min={4} max={48} step={2} value={n} onChange={(e) => setN(+e.target.value)} />
        </label>
        <label className="slider">모듈러스 q <b>{q}</b>
          <select value={q} onChange={(e) => setQ(+e.target.value)}>
            {[97, 257, 769, 3329].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="slider">오차 표준편차 σ <b>{sigma.toFixed(1)}</b>
          <input type="range" min={0.5} max={4} step={0.5} value={sigma} onChange={(e) => setSigma(+e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button className="primary" onClick={run} disabled={busy}>{busy ? 'LLL 실행 중…' : '공격 실행'}</button>
        <button onClick={() => setRows([])} disabled={busy}>기록 지우기</button>
        {n >= 40 && q >= 3329 && <span className="note">큰 설정은 몇 초 걸릴 수 있어요.</span>}
      </div>
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>n</th><th>q</th><th>σ</th><th>d</th><th>‖(e,−s,1)‖</th><th>GH</th><th>gap</th><th>성공</th><th>시간</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.n}</td><td>{r.q}</td><td>{r.sigma}</td><td>{r.d}</td>
                  <td>{r.target.toFixed(1)}</td><td>{r.gh.toFixed(1)}</td>
                  <td>{(r.gh / r.target).toFixed(2)}</td>
                  <td className={r.ok === r.trials ? 'good' : r.ok === 0 ? 'bad' : ''}>{r.ok}/{r.trials}</td>
                  <td>{r.ms.toFixed(0)}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">
        GH = Gaussian heuristic(“보통” 최단 벡터 길이의 예측), gap = GH ÷ ‖숨은 벡터‖. 숨은 벡터가 다른 벡터들보다 충분히 짧을수록(gap 이 클수록) LLL 이 찾아냅니다.
        그런데 LLL 이 찾아낼 수 있는 gap 의 문턱은 차원 d 가 커질수록 (대략 지수적으로) 올라갑니다. 그래서 gap 이 거의 그대로여도 d 가 커지면 어느 순간 실패합니다. 이 문턱을 정량화하는 것이 18장의 주제이고, 실제 ML-KEM 은 LLL 보다 훨씬 강한 BKZ 공격까지 상정해 파라미터를 고릅니다.
      </p>
    </div>
  );
}
