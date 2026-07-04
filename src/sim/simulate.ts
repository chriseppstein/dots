/**
 * Headless simulation harness for fairness analysis: the real reducer and
 * the real AI, no rendering. Both seats run the same policy, so any
 * deviation from a 50/50 win split (draws excluded) measures turn-order
 * advantage, not skill difference.
 */

import { applyMove, newGame, scores, type Seat } from '../engine/game.ts';
import type { GridSize } from '../engine/lattice.ts';
import { chooseMove, seededRng, type Difficulty } from '../ai/ai.ts';

export interface SimResult {
  winner: Seat | null;
  scores: [number, number];
  movesPlayed: number;
}

export function simulateGame(
  gridSize: GridSize,
  difficulties: [Difficulty, Difficulty],
  seed: number,
): SimResult {
  const rng = seededRng(seed);
  let g = newGame({ gridSize });
  while (g.status === 'playing') {
    const edgeId = chooseMove(g, difficulties[g.currentSeat], rng);
    const r = applyMove(g, { edgeId, seat: g.currentSeat });
    if (!r.ok) throw new Error(`simulation produced an illegal move: ${r.error}`);
    g = r.state;
  }
  return { winner: g.winner, scores: scores(g), movesPlayed: g.movesPlayed };
}

export interface Summary {
  games: number;
  /** Decisive wins by seat [first, second]. */
  wins: [number, number];
  draws: number;
  /** First-player share of decisive games. */
  firstWinRate: number;
  /** Mean cube margin (seat0 − seat1) over all games, draws included. */
  meanMargin: number;
  meanScores: [number, number];
  /** Two-sided binomial test (normal approximation) of firstWinRate = 0.5. */
  zScore: number;
  pValue: number;
}

export function summarize(games: SimResult[]): Summary {
  const wins: [number, number] = [0, 0];
  let draws = 0;
  let marginSum = 0;
  let s0 = 0;
  let s1 = 0;
  for (const g of games) {
    if (g.winner === null) draws++;
    else wins[g.winner]++;
    marginSum += g.scores[0] - g.scores[1];
    s0 += g.scores[0];
    s1 += g.scores[1];
  }
  const decisive = wins[0] + wins[1];
  const firstWinRate = decisive > 0 ? wins[0] / decisive : 0.5;
  const z = decisive > 0 ? (wins[0] - decisive / 2) / Math.sqrt(decisive / 4) : 0;
  return {
    games: games.length,
    wins,
    draws,
    firstWinRate,
    meanMargin: marginSum / games.length,
    meanScores: [s0 / games.length, s1 / games.length],
    zScore: z,
    pValue: twoSidedP(z),
  };
}

/** 2·(1−Φ(|z|)) via the Abramowitz–Stegun erf approximation. */
function twoSidedP(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return Math.min(1, Math.max(0, 1 - erf));
}
