import { describe, it, expect } from 'vitest';
import { simulateGame, summarize } from './simulate.ts';
import { getLattice } from '../engine/lattice.ts';

describe('simulateGame', () => {
  it('plays a full game to completion with consistent bookkeeping', () => {
    const r = simulateGame(3, ['medium', 'medium'], 1);
    expect(r.movesPlayed).toBe(getLattice(3).edgeCount);
    const [a, b] = r.scores;
    expect(a + b).toBeLessThanOrEqual(getLattice(3).cubeCount);
    if (r.winner === null) expect(a).toBe(b);
    else expect(r.winner === 0 ? a : b).toBeGreaterThan(r.winner === 0 ? b : a);
  });

  it('is deterministic for a given seed and differs across seeds', () => {
    const a = simulateGame(3, ['medium', 'medium'], 42);
    const b = simulateGame(3, ['medium', 'medium'], 42);
    expect(a).toEqual(b);
    const results = new Set(
      Array.from({ length: 8 }, (_, i) => JSON.stringify(simulateGame(3, ['easy', 'easy'], i))),
    );
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('summarize', () => {
  it('computes win split, draw count, margin, and a two-sided p-value', () => {
    const games = [
      { winner: 0 as const, scores: [5, 3] as [number, number], movesPlayed: 54 },
      { winner: 1 as const, scores: [2, 6] as [number, number], movesPlayed: 54 },
      { winner: 0 as const, scores: [4, 3] as [number, number], movesPlayed: 54 },
      { winner: null, scores: [4, 4] as [number, number], movesPlayed: 54 },
    ];
    const s = summarize(games);
    expect(s.games).toBe(4);
    expect(s.wins).toEqual([2, 1]);
    expect(s.draws).toBe(1);
    expect(s.firstWinRate).toBeCloseTo(2 / 3);
    expect(s.meanMargin).toBeCloseTo((2 + -4 + 1 + 0) / 4);
    expect(s.pValue).toBeGreaterThan(0);
    expect(s.pValue).toBeLessThanOrEqual(1);
  });

  it('a balanced split yields a high p-value; a lopsided one a low p-value', () => {
    const mk = (w0: number, w1: number) =>
      summarize([
        ...Array.from({ length: w0 }, () => ({ winner: 0 as const, scores: [5, 4] as [number, number], movesPlayed: 1 })),
        ...Array.from({ length: w1 }, () => ({ winner: 1 as const, scores: [4, 5] as [number, number], movesPlayed: 1 })),
      ]);
    expect(mk(250, 250).pValue).toBeGreaterThan(0.9);
    expect(mk(400, 100).pValue).toBeLessThan(0.001);
  });
});
