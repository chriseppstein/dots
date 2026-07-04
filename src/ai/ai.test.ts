import { describe, it, expect } from 'vitest';
import { getLattice } from '../engine/lattice.ts';
import { newGame, applyMove, validMoves, scores, type GameState, type Seat } from '../engine/game.ts';
import { chooseMove, seededRng, type Difficulty } from './ai.ts';
import { analyzeAllMoves } from '../engine/analyzer.ts';

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

  it.each(['medium', 'hard'] as const)(
    '%s takes an available completion in the vast majority of decisions',
    (difficulty) => {
      const edges = lat.faceEdges(0);
      const g = play(newGame({ gridSize: 3 }), edges.slice(0, 3));
      // whoever is on turn can complete face 0; with oversight the AI may
      // rarely miss, so assert over a batch of seeds
      let taken = 0;
      for (let seed = 0; seed < 40; seed++) {
        if (chooseMove(g, difficulty, seededRng(seed)) === edges[3]) taken++;
      }
      expect(taken).toBeGreaterThanOrEqual(35);
    },
  );

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

describe('oversight: the AI sometimes misses an available completion', () => {
  // Per-decision miss rates when a face-completing move exists:
  // easy ≈10%, medium ≈3%, hard ≈1%. Measured over seeded trials of a
  // position with one completing move and plenty of safe alternatives;
  // bounds are ±4 binomial standard deviations, so the test is stable.
  const lat = getLattice(3);
  const edges = lat.faceEdges(0);
  const position = play(newGame({ gridSize: 3 }), edges.slice(0, 3));
  const completing = edges[3]!;

  function missRate(difficulty: Difficulty, trials: number): number {
    let misses = 0;
    for (let seed = 0; seed < trials; seed++) {
      const move = chooseMove(position, difficulty, seededRng(seed));
      if (move !== completing) {
        misses++;
        // an overlooked completion must not be replaced by a different
        // scoring move or a needless giveaway
        const a = analyzeAllMoves(position).get(move)!;
        expect(a.completesFaces).toBe(0);
        expect(difficulty === 'easy' || a.kind === 'safe').toBe(true);
      }
    }
    return misses / trials;
  }

  it('easy misses ≈10% of completions', () => {
    const r = missRate('easy', 1500);
    expect(r).toBeGreaterThan(0.069);
    expect(r).toBeLessThan(0.131);
  });

  it('medium misses ≈3% of completions', () => {
    const r = missRate('medium', 1500);
    expect(r).toBeGreaterThan(0.012);
    expect(r).toBeLessThan(0.048);
  });

  it('hard misses ≈1% of completions', () => {
    const r = missRate('hard', 3000);
    expect(r).toBeGreaterThan(0.0027);
    expect(r).toBeLessThan(0.0173);
  });

  it('a forced single move is never overlooked', () => {
    // when the completing move is the only legal move there is nothing
    // to miss — the AI must play it regardless of the oversight roll
    let g = newGame({ gridSize: 3 });
    while (validMoves(g).length > 1) g = play(g, [validMoves(g)[0]!]);
    if (g.status === 'playing') {
      for (let seed = 0; seed < 20; seed++) {
        expect(chooseMove(g, 'easy', seededRng(seed))).toBe(validMoves(g)[0]);
      }
    }
  });
});

describe('never gives a face away for nothing', () => {
  it.each(['medium', 'hard'] as const)(
    '%s never plays a pure giveaway while a safe line exists',
    (difficulty) => {
      // property over full seeded self-play games: whenever the chosen
      // move is classified 'danger' (exposes a face, completes nothing),
      // there must have been no 'safe' move available
      for (let seed = 0; seed < 5; seed++) {
        const rng = seededRng(seed);
        let g = newGame({ gridSize: 3 });
        while (g.status === 'playing') {
          const analyses = [...analyzeAllMoves(g).values()];
          const safeExists = analyses.some((a) => a.kind === 'safe');
          const move = chooseMove(g, difficulty, rng);
          const chosen = analyses.find((a) => a.edgeId === move)!;
          if (chosen.kind === 'danger') {
            expect(safeExists).toBe(false);
          }
          g = play(g, [move]);
        }
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
