/**
 * Computer opponent in three tiers, all built on the shared analyzer —
 * the evaluation weights are ported from the prototype's AIPlayer, which
 * encoded sound dots-and-boxes intuition on top of a broken model.
 *
 *  - easy:   mostly random; takes an open face only half the time
 *  - medium: greedy — take points, avoid giving the third edge of a face
 *  - hard:   medium plus chain sense — values longer chains and, when
 *            forced to give something away, hands over the shortest chain
 */

import { analyzeMove, findCompletingMove } from '../engine/analyzer.ts';
import { applyMove, validMoves, type GameState } from '../engine/game.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Deterministic rng (mulberry32) so AI behavior is reproducible in tests. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function chooseMove(
  state: GameState,
  difficulty: Difficulty,
  rng: () => number = Math.random,
): number {
  const moves = validMoves(state);
  if (moves.length === 0) throw new Error('no legal moves: game is over');
  if (moves.length === 1) return moves[0]!;

  switch (difficulty) {
    case 'easy':
      return chooseEasy(state, moves, rng);
    case 'medium':
      return chooseScored(state, moves, rng, false);
    case 'hard':
      return chooseScored(state, moves, rng, true);
  }
}

function chooseEasy(state: GameState, moves: number[], rng: () => number): number {
  const completing = findCompletingMove(state);
  if (completing !== null && rng() < 0.5) return completing;
  return moves[Math.floor(rng() * moves.length)]!;
}

// Weights carried over from the prototype's evaluator.
const FACE_VALUE = 100;
const CUBE_VALUE = 200;
const EXPOSE_PENALTY = 75;
const CHAIN_BONUS = 60; // hard only: each extra completing move in the chain

function chooseScored(
  state: GameState,
  moves: number[],
  rng: () => number,
  chainAware: boolean,
): number {
  let best: number[] = [];
  let bestScore = -Infinity;
  for (const edgeId of moves) {
    const a = analyzeMove(state, edgeId);
    let score =
      a.completesFaces * FACE_VALUE + a.claimsCubes * CUBE_VALUE - a.exposesFaces * EXPOSE_PENALTY;
    if (chainAware && a.chainLength > 1) score += (a.chainLength - 1) * CHAIN_BONUS;
    if (score > bestScore) {
      bestScore = score;
      best = [edgeId];
    } else if (score === bestScore) {
      best.push(edgeId);
    }
  }

  // Forced giveaway: every option exposes a face and none scores. Hard
  // hands the opponent the shortest available chain instead of a random one.
  if (chainAware && bestScore < 0) {
    let minChain = Infinity;
    let candidates: number[] = [];
    for (const edgeId of moves) {
      const gift = opponentChainAfter(state, edgeId);
      if (gift < minChain) {
        minChain = gift;
        candidates = [edgeId];
      } else if (gift === minChain) {
        candidates.push(edgeId);
      }
    }
    best = candidates;
  }

  return best[Math.floor(rng() * best.length)]!;
}

/** How many faces the opponent could greedily chain after this move. */
function opponentChainAfter(state: GameState, edgeId: number): number {
  const r = applyMove(state, { edgeId, seat: state.currentSeat });
  if (!r.ok) return Infinity;
  let s = r.state;
  if (s.status !== 'playing' || s.currentSeat === state.currentSeat) return 0;
  const opponent = s.currentSeat;
  let chain = 0;
  while (s.status === 'playing' && s.currentSeat === opponent) {
    const next = findCompletingMove(s);
    if (next === null) break;
    const rr = applyMove(s, { edgeId: next, seat: opponent });
    if (!rr.ok) break;
    chain += rr.completedFaces.length;
    s = rr.state;
  }
  return chain;
}
