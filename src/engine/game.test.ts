import { describe, it, expect } from 'vitest';
import { getLattice } from './lattice.ts';
import { findCompletingMove } from './analyzer.ts';
import {
  newGame,
  applyMove,
  replay,
  validMoves,
  scores,
  faceCounts,
  type GameState,
} from './game.ts';

// Behavioral spec ported from the prototype's GameRules.test.ts,
// GameEngine.test.ts, SquareCounting.test.ts, SquareOvercountingBug.test.ts,
// and ScoringAndWinConditions.test.ts. Rules of 3D dots and boxes:
//  - players alternate drawing edges; completing a face grants another turn
//  - the player completing a face owns it; owning 4 of a cube's 6 faces
//    claims the cube; cubes (not faces) decide the winner
//  - the game ends when every edge is drawn; most cubes wins, ties draw
//    (a cube whose faces split 3–3 is claimed by no one)

/** Apply a sequence of edges, each played by whoever's turn it is. */
function play(state: GameState, edges: number[]): GameState {
  for (const edgeId of edges) {
    const r = applyMove(state, { edgeId, seat: state.currentSeat });
    if (!r.ok) throw new Error(`move ${edgeId} rejected: ${r.error}`);
    state = r.state;
  }
  return state;
}

describe('new game', () => {
  it('starts with seat 0 to move, nothing owned, game in progress', () => {
    const g = newGame({ gridSize: 3 });
    expect(g.currentSeat).toBe(0);
    expect(g.status).toBe('playing');
    expect(g.winner).toBeNull();
    expect(scores(g)).toEqual([0, 0]);
    expect(faceCounts(g)).toEqual([0, 0]);
    expect(validMoves(g)).toHaveLength(54);
  });

  it.each([[3, 54], [4, 144], [5, 300]] as const)(
    'a %i³ game opens with %i valid moves',
    (n, count) => {
      expect(validMoves(newGame({ gridSize: n }))).toHaveLength(count);
    },
  );
});

describe('move validation', () => {
  it('rejects an edge id out of range', () => {
    const g = newGame({ gridSize: 3 });
    expect(applyMove(g, { edgeId: -1, seat: 0 })).toMatchObject({ ok: false, error: 'edge-out-of-range' });
    expect(applyMove(g, { edgeId: 54, seat: 0 })).toMatchObject({ ok: false, error: 'edge-out-of-range' });
  });

  it('rejects drawing an already-drawn edge', () => {
    const g = newGame({ gridSize: 3 });
    const r = applyMove(g, { edgeId: 0, seat: 0 });
    if (!r.ok) throw new Error('setup failed');
    expect(applyMove(r.state, { edgeId: 0, seat: r.state.currentSeat })).toMatchObject({
      ok: false,
      error: 'edge-taken',
    });
  });

  it('rejects a move by the seat not on turn', () => {
    const g = newGame({ gridSize: 3 });
    expect(applyMove(g, { edgeId: 0, seat: 1 })).toMatchObject({ ok: false, error: 'not-your-turn' });
  });

  it('does not mutate the input state', () => {
    const g = newGame({ gridSize: 3 });
    applyMove(g, { edgeId: 0, seat: 0 });
    expect(g.edges.every((v) => v === 0)).toBe(true);
    expect(g.currentSeat).toBe(0);
  });
});

/** The 4 edges of face 0 of the lattice, for face-completion setups. */
function someFaceEdges(n: 3 | 4 | 5 | 6, faceIndex = 0): number[] {
  return [...getLattice(n).faceEdges(faceIndex)];
}

