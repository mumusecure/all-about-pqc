# All About PQC

배경지식 없이 시작해서 대학원 연구실 수준까지 — **격자 기반 양자내성암호(PQC) 인터랙티브 교과서**.

🌐 사이트: https://mumusecure.github.io/all-about-pqc/

## 특징

- 모든 장은 **직관 → 정식화 → 연구 관점** 세 층으로 구성
- 격자 기저 드래그, LLL 단계 실행, 브라우저 안에서 LWE 공격 등 **인터랙티브 위젯**
- 위젯의 수학 코드는 **단위 테스트로 검증** (`src/lib/`, `tests/`)
- Python 표준 라이브러리만 쓰는 **재현 실습** (`labs/`)

## 공개된 장 (M1)

| 장 | 내용 |
|---|---|
| 0장 | 왜 지금 PQC인가 — HNDL, Mosca 부등식, 다섯 가문, 연구 지도 |
| 9장 | LLL 완전 정복 — Gauss 축소, LLL 증명, 종료성, GSA |
| 14장 | LWE — 탐색⇔결정, 최악→평균 환원, Regev 암호, 임베딩 공격 |
| Lab 1 | LLL 로 토이 LWE 공격하기 |

전체 26장 계획은 사이트의 [전체 커리큘럼](https://mumusecure.github.io/all-about-pqc/guide/curriculum/) 참고.

## 로컬 실행

```bash
npm install
npm run dev      # http://localhost:4321/all-about-pqc/
npm test         # 수학 코드 단위 테스트
npm run build    # 정적 사이트 빌드 (dist/)
python3 labs/lab01_lll_lwe_attack.py --sweep
```

## 구조

```
src/content/docs/   교과서 본문 (MDX + KaTeX)
src/components/     인터랙티브 위젯 (React)
src/lib/            격자·LWE 토이 구현 (TypeScript)
tests/              단위 테스트 (Vitest)
labs/               Python 실습
docs/PLAN.md        제작 계획
```

⚠️ 토이 구현은 교육용입니다. 상수 시간이 아니고 안전한 난수를 쓰지 않으며 파라미터가 작습니다. 실제 보안에 사용하지 마세요.
