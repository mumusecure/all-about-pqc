import { useState } from 'react';

/**
 * 대학원 면접·연구실 면담 대비 문제 은행. 먼저 말로 답해 보고 모범 답의 뼈대와 비교한다.
 * 답은 "이 정도를 2~3분 안에 말할 수 있으면 충분하다"는 기준으로 썼다.
 */
type Q = { topic: string; q: string; a: string; ch: [string, string] };
const BANK: Q[] = [
  { topic: '기초', q: 'IND-CPA 와 IND-CCA 의 차이를 게임으로 설명하고, KEM 이 왜 IND-CCA 를 목표로 하는지 말해 보세요.', a: 'CPA 는 공격자가 암호화만, CCA 는 도전 암호문 외의 복호 질의도 할 수 있는 게임. 실제 프로토콜에서는 공격자가 조작한 암호문에 대한 반응(오류, 재전송)을 볼 수 있으므로 CCA 가 현실적. 격자 KEM 은 CPA 암호에 FO 변환을 씌워 CCA 를 얻는다.', ch: ['1장', '../ch01-definitions/'] },
  { topic: '기초', q: '쇼어 알고리즘이 RSA 와 ECC 를 깨는데 격자 문제는 왜 깨지 못한다고 믿나요?', a: 'RSA·ECC 는 가환군의 숨은 부분군 문제로 환원되고 양자 푸리에 변환으로 풀린다. 격자 문제는 이면체군 숨은 부분군 문제와 연결되지만 알려진 양자 알고리즘(Kuperberg 등)은 준지수 시간이고 격자에 대한 다항 시간 양자 알고리즘은 없다. "믿음"이라는 점, 즉 증명이 아니라는 점도 말하면 좋다.', ch: ['5장', '../ch05-quantum/'] },
  { topic: '격자', q: 'LLL 이 다항 시간에 끝나는 이유를 퍼텐셜 함수로 설명해 보세요.', a: '잠재함수 D = ∏ d_i (d_i = 앞 i 개 벡터의 Gram 행렬식)는 정수 기저에서 양의 정수라 1 이상. 크기 축소는 D 를 바꾸지 않고, 교환이 일어날 때마다 D 가 δ 배 미만으로 줄므로 교환 횟수는 log D₀ / log(1/δ) ≤ n(n−1) log B / log(1/δ). 중간 수의 비트 길이도 유계임을 덧붙이면 완벽.', ch: ['9장', '../ch09-lll/'] },
  { topic: '격자', q: 'Gaussian heuristic 이 무엇이고 어디에 쓰나요?', a: '무작위 격자의 최단 벡터 길이를 gh(L) ≈ √(n/2πe)·vol^{1/n} 로 어림하는 것. 공격 성공 조건(uSVP 의 β 계산), BKZ 의 GSA·시뮬레이터, 체의 목록 크기 추정 등 거의 모든 비용 추정의 바탕. 증명이 아니라 휴리스틱이고 작은 차원이나 구조 있는 격자에서는 어긋날 수 있다.', ch: ['8장', '../ch08-lattice-problems/'] },
  { topic: '격자', q: 'BKZ 에서 블록 크기를 키우면 무엇이 좋아지고 무엇이 나빠지나요?', a: '근 Hermite 인자 δ_β 가 1 에 가까워져 더 짧은 벡터를 얻지만, 블록마다 SVP 오라클 비용이 β 에 지수적(체는 약 2^{0.292β}). 그래서 안전성 추정은 "공격에 필요한 β" 를 구하고 그 β 의 SVP 비용으로 비트 안전성을 매긴다(core-SVP).', ch: ['10장', '../ch10-bkz-sieving/'] },
  { topic: '설계', q: 'LWE 에서 오류를 없애면 무엇이 되고, 오류가 너무 크면 무엇이 문제인가요?', a: '오류가 없으면 가우스 소거로 풀리는 연립일차방정식. 오류가 크면 안전하지만 복호할 때 잡음이 q/4 를 넘어 복호 실패가 늘어난다. 파라미터 설계는 안전성(오류↑, q↓)과 정확성(오류↓, q↑) 사이의 줄타기.', ch: ['14장', '../ch14-lwe/'] },
  { topic: '설계', q: 'ML-KEM 이 Ring-LWE 가 아니라 Module-LWE 를 쓰는 이유는?', a: '같은 환 ℤ_q[x]/(x²⁵⁶+1) 과 같은 NTT 코드를 쓰면서 모듈 차수 k = 2, 3, 4 만 바꿔 안전성 수준을 조절할 수 있다. 구조가 Ring 보다 적어 대수적 공격에 대한 여유도 있다. 효율은 Ring 과 비슷.', ch: ['12장', '../ch12-ring-module-lwe/'] },
  { topic: '설계', q: 'ML-DSA 에서 거부 샘플링이 없으면 무슨 일이 생기나요?', a: '응답 z = y + cs 의 분포가 비밀 s 에 따라 이동해, 서명을 많이 모으면 s 가 통계적으로 드러난다. 경계를 넘는 z 를 버리면 분포가 s 와 무관한 상자 위 균등 분포가 된다. 대가는 평균 4~5 번의 반복.', ch: ['17장', '../ch17-lattice-signatures/'] },
  { topic: '해석', q: 'primal uSVP 공격의 성공 조건을 말하고, 그것으로 ML-KEM 의 안전성을 어떻게 매기는지 설명해 보세요.', a: 'Kannan 임베딩으로 비밀을 짧은 벡터로 만든 격자에서, 그 벡터의 투영 길이 √β·σ 가 BKZ-β 후 δ^{2β−d}·vol^{1/d} 보다 작으면 마지막 블록에서 찾힌다(ADPS16). 이 조건을 만족하는 최소 β 를 찾고 체 비용 0.292β 로 core-SVP 비트를 매긴다. ML-KEM-512 는 β ≈ 400, 약 118 비트.', ch: ['18장', '../ch18-parameter-estimation/'] },
  { topic: '해석', q: 'NTRU 에서 모듈러스 q 가 지나치게 크면 왜 위험한가요?', a: 'NTRU 격자 안의 (f, g) 회전들이 만드는 밀집 부분격자의 부피가 격자 전체에 비해 너무 작아져, BKZ 가 그 부분격자의 벡터를 예상보다 작은 β 에서 찾는다(Kirchner–Fouque, Ducas–van Woerden 의 피로점). 동형암호용 overstretched NTRU 가 깨진 이유.', ch: ['19장', '../ch19-ntru-attacks/'] },
  { topic: '해석', q: 'dual 공격과 primal 공격은 무엇이 다른가요? 최근 dual 공격에 대한 논쟁도 알고 있나요?', a: 'primal 은 비밀을 짧은 벡터로 찾고, dual 은 쌍대 격자의 짧은 벡터로 LWE 표본과 균등 분포를 구별한다. 체로 많은 짧은 쌍대 벡터를 얻고 FFT 로 일부 비밀을 추측하는 개선(MATZOV 2022)이 추정을 낮췄지만, 그 분석이 가정한 독립성 휴리스틱이 실제와 맞지 않는다는 반론(Ducas–Pulles, Crypto 2023)이 나왔다.', ch: ['18장', '../ch18-parameter-estimation/'] },
  { topic: '해석', q: '복호 실패 확률이 2^{−139} 이면 실제로는 안전하다고 할 수 있나요?', a: '무작위 암호문에 대해서는 그렇다. 하지만 공격자가 실패 확률이 높은 암호문을 골라 보내는 failure boosting, 또는 구현이 실패 여부를 흘리는 경우(타이밍, 오류 메시지)에는 실패 하나하나가 비밀의 정보가 된다. 그래서 FO 변환의 재암호화 검사를 상수 시간으로 구현하는 것이 중요.', ch: ['20장', '../ch20-failure-implementation-attacks/'] },
  { topic: '대수', q: '원분체에서 canonical embedding 을 쓰는 이유는?', a: '곱셈이 좌표별 곱이 되어 ‖ab‖ 를 ‖a‖·‖b‖ 의 최대 좌표로 깔끔하게 상계할 수 있고, 이데알 격자의 기하(최소값, 부피)를 수체의 대수(노름, 판별식)와 연결할 수 있다. 계수 임베딩은 2의 거듭제곱 원분체에서만 회전 행렬이 직교라 비슷하게 좋다.', ch: ['11장', '../ch11-algebraic-nt/'] },
  { topic: '대수', q: '이데알 격자에서 근사 SVP 가 일반 격자보다 쉬워지는 결과를 하나 말해 보세요.', a: '주이데알의 짧은 생성원 복구(Cramer–Ducas–Peikert–Regev 2016): 양자로 생성원을 찾고 원분 단원의 좋은 기저로 짧게 만든다. Cramer–Ducas–Wesolowski(2017)는 이를 일반 이데알로 넓혀 원분체에서 양자 다항 시간에 근사 인자 2^{Õ(√n)} 를 얻었고, Pellet-Mary–Hanrot–Stehlé(2019)는 전처리를 써서 임의의 수체로 일반화했다. 다만 Module-LWE 같은 표준 가정에는 직접 적용되지 않는다는 점을 함께 말한다.', ch: ['13장', '../ch13-module-reduction/'] },
  { topic: '연구', q: '최근에 읽은 논문 하나를 3분 안에 설명해 보세요.', a: '뼈대: (1) 어떤 문제를 풀었나 (2) 이전 결과는 무엇이었나 (3) 핵심 아이디어 한 가지 (4) 결과 수치 (5) 한계나 열린 질문. 그리고 "제가 직접 재계산해 본 부분은 …" 한 문장이 있으면 크게 다르다.', ch: ['논문 읽기 1', '../papers/p01-mintru/'] },
  { topic: '연구', q: '석사 2년 동안 해 보고 싶은 연구를 말해 보세요.', a: '정답보다 구조를 본다. 관심 문제 → 그 문제의 현재 최선 결과 → 내가 시도해 볼 구체적 첫 단계(재현, 작은 차원 실험) → 실패하면 무엇을 배우는가. "연구실의 최근 논문 ○○ 의 실험을 더 큰 차원에서 확인해 보고 싶다"처럼 연구실 주제와 연결하되, 지도교수와 바꿀 여지를 열어 둔다.', ch: ['25장 6절', '#6-연구계획서와-자기소개서'] },
  { topic: '연구', q: '실험 결과가 이론 예측과 다르게 나오면 어떻게 하나요?', a: '먼저 구현 버그(작은 예로 손 계산과 비교, 다른 구현과 교차 검증), 다음으로 파라미터·난수 시드·표본 수, 마지막으로 이론의 가정(휴리스틱이 그 차원에서 성립하는가)을 의심한다. 차이가 재현되면 그 자체가 연구 결과일 수 있다(예: 작은 차원에서 GSA 가 어긋나는 현상).', ch: ['10장', '../ch10-bkz-sieving/'] },
  { topic: '태도', q: '왜 이 분야, 왜 이 연구실인가요?', a: '구체적 경험 하나(이 문제를 풀다가 궁금해진 것) + 연구실의 구체적 논문 하나(어떤 점이 흥미로웠고 무엇을 더 알고 싶은지). 일반론("양자 컴퓨터가 위협이라서")만으로는 약하다.', ch: ['0장', '../ch00-why-pqc/'] },
  { topic: '태도', q: '이 질문에 대한 답을 모르겠으면 어떻게 하나요?', a: '모른다고 말하고, 아는 데까지 추론을 소리 내어 해 본다("정의로 돌아가면 …", "작은 예로 n = 2 라면 …"). 면접관은 정답보다 생각하는 방식을 본다. 아는 척은 가장 나쁜 답.', ch: ['25장 7절', '#7-면접과-면담'] },
];
const TOPICS = ['전체', '기초', '격자', '설계', '해석', '대수', '연구', '태도'];

