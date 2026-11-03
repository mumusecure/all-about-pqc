import { useMemo, useState } from 'react';
import { mulberry32 } from '../lib/lwe';
import { center, ntruDecrypt, ntruEncrypt, ntruKeyGen, ternary } from '../lib/ntru';

function Row({ label, p, scale, color, note, bad }: { label: string; p: number[]; scale: number; color: string; note?: string; bad?: (i: number) => boolean }) {
  const n = p.length, W = 620, H = 64, mid = 32, L = 74;
  const bw = (W - L - 4) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${p.join(', ')}`}>
      <text x={0} y={mid - 4} fontSize="13" fontWeight="700" fill="var(--w-text)">{label}</text>
      {note && <text x={0} y={mid + 12} fontSize="10" fill="var(--w-muted)">{note}</text>}
      <line x1={L} x2={W} y1={mid} y2={mid} stroke="var(--w-grid)" />
      {p.map((c, i) => {
        const h = Math.max(0.8, (Math.abs(c) / scale) * 28);
        return <rect key={i} x={L + i * bw} y={c >= 0 ? mid - h : mid} width={Math.max(1, bw - 1)} height={h} fill={bad?.(i) ? 'var(--w-bad)' : color} opacity={0.85} />;
      })}
    </svg>
  );
}

/**
 * 토이 NTRU 한 바퀴: 공개키 h 와 암호문 c 는 무작위처럼 보이지만,
 * 비밀키 f 를 곱하면 a = f·c = 3·g·r + f·m 이 ‘작아지고’, mod 3 으로 m 이 나온다.
 */
export default function NTRUToy() {
  const [n, setN] = useState(32);
  const [q, setQ] = useState(769);
  const [seed, setSeed] = useState(1);
  const [mseed, setMseed] = useState(1);

  const key = useMemo(() => ntruKeyGen(n, q, mulberry32(seed * 7919 + n * 31 + q)), [n, q, seed]);
  const run = useMemo(() => {
    const rng = mulberry32(mseed * 104729 + seed);
    const m = ternary(n, rng);
    const { c } = ntruEncrypt(key, m, rng);
    const { a, m: m2 } = ntruDecrypt(key, c);
    // 실패율
    let fail = 0;
    const T = 200;
    for (let t = 0; t < T; t++) {
      const mm = ternary(n, rng);
      const { c: cc } = ntruEncrypt(key, mm, rng);
      if (ntruDecrypt(key, cc).m.some((x, i) => x !== mm[i])) fail++;
    }
    return { m, c, a, m2, fail, T };
  }, [key, mseed]);

  const maxA = Math.max(...run.a.map(Math.abs));
  const ok = run.m2.every((x, i) => x === run.m[i]);
  const half = q / 2;

  return (
    <div className="widget not-content">
      <h4>토이 NTRU 한 바퀴 (ℤ_q[x]/(xⁿ+1), p = 3)</h4>
      <p className="widget-sub">h 와 c 는 ℤ_q 전체에 퍼진 무작위처럼 보입니다(막대 높이 = 중심 대표값, 눈금 ±q/2). 그런데 f 를 곱한 a = f·c 는 작습니다. 그래서 a mod 3 이 곧 메시지입니다.</p>
      <div className="controls">
        <label className="slider">차수 n <b>{n}</b>
          <select value={n} onChange={(e) => setN(+e.target.value)}>{[8, 16, 32, 64].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label>
        <label className="slider">모듈러스 q <b>{q}</b>
          <select value={q} onChange={(e) => setQ(+e.target.value)}>{[97, 193, 257, 769, 3329].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label>
        <div className="row">
          <button onClick={() => setSeed((s) => s + 1)}>새 키</button>
          <button onClick={() => setMseed((s) => s + 1)}>새 메시지</button>
        </div>
      </div>
      <Row label="f = 1+3F" note="비밀키 (작음)" p={key.f} scale={half} color="var(--w-gs)" />
      <Row label="g" note="비밀 (작음)" p={key.g} scale={half} color="var(--w-gs)" />
      <Row label="h = 3g/f" note="공개키" p={center(key.h, q)} scale={half} color="var(--w-b2)" />
      <Row label="m" note="메시지 {−1,0,1}" p={run.m} scale={half} color="var(--w-b1)" />
      <Row label="c = rh + m" note="암호문" p={center(run.c, q)} scale={half} color="var(--w-b2)" />
      <Row label="a = f·c" note="= 3gr + fm" p={run.a} scale={half} color="var(--w-good)" bad={(i) => Math.abs(run.a[i]) >= half - 0.5} />
      <Row label="a mod 3" note="복호 결과" p={run.m2} scale={half} color="var(--w-b1)" bad={(i) => run.m2[i] !== run.m[i]} />
      <div className="stats">
        <div className="stat"><span>max |a| vs q/2</span><b className={maxA < half ? 'good' : 'bad'}>{maxA} vs {half}</b></div>
        <div className="stat"><span>이번 복호</span><b className={ok ? 'good' : 'bad'}>{ok ? '성공' : '실패'}</b></div>
        <div className="stat"><span>실패율 (암호문 {run.T}개)</span><b className={run.fail ? 'bad' : 'good'}>{run.fail}/{run.T}</b></div>
        <div className="stat"><span>공개키 크기</span><b>{n}·⌈log₂ q⌉ = {n * Math.ceil(Math.log2(q))} 비트</b></div>
      </div>
      <p className="note">q 를 97 로 낮추고 n 을 64 로 올려 보세요. a 의 계수가 ±q/2 를 넘어 ‘감기는’ 순간(빨강) 복호가 틀립니다. 막대 높이는 모두 q/2 기준이라, 작은 값(f, g, m)은 거의 보이지 않을 만큼 작습니다.</p>
    </div>
  );
}
