import { useMemo, useState } from 'react';
import { lamportForge, lamportKeyGen, lamportKnowledge, lamportVerify, wotsParams } from '../lib/hashsig';

/**
 * Lamport 일회용 서명을 같은 키로 k 번 쓰면 무엇이 드러나는가, 그리고 실제 위조.
 * 아래에는 Winternitz 의 밑 w 에 따른 크기·계산량 절충.
 */
const MSGS = ['송금 1만 원', '송금 2만 원', '계약서 v1', '계약서 v2', '로그인 토큰', '펌웨어 1.0.3', '공지사항', '영수증 #8'];
const BUDGET = 1 << 17;
type Forge = { message: string; tries: number; ok: boolean } | { fail: true; tries: number } | null;

export default function HashSigLab() {
  const [k, setK] = useState(1);
  const [w, setW] = useState(16);
  const [forge, setForge] = useState<Forge>(null);
  const [busy, setBusy] = useState(false);
  const key = useMemo(() => lamportKeyGen('textbook-demo'), []);
  const kn = useMemo(() => lamportKnowledge(MSGS.slice(0, k)), [k]);
  const expected = 256 * 2 ** (1 - k);
  const run = () => {
    setBusy(true); setForge(null);
    setTimeout(() => {
      const f = lamportForge(key, MSGS.slice(0, k), BUDGET);
      setForge(f ? { message: f.message, tries: f.tries, ok: lamportVerify(key.pk, f.message, f.sig) } : { fail: true, tries: BUDGET });
      setBusy(false);
    }, 20);
  };
  const cell = 15, cols = 32;
  const ws = [2, 4, 16, 256].map(wotsParams);
  return (
    <div className="widget not-content">
      <h4>Lamport 서명을 재사용하면</h4>
      <p className="widget-sub">비밀키는 위치 i = 0..255 마다 두 값 (sk[i][0], sk[i][1]). 서명은 메시지 해시의 i 번째 비트에 해당하는 값을 공개합니다. 같은 키로 서명한 메시지가 늘수록 두 값이 모두 드러난 위치(초록)가 늘어납니다.</p>
      <div className="controls">
        <label className="slider">같은 키로 서명한 메시지 수 k <b>{k}</b>
          <input type="range" min={1} max={8} value={k} onChange={(e) => { setK(+e.target.value); setForge(null); }} />
        </label>
      </div>
      <p className="note" style={{ marginTop: 0 }}>서명한 메시지: {MSGS.slice(0, k).map((m) => `“${m}”`).join(', ')}</p>
      <svg viewBox={`0 0 ${cols * cell} ${(256 / cols) * cell}`} style={{ maxWidth: 520 }} role="img" aria-label="비트 위치별로 드러난 비밀">
        {kn.known.map((b, i) => (
          <rect key={i} x={(i % cols) * cell + 1} y={Math.floor(i / cols) * cell + 1} width={cell - 2} height={cell - 2} rx={2}
            fill={b[0] && b[1] ? 'var(--w-good)' : 'var(--w-b1)'} opacity={b[0] && b[1] ? 0.85 : 0.35} />
        ))}
      </svg>
      <p className="widget-sub">초록 = 두 비밀 모두 공개(어느 비트든 서명 가능), 연한 파랑 = 한쪽만 공개(그 비트 값이어야 함).</p>
      <div className="stats">
        <div className="stat"><span>두 값 모두 드러난 위치</span><b>{kn.free} / 256</b></div>
        <div className="stat"><span>위조에 필요한 시도 (log₂)</span><b className={kn.log2Work <= 20 ? 'bad' : 'good'}>2^{kn.log2Work}</b></div>
        <div className="stat"><span>기댓값 256·2^(1−k)</span><b>2^{expected < 1 ? expected.toFixed(2) : expected.toFixed(1)}</b></div>
      </div>
      <div className="row">
        <button className="primary" onClick={run} disabled={busy}>{busy ? '찾는 중…' : `위조 시도 (메시지 최대 2^17 개)`}</button>
      </div>
      {forge && ('fail' in forge
        ? <p className="note"><span className="good">실패</span>: 2^17 개를 해시해도 위조 가능한 메시지가 없었습니다. 필요한 시도가 약 2^{kn.log2Work} 이니 당연합니다. k 를 5 이상으로 올려 보세요.</p>
        : <p className="note"><span className="bad">위조 성공</span>: 메시지 “{forge.message}” 를 {forge.tries.toLocaleString()} 번째 시도에 찾았고, 앞선 서명들에서 본 비밀만으로 조립한 서명이 검증을 <b className={forge.ok ? 'bad' : 'good'}>{forge.ok ? '통과' : '통과하지 못함'}</b>했습니다. 비밀키는 한 번도 쓰지 않았습니다.</p>)}
      <h4 style={{ marginTop: '1.25rem' }}>Winternitz: 서명 크기와 해시 횟수의 절충</h4>
      <p className="widget-sub">256 비트 메시지를 밑 w 의 자리 len₁ 개로 쓰고, 위조를 막는 체크섬 len₂ 자리를 덧붙입니다. 체인 하나는 해시 w − 1 번(해시 출력 32 바이트 기준).</p>
      <div className="row">
        {[2, 4, 16, 256].map((x) => <button key={x} className={w === x ? 'primary' : ''} onClick={() => setW(x)}>w = {x}</button>)}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>w</th><th>len₁ + len₂</th><th>서명 (바이트)</th><th>키 생성 해시</th><th>서명 평균 해시</th></tr></thead>
          <tbody>
            <tr><td>Lamport</td><td>256 (×2 비밀)</td><td>8,192</td><td>512</td><td>0</td></tr>
            {ws.map((p) => (
              <tr key={p.w} style={p.w === w ? { fontWeight: 700, background: 'var(--w-fill)' } : undefined}>
                <td>{p.w}</td><td>{p.len1} + {p.len2} = {p.len}</td><td>{p.sigBytes.toLocaleString()}</td><td>{p.keygenHashes.toLocaleString()}</td><td>{p.avgSignHashes.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">위조 작업량은 대략 2^(256·2^(1−k)) 이라 한 번이면 2^256, 두 번이면 약 2^128, 다섯 번이면 약 2^16 으로 무너집니다. 그래서 일회용 서명을 여러 번 쓰려면 Merkle 트리(XMSS·LMS)로 키 여러 개를 묶고 "몇 번째 키를 썼는지"라는 상태를 지켜야 합니다. w 를 키우면 서명은 줄지만 계산이 지수적으로 늘어 SPHINCS+/SLH-DSA 는 w = 16 을 씁니다(체인 67 개는 32 바이트 해시 기준이고, 128 비트 파라미터는 16 바이트 해시라 35 개).</p>
    </div>
  );
}
