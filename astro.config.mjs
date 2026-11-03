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
        ]},
        { label: '2부 · 격자의 기하와 알고리즘', items: [
          { label: '6장. 수학 II: 선형대수와 확률', slug: 'ch06-linalg-prob' },
          { label: '7장. 격자 기초', slug: 'ch07-lattices' },
          { label: '8장. 격자 문제와 난이도', slug: 'ch08-lattice-problems' },
          { label: '9장. LLL 완전 정복', slug: 'ch09-lll' },
        ]},
        { label: '4부 · 격자 암호 설계', items: [
          { label: '14장. LWE', slug: 'ch14-lwe' },
          { label: '15장. NTRU', slug: 'ch15-ntru' },
        ]},
        { label: '논문 읽기', items: [
          { label: '1. MiNTRU 격자 분석 (overstretched)', slug: 'papers/p01-mintru' },
        ]},
        { label: '실습', items: [
          { label: 'Lab 1. LLL로 토이 LWE 공격하기', slug: 'labs/lab01-lll-lwe-attack' },
        ]},
      ],
    }),
    react(),
  ],
});
