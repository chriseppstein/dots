import { describe, it, expect } from 'vitest';
import { getLattice } from '../engine/lattice.ts';
import { newGame, applyMove, validMoves, scores, type GameState, type Seat } from '../engine/game.ts';
import { chooseMove, seededRng, type Difficulty } from './ai.ts';

// AI invariants ported from the prototype's AIPlayer spec, extended with
// difficulty tiers. All difficulties must return legal moves; medium and
// hard must take free points and avoid giveaways; hard must play chains
// through and minimize what it hands the opponent when forced.

function play(state: GameState, edges: number[]): GameState {
  for (const edgeId of edges) {
    const r = applyMove(state, { edgeId, seat: state.currentSeat });
    if (!r.ok) throw new Error(`setup move ${edgeId} rejected: ${r.error}`);
    state = r.state;
  }
  return state;
}

describe.each(['easy', 'medium', 'hard'] as const)('%s difficulty', (difficulty) => {
  it('always returns a legal, undrawn edge', () => {
    const rng = seededRng(7);
    let g = newGame({ gridSize: 3 });
    for (let i = 0; i < 20; i++) {
      const move = chooseMove(g, difficulty, rng);
      expect(g.edges[move]).toBe(0);
      g = play(g, [move]);
    }
  });

  it('plays the last remaining edge at the end of a game', () => {
    let g = newGame({ gridSize: 3 });
    while (validMoves(g).length > 1) g = play(g, [validMoves(g)[0]!]);
    const move = chooseMove(g, difficulty, seededRng(1));
    expect(move).toBe(validMoves(g)[0]);
  });
});

describe('medium and hard take free points and avoid giveaways', () => {
  const lat = getLattice(3);

  it.each(['medium', 'hard'] as const)('%s completes an available face', (difficulty) => {
    const edges = lat.faceEdges(0);
    const g = play(newGame({ gridSize: 3 }), edges.slice(0, 3));
    // whoever is on turn can complete face 0
    const move = chooseMove(g, difficulty, seededRng(3));
    expect(move).toBe(edges[3]);
  });

  it.each(['medium', 'hard'] as const)(
    '%s never plays a third edge while safe moves exist',
    (difficulty) => {
      // Draw two edges of one face; plenty of safe moves remain.
      const [e1, e2, e3] = lat.faceEdges(0);
      const g = play(newGame({ gridSize: 3 }), [e1!, e2!]);
      for (let seed = 0; seed < 5; seed++) {
        const move = chooseMove(g, difficulty, seededRng(seed));
        expect(move).not.toBe(e3);
      }
    },
  );
});

describe('hard difficulty chain play', () => {
  it('beats easy in a deterministic head-to-head on a 3³ board', () => {
    const difficulties: Record<Seat, Difficulty> = { 0: 'hard', 1: 'easy' };
    const rng = seededRng(42);
    let g = newGame({ gridSize: 3 });
    while (g.status === 'playing') {
      const move = chooseMove(g, difficulties[g.currentSeat], rng);
      g = play(g, [move]);
    }
    const [hard, easy] = scores(g);
    expect(hard).toBeGreaterThan(easy);
  });
});

describe('seededRng', () => {
  it('is deterministic per seed', () => {
    const a = seededRng(9);
    const b = seededRng(9);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
