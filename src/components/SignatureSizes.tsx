import { useState } from 'react';

/** 128 비트(범주 1~2)급 양자 내성 서명의 공개키·서명 크기 (바이트). 출처는 본문 표. */
const DATA = [
  { name: 'SQIsign (I)', family: '동종사상', pk: 83, sig: 200 },
  { name: 'FN-DSA-512', family: '격자', pk: 897, sig: 666 },
  { name: 'HAETAE-120', family: '격자', pk: 992, sig: 1474 },
  { name: 'ML-DSA-44', family: '격자', pk: 1312, sig: 2420 },
  { name: 'SLH-DSA-128s', family: '해시', pk: 32, sig: 7856 },
  { name: 'SLH-DSA-128f', family: '해시', pk: 32, sig: 17088 },
];
type Mode = 'sum' | 'sig' | 'pk';

export default function SignatureSizes() {
  const [mode, setMode] = useState<Mode>('sum');
  const val = (d: (typeof DATA)[number]) => (mode === 'sum' ? d.pk + d.sig : mode === 'sig' ? d.sig : d.pk);
  const sorted = [...DATA].sort((a, b) => val(a) - val(b));
  const max = Math.log10(Math.max(...DATA.map(val)) * 1.2), min = 1;
  const W = 620, rowH = 30, L = 130, R = 70, H = sorted.length * rowH + 10;
  const X = (v: number) => L + ((W - L - R) * (Math.log10(v) - min)) / (max - min);
  const col = (f: string) => (f === '격자' ? 'var(--w-b1)' : f === '해시' ? 'var(--w-good)' : 'var(--w-b2)');
  return (
    <div className="widget not-content">
      <h4>서명 크기 비교: 동종사상은 가장 작다</h4>
      <p className="widget-sub">128 비트급(NIST 범주 1~2) 표준·후보 서명의 크기, 로그 눈금. 주황 = 동종사상, 파랑 = 격자, 초록 = 해시.</p>
      <div className="row">
        {([['sum', '공개키 + 서명'], ['sig', '서명'], ['pk', '공개키']] as [Mode, string][]).map(([m, l]) => <button key={m} className={mode === m ? 'primary' : ''} onClick={() => setMode(m)}>{l}</button>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="서명 크기">
        {sorted.map((d, i) => <g key={d.name}>
          <text x={L - 6} y={i * rowH + 22} fontSize="13" textAnchor="end" fill="var(--w-text)">{d.name}</text>
          <rect x={L} y={i * rowH + 8} width={Math.max(2, X(val(d)) - L)} height={18} fill={col(d.family)} rx={3} />
          <text x={X(val(d)) + 6} y={i * rowH + 22} fontSize="12" fill="var(--w-muted)">{val(d).toLocaleString()} B</text>
        </g>)}
      </svg>
      <p className="note">SQIsign 은 공개키와 서명을 합쳐도 300 바이트가 안 되어 가장 작지만, 서명 생성이 수십 ms 로 격자 서명(수십~수백 μs)보다 몇 자릿수 느립니다. SLH-DSA 는 공개키가 32 바이트로 가장 작고 가정이 가장 보수적(해시 함수뿐)이지만 서명이 큽니다. 크기·속도·가정의 보수성이라는 세 축이 서로 다른 지점을 고른 것입니다(24장).</p>
    </div>
  );
}