export default function InterviewDrill() {
  const [topic, setTopic] = useState('전체');
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);
  const pool = BANK.filter((b) => topic === '전체' || b.topic === topic);
  const cur = pool[idx % pool.length];
  const next = () => { setShow(false); setIdx((i) => (i + 1 + Math.floor(Math.random() * Math.max(1, pool.length - 1))) % pool.length); };
  return (
    <div className="widget not-content">
      <h4>면접 연습: 소리 내어 답해 보기</h4>
      <p className="widget-sub">질문을 읽고 2~3분 동안 말로 답한 뒤 "답의 뼈대"를 펼쳐 비교하세요. 녹음해서 들어 보면 더 좋습니다. 질문 {BANK.length} 개.</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {TOPICS.map((t) => <button key={t} className={topic === t ? 'primary' : ''} onClick={() => { setTopic(t); setIdx(0); setShow(false); }}>{t}</button>)}
      </div>
      <div style={{ background: 'var(--w-surface)', borderRadius: '0.5rem', padding: '0.75rem 0.9rem', margin: '0.6rem 0' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--w-muted)' }}>[{cur.topic}] {idx % pool.length + 1} / {pool.length}</div>
        <div style={{ fontWeight: 700, marginTop: '0.25rem' }}>{cur.q}</div>
        {show && <div style={{ marginTop: '0.6rem', fontSize: '0.9rem' }}><b className="good">답의 뼈대</b>: {cur.a} <a href={cur.ch[1]}>→ {cur.ch[0]}</a></div>}
      </div>
      <div className="row">
        <button className="primary" onClick={() => setShow((s) => !s)}>{show ? '답 숨기기' : '답의 뼈대 보기'}</button>
        <button onClick={next}>다른 질문</button>
      </div>
    </div>
  );
}