describe('turn passing and face completion', () => {
  it('alternates turns when no face is completed', () => {
    const g = newGame({ gridSize: 3 });
    const r = applyMove(g, { edgeId: 0, seat: 0 });
    if (!r.ok) throw new Error(r.error);
    expect(r.extraTurn).toBe(false);
    expect(r.completedFaces).toEqual([]);
    expect(r.state.currentSeat).toBe(1);
  });

  it('the player who draws the 4th edge owns the face and moves again', () => {
    const [e1, e2, e3, e4] = someFaceEdges(3);
    let g = newGame({ gridSize: 3 });
    // seat0 e1, seat1 e2, seat0 e3 — now seat1 completes with e4
    g = play(g, [e1!, e2!, e3!]);
    expect(g.currentSeat).toBe(1);
    const r = applyMove(g, { edgeId: e4!, seat: 1 });
    if (!r.ok) throw new Error(r.error);
    expect(r.completedFaces).toHaveLength(1);
    expect(r.extraTurn).toBe(true);
    expect(r.state.currentSeat).toBe(1); // keeps the turn
    expect(faceCounts(r.state)).toEqual([0, 1]);
  });

  it('a move completing two faces at once still grants exactly one extra turn', () => {
    // Two faces sharing an edge: draw the 3 non-shared edges of each,
    // then the shared edge completes both simultaneously.
    const lat = getLattice(3);
    let shared = -1;
    let fA = -1;
    let fB = -1;
    outer: for (let e = 0; e < lat.edgeCount; e++) {
      const faces = lat.edgeFaces(e);
      if (faces.length >= 2) {
        shared = e;
        fA = faces[0]!;
        fB = faces[1]!;
        break outer;
      }
    }
    const rim = [
      ...lat.faceEdges(fA).filter((e) => e !== shared),
      ...lat.faceEdges(fB).filter((e) => e !== shared),
    ];
    let g = newGame({ gridSize: 3 });
    g = play(g, rim);
    const seat = g.currentSeat;
    const r = applyMove(g, { edgeId: shared, seat });
    if (!r.ok) throw new Error(r.error);
    expect(r.completedFaces.sort()).toEqual([fA, fB].sort());
    expect(r.extraTurn).toBe(true);
    expect(r.state.currentSeat).toBe(seat);
    expect(faceCounts(r.state)[seat]).toBeGreaterThanOrEqual(2);
  });
});

describe('shared faces are counted once (the prototype overcounting bug)', () => {
  it('a face between two cubes adds 1 to the owner face count, not 2', () => {
    const lat = getLattice(3);
    // find a face shared by two cubes
    let sharedFace = -1;
    for (let f = 0; f < lat.faceCount; f++) {
      if (lat.faceCubes(f).length === 2) {
        sharedFace = f;
        break;
      }
    }
    expect(sharedFace).toBeGreaterThanOrEqual(0);
    const [e1, e2, e3, e4] = [...lat.faceEdges(sharedFace)];
    let g = newGame({ gridSize: 3 });
    g = play(g, [e1!, e2!, e3!, e4!]);
    const owner = g.faces[sharedFace]! - 1;
    expect(faceCounts(g)[owner]).toBe(1);
  });
});

describe('cube claiming', () => {
  it('claiming 4 of 6 faces of a cube scores the cube for that player', () => {
    // Single-player walk: have seat 0 complete faces of cube 0 by always
    // letting seat 1 play a far-away edge when it's their turn.
    const lat = getLattice(3);
    const cube = 0;
    const faces = [...lat.cubeFaces(cube)];
    let g = newGame({ gridSize: 3 });

    // Collect the edges of the first 4 faces of cube 0.
    const targetFaces = faces.slice(0, 4);
    // Edges needed, deduped, in face order so each face's last edge completes it.
    const drawn = new Set<number>();
    const seq: number[] = [];
    for (const f of targetFaces) {
      for (const e of lat.faceEdges(f)) {
        if (!drawn.has(e)) {
          drawn.add(e);
          seq.push(e);
        }
      }
    }

    // Seat 0 must draw *every* completing edge. Simplest scheme: when it's
    // seat 1's turn, they play a "waste" edge that borders no target face.
    const targetFaceSet = new Set(targetFaces);
    const isWaste = (e: number) =>
      !drawn.has(e) && g.edges[e] === 0 && lat.edgeFaces(e).every((f) => !targetFaceSet.has(f));

    for (const e of seq) {
      if (g.currentSeat !== 0) {
        // seat 1 wastes a move somewhere harmless
        const waste = Array.from({ length: lat.edgeCount }, (_, i) => i).find(
          (i) => isWaste(i) && !wouldCompleteAnyFace(g, i),
        );
        expect(waste).toBeDefined();
        const r1 = applyMove(g, { edgeId: waste!, seat: 1 });
        if (!r1.ok) throw new Error(r1.error);
        g = r1.state;
      }
      const r = applyMove(g, { edgeId: e, seat: 0 });
      if (!r.ok) throw new Error(r.error);
      g = r.state;
    }

    expect(faceCounts(g)[0]).toBeGreaterThanOrEqual(4);
    expect(scores(g)[0]).toBeGreaterThanOrEqual(1);
    expect(g.cubes[cube]).toBe(1); // owned by seat 0

    function wouldCompleteAnyFace(state: GameState, e: number): boolean {
      return lat
        .edgeFaces(e)
        .some((f) => lat.faceEdges(f).every((fe) => fe === e || state.edges[fe] !== 0));
    }
  });
});

