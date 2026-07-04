/**
 * Computer opponent in three tiers, all built on the shared analyzer —
 * the evaluation weights are ported from the prototype's AIPlayer, which
 * encoded sound dots-and-boxes intuition on top of a broken model.
 *
 *  - easy:   takes open faces but plays randomly otherwise (gives plenty
 *            away), and overlooks available completions ~10% of the time
 *  - medium: greedy — take points, avoid giving the third edge of a face;
 *            overlooks completions ~3% of the time
 *  - hard:   medium plus chain sense — values longer chains and, when
 *            forced to give something away, hands over the shortest
 *            chain; overlooks completions ~1% of the time
 *
 * The oversight rates are a deliberate game-feel feature: an attentive
 * human can catch and punish a missed face.
 */

import { analyzeMove, findCompletingMove, findCompletingMoves } from '../engine/analyzer.ts';
import { applyMove, validMoves, type GameState } from '../engine/game.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Chance per decision — when a face-completing move is available — that
 * the AI overlooks it and plays as if it weren't there. This is the
 * "pay attention and punish it" mechanic: a missed completion is a face
 * the human can claim next turn. The blind move still follows the normal
 * policy, so an oversight never doubles as a deliberate chain giveaway.
 */
const OVERSIGHT_RATE: Record<Difficulty, number> = { easy: 0.1, medium: 0.03, hard: 0.01 };

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
  let moves = validMoves(state);
  if (moves.length === 0) throw new Error('no legal moves: game is over');
  if (moves.length === 1) return moves[0]!;

  // oversight roll: sometimes miss that completions exist at all
  const completions = findCompletingMoves(state);
  const canComplete = completions.length > 0;
  if (canComplete && completions.length < moves.length && rng() < OVERSIGHT_RATE[difficulty]) {
    const completionSet = new Set(completions);
    moves = moves.filter((e) => !completionSet.has(e));
    return choosePolicy(state, moves, difficulty, rng, false);
  }
  return choosePolicy(state, moves, difficulty, rng, canComplete);
}

function choosePolicy(
  state: GameState,
  moves: number[],
  difficulty: Difficulty,
  rng: () => number,
  canComplete: boolean,
): number {
  switch (difficulty) {
    case 'easy':
      return chooseEasy(state, moves, rng, canComplete);
    case 'medium':
      return chooseScored(state, moves, rng, false);
    case 'hard':
      return chooseScored(state, moves, rng, true);
  }
}

function chooseEasy(
  state: GameState,
  moves: number[],
  rng: () => number,
  canComplete: boolean,
): number {
  if (canComplete) {
    const completing = findCompletingMove(state);
    if (completing !== null) return completing;
  }
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
