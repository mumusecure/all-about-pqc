import { useState } from 'react';
import { type AdvKey, type GameResult, type SchemeKey, M_SAMPLES, N_DIM, Q, playIND } from '../lib/games';

const schemes: { key: SchemeKey; label: string }[] = [
  { key: 'regev', label: `Regev 암호 (n=${N_DIM}, m=${M_SAMPLES}, q=${Q}, σ=1.5)` },
  { key: 'regev0', label: 'Regev 암호, 노이즈 없음 (σ = 0)' },
  { key: 'det', label: '결정적 암호화 c = H(pk‖m)' },
];
const advs: { key: AdvKey; label: string; desc: string }[] = [
  { key: 'guess', label: '무작위 추측', desc: '동전을 던져 b′ 를 고른다. 이득은 항상 0 근처.' },
  { key: 'reencrypt', label: '재암호화 비교', desc: '공개키로 m₁ 을 직접 암호화해 도전 암호문과 같은지 본다.' },
  { key: 'solve', label: '가우스 소거로 비밀 찾기', desc: '공개키 (A, b) 에서 b = As 를 연립방정식으로 풀어 s 를 구하고 복호한다.' },
  { key: 'maul', label: '변조 후 복호 질의 (CCA)', desc: '(u, v + ⌊q/2⌋) 를 복호 오라클에 묻는다. 도전 암호문과 다르니 허용된다. 답은 1 − b.' },
];

interface Row { scheme: SchemeKey; adv: AdvKey; mode: 'cpa' | 'cca'; r: GameResult; }

/**
 * IND-CPA / IND-CCA 게임 시뮬레이터.
 * 도전자가 b ← {0,1} 을 숨기고 m_b 의 암호문을 준다. 공격자는 b′ 를 추측한다.
 * 이득 = |Pr[b′ = b] − 1/2|. 수백 번 반복해 경험적 이득과 95% 신뢰구간을 보여준다.
 */
export default function INDGameSim() {
  const [scheme, setScheme] = useState<SchemeKey>('regev');
  const [adv, setAdv] = useState<AdvKey>('reencrypt');
  const [mode, setMode] = useState<'cpa' | 'cca'>('cpa');
  const [games, setGames] = useState(400);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const r = playIND(scheme, adv, mode, games, (Date.now() % 1e9) + 1);
      setRows((rs) => [{ scheme, adv, mode, r }, ...rs].slice(0, 12));
      setBusy(false);
    }, 20);
  };
  const advInfo = advs.find((a) => a.key === adv)!;
  const label = (k: SchemeKey) => schemes.find((s) => s.key === k)!.label.split(' (')[0];

  return (
    <div className="widget not-content">
      <h4>안전성 게임 시뮬레이터</h4>
      <p className="widget-sub">스킴과 공격자 전략을 골라 IND 게임을 여러 번 해 보세요. 메시지는 m₀ = 0, m₁ = 1. 이득이 신뢰구간보다 확실히 크면 그 공격은 ‘성공’입니다.</p>
      <ol style={{ fontSize: '0.85rem', margin: '0 0 0.6rem 1.1rem', padding: 0 }}>
        <li>도전자: (pk, sk) 생성, pk 를 공격자에게 준다.</li>
        <li>도전자: 비밀 동전 b ← {'{0, 1}'}, 도전 암호문 c* = Enc(pk, m_b).</li>
        <li>공격자: c* (그리고 CCA 라면 c* 가 아닌 암호문의 복호 오라클)를 써서 b′ 를 출력.</li>
        <li>b′ = b 이면 공격자 승리.</li>
      </ol>
      <div className="controls">
        <label className="slider">스킴
          <select value={scheme} onChange={(e) => setScheme(e.target.value as SchemeKey)}>{schemes.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        </label>
        <label className="slider">게임
          <select value={mode} onChange={(e) => setMode(e.target.value as 'cpa' | 'cca')}>
            <option value="cpa">IND-CPA (복호 오라클 없음)</option>
            <option value="cca">IND-CCA (복호 오라클 있음)</option>
          </select>
        </label>
        <label className="slider">공격자 전략
          <select value={adv} onChange={(e) => setAdv(e.target.value as AdvKey)}>{advs.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
        </label>
        <label className="slider">반복 횟수 <b>{games}</b>
          <select value={games} onChange={(e) => setGames(+e.target.value)}>{[100, 400, 1000].map((g) => <option key={g} value={g}>{g}</option>)}</select>
        </label>
      </div>
      <p className="note" style={{ marginTop: 0 }}>{advInfo.desc}{adv === 'maul' && mode === 'cpa' ? ' (CPA 게임에서는 복호 오라클이 없어 무작위 추측과 같습니다.)' : ''}</p>
      <div className="row">
        <button className="primary" onClick={run} disabled={busy}>{busy ? '게임 중…' : `게임 ${games}번 실행`}</button>
        <button onClick={() => setRows([])} disabled={busy}>기록 지우기</button>
      </div>
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>스킴</th><th>게임</th><th>전략</th><th>승리</th><th>이득 ± 95%</th><th>판정</th></tr></thead>
            <tbody>
              {rows.map(({ scheme: s, adv: a, mode: m, r }, i) => {
                const broken = r.advantage > 2 * r.ci95;
                return (
                  <tr key={i}>
                    <td>{label(s)}</td><td>{m.toUpperCase()}</td><td>{advs.find((x) => x.key === a)!.label}</td>
                    <td>{r.wins}/{r.games}</td><td>{r.advantage.toFixed(3)} ± {r.ci95.toFixed(3)}</td>
                    <td className={broken ? 'bad' : 'good'}>{broken ? '깨짐' : '이득 없음'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">해볼 것: (1) 결정적 암호화 + 재암호화 → 이득 0.5. (2) Regev + 재암호화·가우스 소거 → 이득 ≈ 0. (3) 노이즈 없는 Regev + 가우스 소거 → 이득 0.5. (4) Regev + IND-CCA + 변조 → 이득 0.5. 실험은 ‘이 공격’이 통하지 않음을 보여줄 뿐, ‘모든 공격’이 통하지 않음은 증명만이 보여줍니다.</p>
    </div>
  );
}
