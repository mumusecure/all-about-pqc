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
          { label: '전체 커리큘럼', slug: 'guide/curriculum' },
        ]},
        { label: '0부 · 오리엔테이션', items: [
          { label: '0장. 왜 지금 PQC인가', slug: 'ch00-why-pqc' },
        ]},
        { label: '1부 · 기초', items: [
          { label: '1장. 암호학을 정의로 다루기', slug: 'ch01-definitions' },
          { label: '2장. 수학 I: 정수론과 대수', slug: 'ch02-algebra' },
          { label: '3장. 공개키 암호의 구조와 FO 변환', slug: 'ch03-pke-structure' },
          { label: '4장. 식별 프로토콜, Fiat–Shamir, 영지식', slug: 'ch04-sigma-fiat-shamir' },
          { label: '5장. 양자 위협', slug: 'ch05-quantum' },
        ]},
        { label: '2부 · 격자의 기하와 알고리즘', items: [
          { label: '6장. 수학 II: 선형대수와 확률', slug: 'ch06-linalg-prob' },
          { label: '7장. 격자 기초', slug: 'ch07-lattices' },
          { label: '8장. 격자 문제와 난이도', slug: 'ch08-lattice-problems' },
          { label: '9장. LLL 완전 정복', slug: 'ch09-lll' },
          { label: '10장. BKZ, 열거, 체', slug: 'ch10-bkz-sieving' },
        ]},
        { label: '3부 · 대수적 격자', items: [
          { label: '11장. 대수적 정수론 입문', slug: 'ch11-algebraic-nt' },
          { label: '12장. Ring-LWE 와 Module-LWE', slug: 'ch12-ring-module-lwe' },
          { label: '13장. 모듈 격자 축소', slug: 'ch13-module-reduction' },
        ]},
        { label: '4부 · 격자 암호 설계', items: [
          { label: '14장. LWE', slug: 'ch14-lwe' },
          { label: '15장. NTRU', slug: 'ch15-ntru' },
          { label: '16장. ML-KEM 해부', slug: 'ch16-mlkem' },
          { label: '17장. 격자 서명', slug: 'ch17-lattice-signatures' },
        ]},
        { label: '5부 · 격자 암호해석', items: [
          { label: '18장. LWE 파라미터의 구체적 안전성', slug: 'ch18-parameter-estimation' },
          { label: '19장. NTRU 공격', slug: 'ch19-ntru-attacks' },
          { label: '20장. 복호 실패 공격과 구현 공격', slug: 'ch20-failure-implementation-attacks' },
        ] },
        { label: '6부 · 주변 주제', items: [
          { label: '21장. 격자 기반 영지식 증명', slug: 'ch21-lattice-zk' },
        ] },
        { label: '논문 읽기', items: [
          { label: '1. MiNTRU 격자 분석 (overstretched)', slug: 'papers/p01-mintru' },
        ]},
        { label: '실습', items: [
          { label: 'Lab 1. LLL로 토이 LWE 공격하기', slug: 'labs/lab01-lll-lwe-attack' },
          { label: 'Lab 3. ML-KEM 을 바닥부터 구현하기', slug: 'labs/lab03-mlkem' },
          { label: 'Lab 4. BKZ 와 체를 직접 돌려 보기', slug: 'labs/lab04-bkz-sieve' },
          { label: 'Lab 5. 나만의 LWE 추정기 만들기', slug: 'labs/lab05-estimator' },
          { label: 'Lab 6. NTRU 키 복구에 필요한 블록 크기', slug: 'labs/lab06-ntru-ladder' },
          { label: 'Lab 7. 평문 확인 오라클로 ML-KEM 키 읽기', slug: 'labs/lab07-pc-oracle' },
        ]},
      ],
    }),
    react(),
  ],
});
