// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://mumusecure.github.io',
  base: '/all-about-pqc',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [[rehypeKatex, { strict: false }]],
    }),
  },
  integrations: [
    starlight({
      title: 'All About PQC',
      description: '처음부터 대학원 수준까지, 양자내성암호(PQC) 인터랙티브 교과서',
      defaultLocale: 'root',
      locales: { root: { label: '한국어', lang: 'ko' } },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/mumusecure/all-about-pqc' },
      ],
      customCss: ['katex/dist/katex.min.css', './src/styles/theme.css'],
      sidebar: [
        { label: '시작하기', items: [
          { label: '이 교과서에 대하여', slug: 'guide/about' },
          { label: '전체 커리큘럼과 학습 순서', slug: 'guide/curriculum' },
        ]},
        { label: '1단계 · 기초', items: [
          { label: '0장. 왜 지금 PQC인가', slug: 'ch00-why-pqc' },
          { label: '2장. 수학 I: 정수론과 대수', slug: 'ch02-algebra' },
          { label: '6장. 수학 II: 선형대수와 확률', slug: 'ch06-linalg-prob' },
          { label: '1장. 암호학을 정의로 다루기', slug: 'ch01-definitions' },
        ]},
        { label: '2단계 · 격자 핵심', items: [
          { label: '7장. 격자 기초', slug: 'ch07-lattices' },
          { label: '8장. 격자 문제와 난이도', slug: 'ch08-lattice-problems' },
          { label: '9장. LLL 완전 정복', slug: 'ch09-lll' },
          { label: '14장. LWE', slug: 'ch14-lwe' },
          { label: 'Lab 1. LLL로 토이 LWE 공격하기', slug: 'labs/lab01-lll-lwe-attack' },
        ]},
        { label: '3단계 · 격자 암호 설계', items: [
          { label: '3장. 공개키 암호의 구조와 FO 변환', slug: 'ch03-pke-structure' },
          { label: '11장. 대수적 정수론 입문', slug: 'ch11-algebraic-nt' },
          { label: '12장. Ring-LWE 와 Module-LWE', slug: 'ch12-ring-module-lwe' },
          { label: '15장. NTRU', slug: 'ch15-ntru' },
          { label: '16장. ML-KEM 해부', slug: 'ch16-mlkem' },
          { label: 'Lab 3. ML-KEM 을 바닥부터 구현하기 (선택)', slug: 'labs/lab03-mlkem' },
        ]},
        { label: '4단계 · 암호해석 I: LWE', items: [
          { label: '10장. BKZ, 열거, 체', slug: 'ch10-bkz-sieving' },
          { label: 'Lab 4. BKZ 와 체를 직접 돌려 보기', slug: 'labs/lab04-bkz-sieve' },
          { label: '18장. LWE 파라미터의 구체적 안전성', slug: 'ch18-parameter-estimation' },
          { label: 'Lab 5. 나만의 LWE 추정기 만들기', slug: 'labs/lab05-estimator' },
          { label: '논문 읽기 2. NewHope 와 core-SVP', slug: 'papers/p02-newhope-coresvp' },
        ]},
        { label: '5단계 · 암호해석 II: NTRU', items: [
          { label: '논문 읽기 1. MiNTRU 격자 분석', slug: 'papers/p01-mintru' },
          { label: '19장. NTRU 공격', slug: 'ch19-ntru-attacks' },
          { label: 'Lab 6. NTRU 키 복구에 필요한 블록 크기', slug: 'labs/lab06-ntru-ladder' },
          { label: 'Lab 2. MiNTRU 격자 단계 재현하기', slug: 'labs/lab02-mintru' },
          { label: '논문 읽기 4. Overstretched NTRU 다시 보기', slug: 'papers/p04-kirchner-fouque' },
          { label: '논문 읽기 5. NTRU Fatigue', slug: 'papers/p05-ntru-fatigue' },
        ]},
        { label: '6단계 · 서명과 구현 공격', items: [
          { label: '4장. 식별 프로토콜, Fiat–Shamir, 영지식', slug: 'ch04-sigma-fiat-shamir' },
          { label: '17장. 격자 서명', slug: 'ch17-lattice-signatures' },
          { label: '20장. 복호 실패 공격과 구현 공격', slug: 'ch20-failure-implementation-attacks' },
          { label: 'Lab 7. 평문 확인 오라클로 ML-KEM 키 읽기', slug: 'labs/lab07-pc-oracle' },
          { label: '논문 읽기 3. LWE with Side Information', slug: 'papers/p03-lwe-side-information' },
        ]},
        { label: '더 읽기 (필요할 때)', items: [
          { label: '5장. 양자 위협', slug: 'ch05-quantum' },
          { label: '13장. 모듈 격자 축소', slug: 'ch13-module-reduction' },
          { label: '21장. 격자 기반 영지식 증명', slug: 'ch21-lattice-zk' },
          { label: '22장. 동형암호와 문턱 동형암호', slug: 'ch22-fhe-threshold' },
          { label: '23장. 동종사상과 SQIsign', slug: 'ch23-isogenies-sqisign' },
          { label: '24장. 다른 가문 개관과 표준화 현황', slug: 'ch24-other-families' },
        ]},
        { label: '진로', items: [
          { label: '25장. 학부연구생·대학원 로드맵', slug: 'ch25-roadmap' },
        ]},
      ],
    }),
    react(),
  ],
});
