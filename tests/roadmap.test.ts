import { describe, expect, it } from 'vitest';
import { planRoadmap } from '../src/lib/roadmap';

describe('로드맵 계획기', () => {
  it('단계가 겹치지 않고 순서대로 이어진다', () => {
    const P = planRoadmap('grad', 52, 10);
    for (let i = 1; i < P.phases.length; i++) expect(P.phases[i].startWeek).toBeCloseTo(P.phases[i - 1].endWeek);
    expect(P.totalHours).toBe(276);
  });
  it('1년·주 10 시간이면 대학원 준비가 들어가고, 3개월·주 5 시간이면 안 된다', () => {
    const ok = planRoadmap('grad', 52, 10);
    expect(ok.fits).toBe(true); expect(ok.readyForContact).toBe(true);
    const no = planRoadmap('grad', 13, 5);
    expect(no.fits).toBe(false); expect(no.readyForContact).toBe(false);
  });
  it('학부연구생 목표는 더 짧다', () => {
    const P = planRoadmap('intern', 16, 10);
    expect(P.totalHours).toBe(132);
    expect(P.fits).toBe(true);
    expect(P.anchors.find((a) => a.key === 'contact')!.week).toBe(10);
  });
  it('속도 배율은 시간에 곱해진다', () => {
    expect(planRoadmap('intern', 16, 10, 0.5).totalHours).toBe(66);
  });
});
