# All About PQC

배경지식 없이 시작해서 대학원 연구실 수준까지 — **격자 기반 양자내성암호(PQC) 인터랙티브 교과서**.

🌐 사이트: https://mumusecure.github.io/all-about-pqc/

## 특징

- 모든 장은 **직관 → 정식화 → 연구 관점** 세 층으로 구성
- 격자 기저 드래그, LLL 단계 실행, 브라우저 안에서 LWE 공격 등 **인터랙티브 위젯**
- 위젯의 수학 코드는 **단위 테스트로 검증** (`src/lib/`, `tests/`)
- Python 표준 라이브러리만 쓰는 **재현 실습** (`labs/`)

## 공개된 장

| 장 | 내용 |
|---|---|
| 0장 | 왜 지금 PQC인가 — HNDL, Mosca 부등식, 다섯 가문, 연구 지도 |
| 1장 | 암호학을 정의로 — 안전성 게임, 환원 증명, 타이트함, 생일 공격, ROM·QROM |
| 2장 | 수학 도구상자 I — 모듈러 연산, 군·환·체, 이데알, CRT, ℤ_q[x]/(xⁿ+1) |
| 3장 | 공개키 암호의 구조 — KEM/DEM, FO 변환과 암묵적 거부, ML-KEM 의 FO, 하이브리드 키 교환 |
| 4장 | 식별 프로토콜, Fiat–Shamir, 영지식 — Σ-프로토콜, 논스 재사용 공격, forking lemma, 거절 샘플링 |
| 6장 | 수학 도구상자 II — 행렬식과 부피, 꼬리 부등식, 통계적 거리, 이산 가우시안, Gaussian heuristic |
| 7장 | 격자 기초 — 기저, 기본 영역, q-ary 격자, 연속 최소값, Minkowski, 쌍대 격자 |
| 8장 | 격자 문제와 난이도 — SVP·CVP·BDD·uSVP, Babai 알고리즘, 복잡도 지도 |
| 9장 | LLL 완전 정복 — Gauss 축소, LLL 증명, 종료성, GSA |
| 14장 | LWE — 탐색⇔결정, 최악→평균 환원, Regev 암호, 임베딩 공격 |
| 15장 | NTRU — 환과 문제, 정확성, NTRU 격자와 밀집 부분격자, overstretched, NTRU+ |
| Lab 1 | LLL 로 토이 LWE 공격하기 |
| 논문 읽기 1 | Lee–Wallet, *Lattice analysis on MiNTRU problem* — 밀집 부분격자 공격 해설·재계산·재현 (Lab 2) |

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
