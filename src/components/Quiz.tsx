import { useState } from 'react';

interface Props {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

/** 객관식 확인 문제. 선택 즉시 정오와 해설을 보여준다. */
export default function Quiz({ question, options, answer, explanation }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="widget not-content" role="group" aria-label="확인 문제">
      <h4>✔ 확인 문제</h4>
      <p className="quiz-q">{question}</p>
      <div className="quiz-opts">
        {options.map((opt, i) => {
          const cls = picked === null ? '' : i === answer ? 'correct' : i === picked ? 'wrong' : '';
          return (
            <button key={i} className={cls} onClick={() => setPicked(i)} aria-pressed={picked === i}>
              {String.fromCharCode(65 + i)}. {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="quiz-explain" aria-live="polite">
          <b className={picked === answer ? 'good' : 'bad'}>{picked === answer ? '정답!' : `오답 — 정답은 ${String.fromCharCode(65 + answer)}`}</b>
          <div style={{ marginTop: '0.3rem' }}>{explanation}</div>
          <button style={{ marginTop: '0.5rem' }} onClick={() => setPicked(null)}>다시 풀기</button>
        </div>
      )}
    </div>
  );
}
