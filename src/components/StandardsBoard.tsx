import { useState } from 'react';

/**
 * 양자 내성 알고리즘 표준화 현황판 (2026-11 기준, 본문 24장 9절과 같은 자료).
 * 날짜·상태는 바뀌므로 최신 정보는 NIST CSRC·KpqC·각 팀 사이트에서 확인.
 */
type Row = { name: string; family: string; kind: 'KEM' | '서명'; status: '표준' | '표준 예정' | '후보' | '탈락·철회' | '국가 권고'; note: string };
const ROWS: Row[] = [
  { name: 'ML-KEM (Kyber)', family: '격자', kind: 'KEM', status: '표준', note: 'NIST FIPS 203 (2024-08). 16장' },
  { name: 'ML-DSA (Dilithium)', family: '격자', kind: '서명', status: '표준', note: 'NIST FIPS 204 (2024-08). 17장' },
  { name: 'SLH-DSA (SPHINCS+)', family: '해시', kind: '서명', status: '표준', note: 'NIST FIPS 205 (2024-08). 상태 없는 해시 서명' },
  { name: 'XMSS / LMS', family: '해시', kind: '서명', status: '표준', note: 'RFC 8391·8554, NIST SP 800-208 (2020). 상태 관리 필요, 펌웨어 서명용' },
  { name: 'FN-DSA (Falcon)', family: '격자', kind: '서명', status: '표준 예정', note: 'NIST FIPS 206 작업 중(2026-11 현재 최종본 미공개). 17장' },
  { name: 'HQC', family: '부호', kind: 'KEM', status: '표준 예정', note: '2025-03 NIST 추가 KEM 으로 선정, FIPS 207 준비 중(2026-10 기준 공개 초안 없음으로 보도), 최종 2027 목표' },
  { name: 'Classic McEliece', family: '부호', kind: 'KEM', status: '국가 권고', note: 'NIST 4라운드에서 미선정. 독일 BSI 등이 권고, ISO/IEC 표준화 작업 진행' },
  { name: 'FrodoKEM', family: '격자', kind: 'KEM', status: '국가 권고', note: '비구조 LWE. NIST 미선정, BSI 등이 보수적 선택지로 권고, ISO/IEC 작업 진행' },
  { name: 'BIKE', family: '부호', kind: 'KEM', status: '탈락·철회', note: 'QC-MDPC. NIST 4라운드에서 HQC 에 밀려 미선정' },
  { name: 'SMAUG-T', family: '격자', kind: 'KEM', status: '표준', note: 'KpqC 최종 선정 (2025-01)' },
  { name: 'NTRU+', family: '격자', kind: 'KEM', status: '표준', note: 'KpqC 최종 선정 (2025-01). 15장' },
  { name: 'HAETAE', family: '격자', kind: '서명', status: '표준', note: 'KpqC 최종 선정 (2025-01). 17장' },
  { name: 'AIMer', family: 'MPCitH', kind: '서명', status: '표준', note: 'KpqC 최종 선정 (2025-01). 대칭 원시(AIM)만 가정' },
  { name: 'UOV', family: '다변수', kind: '서명', status: '후보', note: 'NIST 추가 서명 3라운드 (2026-05)' },
  { name: 'MAYO', family: '다변수', kind: '서명', status: '후보', note: 'NIST 추가 서명 3라운드. UOV 의 작은 공개키 변형' },
  { name: 'SNOVA', family: '다변수', kind: '서명', status: '후보', note: 'NIST 추가 서명 3라운드. 비가환 환 위 UOV' },
  { name: 'QR-UOV', family: '다변수', kind: '서명', status: '후보', note: 'NIST 추가 서명 3라운드. 확대체 위 UOV' },
  { name: 'FAEST', family: 'MPCitH', kind: '서명', status: '후보', note: 'NIST 추가 서명 3라운드. VOLE-in-the-head, AES 만 가정' },
  { name: 'SDitH', family: 'MPCitH', kind: '서명', status: '후보', note: 'NIST 추가 서명 3라운드. 신드롬 복호 + MPCitH' },
  { name: 'MQOM', family: 'MPCitH', kind: '서명', status: '후보', note: 'NIST 추가 서명 3라운드. MQ + MPCitH' },
  { name: 'SQIsign', family: '동종사상', kind: '서명', status: '후보', note: 'NIST 추가 서명 3라운드. 23장' },
  { name: 'HAWK', family: '격자', kind: '서명', status: '탈락·철회', note: '3라운드 진출 후 키 복구 공격이 발표되어 제출팀이 철회 (2026-07)' },
  { name: 'CROSS · LESS', family: '부호', kind: '서명', status: '탈락·철회', note: 'NIST 추가 서명 2라운드에서 탈락 (2026-05)' },
  { name: 'Mirath · PERK · RYDE', family: 'MPCitH', kind: '서명', status: '탈락·철회', note: 'NIST 추가 서명 2라운드에서 탈락 (2026-05)' },
  { name: 'Rainbow', family: '다변수', kind: '서명', status: '탈락·철회', note: 'NIST 3라운드 결선 후보, 2022 Beullens 공격으로 붕괴' },
  { name: 'SIKE', family: '동종사상', kind: 'KEM', status: '탈락·철회', note: 'NIST 4라운드 후보, 2022 Castryck–Decru 공격으로 붕괴. 23장' },
];
const FAMILIES = ['전체', '격자', '해시', '부호', '다변수', 'MPCitH', '동종사상'];
const STATUSES = ['전체', '표준', '표준 예정', '후보', '국가 권고', '탈락·철회'];
const color = (s: Row['status']) => (s === '표준' ? 'var(--w-good)' : s === '표준 예정' ? 'var(--w-b1)' : s === '후보' ? 'var(--w-gs)' : s === '국가 권고' ? 'var(--w-muted)' : 'var(--w-bad)');

