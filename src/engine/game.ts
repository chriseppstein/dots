/**
 * Pure rules of 3D dots and boxes. One reducer — applyMove — is the only
 * code anywhere (client, AI, worker) that changes game state. State is
 * immutable: applyMove returns a fresh GameState and never touches its
 * input. Scores are always derived from ownership, never stored.
 *
 * Ownership encoding in the typed arrays: 0 = unowned, seat + 1 otherwise.
 */

import { getLattice, type GridSize, type Lattice } from './lattice.ts';

export type Seat = 0 | 1;

export interface GameConfig {
  gridSize: GridSize;
}

export interface Move {
  edgeId: number;
  seat: Seat;
}

export interface GameState {
  readonly config: GameConfig;
  /** Per-edge owner (who drew it), 0 = undrawn. Indexed by edgeId. */
  readonly edges: Uint8Array;
  /** Per-face owner (who completed it), 0 = unowned. Indexed by faceId. */
  readonly faces: Uint8Array;
  /** Per-cube owner (first to 4 of 6 faces), 0 = unclaimed. Indexed by cubeId. */
  readonly cubes: Uint8Array;
  readonly currentSeat: Seat;
  readonly movesPlayed: number;
  readonly status: 'playing' | 'finished';
  /** Set when finished and not a draw; null otherwise. */
  readonly winner: Seat | null;
}

export type MoveError = 'game-over' | 'not-your-turn' | 'edge-out-of-range' | 'edge-taken';

export type MoveResult =
  | {
      ok: true;
      state: GameState;
      /** Face ids this move completed (0, 1, or 2). */
      completedFaces: number[];
      /** Cube ids this move claimed. */
      claimedCubes: number[];
      /** True iff the mover keeps the turn (completed ≥ 1 face). */
      extraTurn: boolean;
    }
  | { ok: false; error: MoveError };

export function latticeOf(state: GameState): Lattice {
  return getLattice(state.config.gridSize);
}

export function newGame(config: GameConfig): GameState {
  const lat = getLattice(config.gridSize);
  return {
    config,
    edges: new Uint8Array(lat.edgeCount),
    faces: new Uint8Array(lat.faceCount),
    cubes: new Uint8Array(lat.cubeCount),
    currentSeat: 0,
    movesPlayed: 0,
    status: 'playing',
    winner: null,
  };
}

export function applyMove(state: GameState, move: Move): MoveResult {
  const lat = latticeOf(state);
  if (state.status === 'finished') return { ok: false, error: 'game-over' };
  if (!Number.isInteger(move.edgeId) || move.edgeId < 0 || move.edgeId >= lat.edgeCount) {
    return { ok: false, error: 'edge-out-of-range' };
  }
  if (move.seat !== state.currentSeat) return { ok: false, error: 'not-your-turn' };
  if (state.edges[move.edgeId] !== 0) return { ok: false, error: 'edge-taken' };

  const owner = move.seat + 1;
  const edges = state.edges.slice();
  const faces = state.faces.slice();
  const cubes = state.cubes.slice();
  edges[move.edgeId] = owner;

  const completedFaces: number[] = [];
  for (const f of lat.edgeFaces(move.edgeId)) {
    if (faces[f] === 0 && lat.faceEdges(f).every((e) => edges[e] !== 0)) {
      faces[f] = owner;
      completedFaces.push(f);
    }
  }

  const claimedCubes: number[] = [];
  for (const f of completedFaces) {
    for (const c of lat.faceCubes(f)) {
      if (cubes[c] !== 0) continue;
      const ownedFaces = lat.cubeFaces(c).filter((cf) => faces[cf] === owner).length;
      if (ownedFaces >= 4) {
        cubes[c] = owner;
        claimedCubes.push(c);
      }
    }
  }

  const extraTurn = completedFaces.length > 0;
  const movesPlayed = state.movesPlayed + 1;

  let a = 0;
  let b = 0;
  for (const c of cubes) {
    if (c === 1) a++;
    else if (c === 2) b++;
  }
  // Mercy rule: a strict majority of the cubes can never be caught, so the
  // game ends immediately — this caps the blowout runaway where one player
  // sweeps every remaining chain. Exactly half is not a majority (3³'s
  // 4–4 can still end in a full-board draw). Otherwise the game runs
  // until every edge is drawn; 3–3 cubes stay unclaimed and equal counts
  // draw.
  const majority = a * 2 > lat.cubeCount ? 0 : b * 2 > lat.cubeCount ? 1 : null;
  const finished = majority !== null || movesPlayed === lat.edgeCount;
  const winner: Seat | null = finished ? (majority ?? (a > b ? 0 : b > a ? 1 : null)) : null;

  return {
    ok: true,
    state: {
      config: state.config,
      edges,
      faces,
      cubes,
      currentSeat: extraTurn ? move.seat : ((1 - move.seat) as Seat),
      movesPlayed,
      status: finished ? 'finished' : 'playing',
      winner,
    },
    completedFaces,
    claimedCubes,
    extraTurn,
  };
}

/**
 * Rebuild state by folding the reducer over a move log. The seat of each
 * move is implied: it is always whoever's turn it is. Throws on an invalid
 * log — a log that fails to replay is corrupt, not a user error.
 */
export function replay(config: GameConfig, edgeIds: readonly number[]): GameState {
  let state = newGame(config);
  for (const edgeId of edgeIds) {
    // trailing moves past the finish are ignored, not corruption: logs
    // recorded before a rules change (e.g. the mercy rule) may legally
    // continue past where the game now ends
    if (state.status === 'finished') break;
    const r = applyMove(state, { edgeId, seat: state.currentSeat });
    if (!r.ok) throw new Error(`corrupt move log: edge ${edgeId} rejected (${r.error})`);
    state = r.state;
  }
  return state;
}

/** Undrawn edge ids — the legal moves for whoever is on turn. */
export function validMoves(state: GameState): number[] {
  if (state.status === 'finished') return [];
  const moves: number[] = [];
  for (let e = 0; e < state.edges.length; e++) {
    if (state.edges[e] === 0) moves.push(e);
  }
  return moves;
}

/** Cubes claimed per seat — the score that decides the game. */
export function scores(state: GameState): [number, number] {
  return countBySeat(state.cubes);
}

/** Faces owned per seat — progress toward cubes, shown in the HUD. */
export function faceCounts(state: GameState): [number, number] {
  return countBySeat(state.faces);
}

function countBySeat(owners: Uint8Array): [number, number] {
  let a = 0;
  let b = 0;
  for (const o of owners) {
    if (o === 1) a++;
    else if (o === 2) b++;
  }
  return [a, b];
}
