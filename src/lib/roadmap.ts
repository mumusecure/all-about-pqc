/**
 * 25장: 지원 마감까지 남은 기간과 주당 시간으로 공부 단계를 배치하는 단순한 계획기.
 * 공부 단계는 순서대로 이어지고, 연락·서류·면접은 마감에서 거꾸로 센 시점에 고정된다.
 * 시간 추정은 이 교과서 기준의 대략값(장당 8~12 시간, 실습 6~8 시간)이다.
 */
export type Goal = 'intern' | 'grad';

export interface Phase { key: string; label: string; hours: number; chapters: string; }
export interface Placed extends Phase { startWeek: number; endWeek: number; }
export interface Anchor { key: string; label: string; week: number; }
export interface Plan {
  goal: Goal; weeks: number; hoursPerWeek: number;
  phases: Placed[]; anchors: Anchor[];
  totalHours: number; availableHours: number;
  /** 연락 시점까지 끝나야 하는 단계(핵심 경로 + 첫 실습)가 끝나는가 */
  readyForContact: boolean;
  /** 모든 공부 단계가 마감 전에 끝나는가 */
  fits: boolean;
}

const PHASES: Record<Goal, Phase[]> = {
  intern: [
    { key: 'core', label: '핵심 경로 (★ 장)', hours: 100, chapters: '0·1·2·6·7·8·9·14·15·16장' },
    { key: 'lab1', label: '첫 실습과 1쪽 보고서', hours: 10, chapters: 'Lab 1' },
    { key: 'paper', label: '논문 한 편 정독', hours: 10, chapters: '논문 읽기 1' },
    { key: 'deep', label: '관심 분야 한 장 더', hours: 12, chapters: '10장 또는 18장' },
  ],
  grad: [
    { key: 'core', label: '핵심 경로 (★ 장)', hours: 100, chapters: '0·1·2·6·7·8·9·14·15·16장' },
    { key: 'lab1', label: '첫 실습과 1쪽 보고서', hours: 10, chapters: 'Lab 1' },
    { key: 'crypt', label: '암호해석 심화와 실습', hours: 60, chapters: '10·18·19장, Lab 4·5·6' },
    { key: 'alg', label: '대수적 격자', hours: 36, chapters: '11·12·13장' },
    { key: 'paper', label: '논문 세 편 정독', hours: 30, chapters: '논문 읽기 1 + 2편' },
    { key: 'project', label: '재현 프로젝트', hours: 40, chapters: '25장 5절' },
  ],
};
/** 마감에서 거꾸로 센 주 (연락, 서류, 면접) */
const ANCHORS: Record<Goal, { key: string; label: string; before: number }[]> = {
  intern: [
    { key: 'contact', label: '연구실 연락', before: 6 },
    { key: 'start', label: '학기 시작 (합류 목표)', before: 0 },
  ],
  grad: [
    { key: 'contact', label: '연구실 연락', before: 20 },
    { key: 'docs', label: '연구계획서·자기소개서', before: 6 },
    { key: 'deadline', label: '원서 마감', before: 0 },
    { key: 'interview', label: '면접 (마감 후 수 주)', before: -4 },
  ],
};

export function planRoadmap(goal: Goal, weeks: number, hoursPerWeek: number, pace = 1): Plan {
  let t = 0;
  const phases = PHASES[goal].map((p) => {
    const h = Math.round(p.hours * pace), dur = h / hoursPerWeek;
    const placed = { ...p, hours: h, startWeek: t, endWeek: t + dur };
    t += dur;
    return placed;
  });
  const anchors = ANCHORS[goal].map((a) => ({ key: a.key, label: a.label, week: weeks - a.before }));
  const contact = anchors.find((a) => a.key === 'contact')!.week;
  const ready = phases.find((p) => p.key === 'lab1')!.endWeek;
  const totalHours = phases.reduce((s, p) => s + p.hours, 0);
  return {
    goal, weeks, hoursPerWeek, phases, anchors, totalHours,
    availableHours: weeks * hoursPerWeek,
    readyForContact: ready <= contact,
    fits: t <= weeks,
  };
}