export default function StandardsBoard() {
  const [fam, setFam] = useState('전체');
  const [st, setSt] = useState('전체');
  const [kind, setKind] = useState('전체');
  const rows = ROWS.filter((r) => (fam === '전체' || r.family === fam) && (st === '전체' || r.status === st) && (kind === '전체' || r.kind === kind));
  return (
    <div className="widget not-content">
      <h4>표준화 현황판 (2026년 11월 기준)</h4>
      <p className="widget-sub">NIST(미국)와 KpqC(한국)를 중심으로 한 상태. 표준 = 최종 표준 또는 국가 공모 최종 선정, 국가 권고 = NIST 표준은 아니지만 일부 기관이 권고.</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <label>가문 <select value={fam} onChange={(e) => setFam(e.target.value)}>{FAMILIES.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label>종류 <select value={kind} onChange={(e) => setKind(e.target.value)}>{['전체', 'KEM', '서명'].map((f) => <option key={f}>{f}</option>)}</select></label>
        <label>상태 <select value={st} onChange={(e) => setSt(e.target.value)}>{STATUSES.map((f) => <option key={f}>{f}</option>)}</select></label>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>이름</th><th>가문</th><th>종류</th><th>상태</th><th>비고</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td><b>{r.name}</b></td><td>{r.family}</td><td>{r.kind}</td>
                <td><span style={{ color: color(r.status), fontWeight: 700, whiteSpace: 'nowrap' }}>{r.status}</span></td>
                <td style={{ fontSize: '0.8rem' }}>{r.note}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5}>해당하는 항목이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="note">{rows.length} 개 표시. 표준화는 움직이는 과녁입니다. 이 표의 날짜와 상태는 2026년 11월에 정리한 것이므로, 인용하기 전에 NIST CSRC 의 PQC 페이지와 KpqC, 각 제출팀 사이트에서 최신 상태를 확인하세요.</p>
    </div>
  );
}
