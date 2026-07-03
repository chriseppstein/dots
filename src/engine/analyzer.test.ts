import { describe, it, expect } from 'vitest';
import { getLattice } from './lattice.ts';
import { newGame, applyMove, type GameState } from './game.ts';
import { analyzeMove, analyzeAllMoves } from './analyzer.ts';

// The analyzer classifies every legal move by consequence. It is the single
// implementation behind both the renderer's hover preview (the prototype's
// best feature) and the AI's evaluation — in the prototype these were three
// divergent copies, which is what broke chain detection.

function play(state: GameState, edges: number[]): GameState {
  for (const edgeId of edges) {
    const r = applyMove(state, { edgeId, seat: state.currentSeat });
    if (!r.ok) throw new Error(`setup move ${edgeId} rejected: ${r.error}`);
    state = r.state;
  }
  return state;
}

describe('analyzeMove', () => {
  const lat = getLattice(3);

  it('classifies every opening move as safe', () => {
    const g = newGame({ gridSize: 3 });
    for (const [edgeId, a] of analyzeAllMoves(g)) {
      expect(a.kind).toBe('safe');
      expect(a.completesFaces).toBe(0);
      expect(a.exposesFaces).toBe(0);
      expect(edgeId).toBe(a.edgeId);
    }
  });

  it('flags the third edge of a face as danger', () => {
    const [e1, e2, e3] = lat.faceEdges(0);
    const g = play(newGame({ gridSize: 3 }), [e1!, e2!]);
    const a = analyzeMove(g, e3!);
    expect(a.kind).toBe('danger');
    expect(a.exposesFaces).toBeGreaterThanOrEqual(1);
    expect(a.completesFaces).toBe(0);
  });

  it('flags the fourth edge of a face as scoring', () => {
    const edges = lat.faceEdges(0);
    const g = play(newGame({ gridSize: 3 }), edges.slice(0, 3));
    const a = analyzeMove(g, edges[3]!);
    expect(a.kind).toBe('scoring');
    expect(a.completesFaces).toBe(1);
    expect(a.chainLength).toBe(1);
  });

  it('detects a chain: completing one face opens another completable face', () => {
    // Build two faces sharing an edge. Draw all edges of both except the
    // shared edge and one outer edge of face B. Completing face A (by
    // drawing its last non-shared... ) — construct explicitly:
    // face A edges: a1 a2 a3 s; face B edges: b1 b2 b3 s (s shared).
    // Draw a1 a2 b1 b2 b3? No: then s completes B immediately.
    // Chain setup: draw a1 a2 a3 (A lacks only s), draw b1 b2 (B lacks s
    // and b3). Playing b3 exposes B... playing s completes A AND B? s is
    // 4th edge of A and 3rd of B — completes A, exposes B: chain of length
    // 2 via s then b3.
    let shared = -1;
    let fA = -1;
    let fB = -1;
    for (let e = 0; e < lat.edgeCount; e++) {
      const faces = lat.edgeFaces(e);
      if (faces.length >= 2) {
        shared = e;
        fA = faces[0]!;
        fB = faces[1]!;
        break;
      }
    }
    const aEdges = lat.faceEdges(fA).filter((e) => e !== shared);
    const bEdges = lat.faceEdges(fB).filter((e) => e !== shared);
    const g = play(newGame({ gridSize: 3 }), [...aEdges, ...bEdges.slice(0, 2)]);
    const a = analyzeMove(g, shared);
    expect(a.completesFaces).toBe(1);
    expect(a.chainLength).toBeGreaterThanOrEqual(2);
    expect(a.kind).toBe('chain');
  });

  it('reports cube claims: the analysis of a claiming move says so beforehand', () => {
    // Walk seat 0 through the edges of cube 0's faces (opponent wastes moves
    // far away). Before each seat-0 move, ask the analyzer; the move that
    // ends up claiming the cube must have been flagged with claimsCubes ≥ 1.
    const target = lat.cubeFaces(0).slice(0, 4);
    const needed: number[] = [];
    const seen = new Set<number>();
    for (const f of target)
      for (const e of lat.faceEdges(f))
        if (!seen.has(e)) {
          seen.add(e);
          needed.push(e);
        }
    let g = newGame({ gridSize: 3 });
    const targetSet = new Set(target);
    let claimFlagged = false;
    for (const e of needed) {
      if (g.currentSeat !== 0) {
        const waste = Array.from({ length: lat.edgeCount }, (_, i) => i).find(
          (i) =>
            g.edges[i] === 0 &&
            !seen.has(i) &&
            lat.edgeFaces(i).every((f) => !targetSet.has(f)) &&
            !lat.edgeFaces(i).some((f) => lat.faceEdges(f).every((fe) => fe === i || g.edges[fe] !== 0)),
        );
        g = play(g, [waste!]);
      }
      const a = analyzeMove(g, e);
      const r = applyMove(g, { edgeId: e, seat: 0 });
      if (!r.ok) throw new Error(r.error);
      // the analyzer's prediction must match what the reducer then did
      expect(a.completesFaces).toBe(r.completedFaces.length);
      expect(a.claimsCubes).toBe(r.claimedCubes.length);
      if (r.claimedCubes.length > 0) claimFlagged = a.claimsCubes >= 1;
      g = r.state;
      if (g.cubes[0] !== 0) break;
    }
    expect(g.cubes[0]).toBe(1); // seat 0 owns cube 0
    expect(claimFlagged).toBe(true);
  });

  it('never mutates the input state', () => {
    const g = newGame({ gridSize: 3 });
    const before = [...g.edges];
    analyzeAllMoves(g);
    expect([...g.edges]).toEqual(before);
    expect(g.currentSeat).toBe(0);
  });
});
