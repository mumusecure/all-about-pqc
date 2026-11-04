import { describe, expect, it } from 'vitest';
import { CSIDH_P, cglWalk, countPoints, csidhAction, csidhOrbit, jInvariant, phi2Roots, supersingular2Graph, supersingularCount } from '../src/lib/isogeny';

describe('초특이 2-동종 그래프', () => {
  for (const p of [83, 103, 131]) {
    it(`p = ${p}: 꼭짓점 수 = ⌊p/12⌋ + ε, 모든 꼭짓점의 차수(중복 포함) = 3`, () => {
      const G = supersingular2Graph(p);
      expect(G.nodes.length).toBe(supersingularCount(p));
      G.adj.forEach((a) => expect(a.length).toBe(3));
    });
  }
  it('Φ₂(j, Y) 와 Φ₂(Y, j) 의 대칭: j′ 이 j 의 이웃이면 j 도 j′ 의 이웃', () => {
    const G = supersingular2Graph(103);
    G.adj.forEach((a, k) => a.forEach((m) => expect(G.adj[m]).toContain(k)));
  });
  it('1728 의 이웃에는 자기 자신(고리)이 있다 (p ≡ 3 mod 4)', () => {
    const r = phi2Roots([1728 % 103, 0], 103).map((x) => `${x[0]},${x[1]}`);
    expect(r).toContain(`${1728 % 103},0`);
  });
  it('CGL 걷기는 되돌아가지 않는다', () => {
    const G = supersingular2Graph(131);
    const path = cglWalk(G, [0, 1, 1, 0, 1, 0, 0, 1]);
    for (let i = 2; i < path.length; i++) if (G.adj[path[i - 1]].filter((x) => x === path[i - 2]).length < 2) expect(path[i]).not.toBe(path[i - 2]);
  });
});

describe('CSIDH (p = 419)', () => {
  it('A = 0 은 초특이: #E = p + 1', () => {
    expect(countPoints(0)).toBe(CSIDH_P + 1);
  });
  it('작용 결과도 초특이이고, 역작용으로 돌아온다', () => {
    const B = csidhAction(0, [2, -1, 1], 3);
    expect(countPoints(B)).toBe(CSIDH_P + 1);
    expect(csidhAction(B, [-2, 1, -1], 4)).toBe(0);
  });
  it('가환성: Alice·Bob 의 공유 곡선이 같다 (키 교환)', () => {
    const a = [1, -2, 1], b = [-1, 1, 2];
    const A = csidhAction(0, a, 11), Bp = csidhAction(0, b, 12);
    expect(csidhAction(A, b, 13)).toBe(csidhAction(Bp, a, 14));
  });
  it('결과는 고른 점에 무관 (결정적)', () => {
    expect(csidhAction(0, [1, 0, 0], 1)).toBe(csidhAction(0, [1, 0, 0], 99));
  });
  it('궤도의 모든 곡선이 초특이, j-불변량 계산이 정의됨', () => {
    const O = csidhOrbit();
    O.nodes.forEach((A) => { expect(countPoints(A)).toBe(CSIDH_P + 1); expect(Number.isFinite(jInvariant(A))).toBe(true); });
    expect(O.nodes.length).toBeGreaterThan(3);
  });
});