describe('game end', () => {
  function playOut(n: 3 | 4): GameState {
    // deterministic playout: always the lowest-numbered valid move
    let g = newGame({ gridSize: n });
    while (g.status === 'playing') {
      const moves = validMoves(g);
      g = play(g, [moves[0]!]);
    }
    return g;
  }

  it('finishes when all edges are drawn OR a majority of cubes is clinched', () => {
    const lat = getLattice(3);
    const g = playOut(3);
    expect(g.status).toBe('finished');
    expect(validMoves(g)).toHaveLength(0);
    if (g.movesPlayed < lat.edgeCount) {
      // mercy rule: the winner holds a strict majority no one can catch
      expect(g.winner).not.toBeNull();
      expect(scores(g)[g.winner!] * 2).toBeGreaterThan(lat.cubeCount);
    } else {
      expect([...g.faces].every((v) => v !== 0)).toBe(true);
    }
  });

  it('ends the moment a player crosses half the cubes (mercy rule)', () => {
    // Asymmetric playout: seat 0 always takes completions, seat 1 always
    // refuses them. Seat 0 sweeps the cubes, so on 3³ (8 cubes) it reaches
    // 5 well before the board fills. The game must end right there — never
    // earlier (4 of 8 is not a majority), never later.
    const lat = getLattice(3);
    let g = newGame({ gridSize: 3 });
    while (g.status === 'playing') {
      const [a, b] = scores(g);
      expect(a * 2).toBeLessThanOrEqual(lat.cubeCount);
      expect(b * 2).toBeLessThanOrEqual(lat.cubeCount);
      const completing = findCompletingMove(g);
      const passive = validMoves(g).find((e) => e !== completing) ?? validMoves(g)[0]!;
      g = play(g, [g.currentSeat === 0 ? (completing ?? passive) : passive]);
    }
    // this playout must clinch early — otherwise this test proves nothing
    expect(g.movesPlayed).toBeLessThan(lat.edgeCount);
    const [a, b] = scores(g);
    expect(Math.max(a, b) * 2).toBeGreaterThan(lat.cubeCount);
    expect(g.winner).toBe(a > b ? 0 : 1);
    expect(validMoves(g)).toHaveLength(0);
  });

  it('rejects moves after the game is over', () => {
    const g = playOut(3);
    expect(applyMove(g, { edgeId: 0, seat: g.currentSeat })).toMatchObject({
      ok: false,
      error: 'game-over',
    });
  });

  it('a full-board finish scores by cube count; equal cubes is a draw', () => {
    const g = playOut(3);
    const [a, b] = scores(g);
    if (a === b) expect(g.winner).toBeNull();
    else expect(g.winner).toBe(a > b ? 0 : 1);
    const claimed = [...g.cubes].filter((v) => v !== 0).length;
    expect(a + b).toBe(claimed);
    expect(claimed).toBeLessThanOrEqual(8);
  });
});

describe('replay (move log is the source of truth)', () => {
  it('replaying a move log reproduces the exact same state', () => {
    let g = newGame({ gridSize: 4 });
    const log: number[] = [];
    // 40 deterministic moves
    for (let i = 0; i < 40; i++) {
      const m = validMoves(g)[i % validMoves(g).length]!;
      log.push(m);
      g = play(g, [m]);
    }
    const replayed = replay({ gridSize: 4 }, log);
    expect(replayed.currentSeat).toBe(g.currentSeat);
    expect(replayed.movesPlayed).toBe(g.movesPlayed);
    expect([...replayed.edges]).toEqual([...g.edges]);
    expect([...replayed.faces]).toEqual([...g.faces]);
    expect([...replayed.cubes]).toEqual([...g.cubes]);
    expect(replayed.status).toBe(g.status);
  });

  it('replay rejects an invalid log', () => {
    expect(() => replay({ gridSize: 3 }, [0, 0])).toThrow();
  });

  it('replay tolerates moves after the finish (pre-mercy-rule logs)', () => {
    // build a log that clinches early, then append leftover valid edges
    // the way an old-rules game would have recorded them
    let g = newGame({ gridSize: 3 });
    const log: number[] = [];
    while (g.status === 'playing') {
      const completing = findCompletingMove(g);
      const passive = validMoves(g).find((e) => e !== completing) ?? validMoves(g)[0]!;
      const move = g.currentSeat === 0 ? (completing ?? passive) : passive;
      log.push(move);
      g = play(g, [move]);
    }
    expect(g.movesPlayed).toBeLessThan(getLattice(3).edgeCount); // clinched early
    const leftovers = [];
    for (let e = 0; e < 54 && leftovers.length < 3; e++) if (g.edges[e] === 0) leftovers.push(e);
    const replayed = replay({ gridSize: 3 }, [...log, ...leftovers]);
    expect(replayed.status).toBe('finished');
    expect(replayed.winner).toBe(g.winner);
    expect(replayed.movesPlayed).toBe(g.movesPlayed);
  });
});
