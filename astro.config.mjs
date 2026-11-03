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
        { label: '2부 · 격자의 기하와 알고리즘', items: [
          { label: '9장. LLL 완전 정복', slug: 'ch09-lll' },
        ]},
        { label: '4부 · 격자 암호 설계', items: [
          { label: '14장. LWE', slug: 'ch14-lwe' },
        ]},
        { label: '실습', items: [
          { label: 'Lab 1. LLL로 토이 LWE 공격하기', slug: 'labs/lab01-lll-lwe-attack' },
        ]},
      ],
    }),
    react(),
  ],
});
