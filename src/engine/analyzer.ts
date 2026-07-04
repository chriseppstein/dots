/**
 * Move-consequence analysis: the single implementation behind the
 * renderer's hover preview and the AI's evaluation. Everything here is a
 * pure function of (state, edgeId) computed by trial runs of the real
 * reducer — never by re-deriving geometry.
 */

import { applyMove, latticeOf, validMoves, type GameState } from './game.ts';

export interface MoveAnalysis {
  edgeId: number;
  /** Faces this move completes immediately. */
  completesFaces: number;
  /** Cubes this move claims immediately. */
  claimsCubes: number;
  /**
   * Completing moves in the greedy follow-up this move starts, including
   * itself (0 when the move completes nothing). ≥2 means a chain.
   */
  chainLength: number;
  /** Unowned faces this move leaves one edge from completion. */
  exposesFaces: number;
  kind: 'safe' | 'scoring' | 'chain' | 'danger';
}

export function analyzeMove(state: GameState, edgeId: number): MoveAnalysis {
  const lat = latticeOf(state);
  const seat = state.currentSeat;
  const r = applyMove(state, { edgeId, seat });
  if (!r.ok) throw new Error(`cannot analyze illegal move ${edgeId}: ${r.error}`);

  const completesFaces = r.completedFaces.length;
  const claimsCubes = r.claimedCubes.length;

  // Faces adjacent to this edge now at 3/4 edges — a gift if the turn passes.
  let exposesFaces = 0;
  for (const f of lat.edgeFaces(edgeId)) {
    if (r.state.faces[f] !== 0) continue;
    const drawn = lat.faceEdges(f).filter((e) => r.state.edges[e] !== 0).length;
    if (drawn === 3) exposesFaces++;
  }

  let chainLength = 0;
  if (completesFaces > 0) {
    chainLength = 1;
    // Greedy follow-up: keep taking completing moves while the turn holds.
    let s = r.state;
    while (s.status === 'playing' && s.currentSeat === seat) {
      const next = findCompletingMove(s);
      if (next === null) break;
      const rr = applyMove(s, { edgeId: next, seat });
      if (!rr.ok || rr.completedFaces.length === 0) break;
      chainLength++;
      s = rr.state;
    }
  }

  const kind =
    chainLength >= 2 ? 'chain' : completesFaces > 0 ? 'scoring' : exposesFaces > 0 ? 'danger' : 'safe';

  return { edgeId, completesFaces, claimsCubes, chainLength, exposesFaces, kind };
}

/** Analysis for every legal move, keyed by edge id. */
export function analyzeAllMoves(state: GameState): Map<number, MoveAnalysis> {
  const result = new Map<number, MoveAnalysis>();
  for (const edgeId of validMoves(state)) {
    result.set(edgeId, analyzeMove(state, edgeId));
  }
  return result;
}

/** An undrawn edge that would complete ≥1 face for the mover, or null. */
export function findCompletingMove(state: GameState): number | null {
  const all = findCompletingMoves(state);
  return all.length > 0 ? all[0]! : null;
}

/** Every undrawn edge that would immediately complete a face. */
export function findCompletingMoves(state: GameState): number[] {
  const lat = latticeOf(state);
  const found = new Set<number>();
  for (let f = 0; f < state.faces.length; f++) {
    if (state.faces[f] !== 0) continue;
    let missing = -1;
    let drawn = 0;
    for (const e of lat.faceEdges(f)) {
      if (state.edges[e] !== 0) drawn++;
      else missing = e;
    }
    if (drawn === 3) found.add(missing);
  }
  return [...found];
}
