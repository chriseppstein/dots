/**
 * GameSession routes move intent between the UI, the engine, the AI, and
 * (online) the server. One rule keeps every mode coherent: the engine's
 * reducer is the only thing that changes state, and in online mode it
 * only runs on moves echoed back by the server — the client never applies
 * its own move optimistically, so it can never diverge.
 */

import { applyMove, newGame, type GameState, type Seat } from '../engine/game.ts';
import { findCompletingMove } from '../engine/analyzer.ts';
import { chooseMove, type Difficulty } from '../ai/ai.ts';
import type { GridSize } from '../engine/lattice.ts';

export interface MoveTransport {
  sendMove(seq: number, edgeId: number): void;
  resync(from: number): void;
}

export interface SessionOptions {
  mode: 'local' | 'ai' | 'online';
  gridSize: GridSize;
  playerNames: [string, string];
  /** ai mode: strength of the seat-1 computer player. */
  aiDifficulty?: Difficulty;
  /** Auto-play forced follow-up completions for human-controlled seats. */
  autoplayChains?: boolean;
  /** online mode: which seat this client controls. */
  mySeat?: Seat;
  /** online mode: where to send moves (a NetClient adapter). */
  transport?: MoveTransport;
}

export interface SessionSnapshot {
  state: GameState;
  lastMove: { edgeId: number; seat: Seat } | null;
  /** What the last applied move did — drives celebrations/banners. */
  lastResult: { completedFaces: number[]; claimedCubes: number[]; extraTurn: boolean } | null;
  /** True when the local user may pick an edge right now. */
  interactive: boolean;
  playerNames: [string, string];
}

const AI_DELAY_MS = 650;
const AUTOPLAY_DELAY_MS = 450;

export class GameSession {
  private state: GameState;
  private log: number[] = [];
  private lastMove: SessionSnapshot['lastMove'] = null;
  private lastResult: SessionSnapshot['lastResult'] = null;
  private listeners = new Set<(snap: SessionSnapshot) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(readonly opts: SessionOptions) {
    this.state = newGame({ gridSize: opts.gridSize });
    if (opts.mode === 'online' && (opts.mySeat === undefined || !opts.transport)) {
      throw new Error('online session requires mySeat and transport');
    }
  }

  snapshot(): SessionSnapshot {
    return {
      state: this.state,
      lastMove: this.lastMove,
      lastResult: this.lastResult,
      interactive: this.isInteractive(),
      playerNames: this.opts.playerNames,
    };
  }

  subscribe(listener: (snap: SessionSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  seq(): number {
    return this.log.length;
  }

  /** Human intent from the UI. Returns false if the move can't be made now. */
  requestMove(edgeId: number): boolean {
    if (!this.isInteractive()) return false;
    if (this.opts.mode === 'online') {
      if (this.state.edges[edgeId] !== 0) return false;
      this.opts.transport!.sendMove(this.log.length, edgeId);
      return true; // applied when the server echoes it back
    }
    return this.apply(edgeId);
  }

  /** online: a move-applied broadcast from the server. */
  applyRemoteMove(seq: number, edgeId: number, seat: Seat): void {
    if (seq < this.log.length) return; // already known (resync overlap)
    if (seq > this.log.length) {
      this.opts.transport!.resync(this.log.length);
      return;
    }
    if (this.state.currentSeat !== seat) {
      // the server is authoritative; a seat mismatch means we lost sync
      this.opts.transport!.resync(this.log.length);
      return;
    }
    this.apply(edgeId);
  }

  /** online: a resync batch (`moves` message). */
  applyRemoteMoves(from: number, edgeIds: number[]): void {
    for (let i = 0; i < edgeIds.length; i++) {
      const seq = from + i;
      if (seq < this.log.length) continue;
      if (seq > this.log.length) return; // gap — shouldn't happen; wait for next resync
      this.apply(edgeIds[i]!);
    }
  }

  /** Replace state wholesale (joining a game already in progress). */
  loadLog(edgeIds: number[]): void {
    this.state = newGame({ gridSize: this.opts.gridSize });
    this.log = [];
    this.lastMove = null;
    this.lastResult = null;
    for (const e of edgeIds) this.apply(e, true);
    this.emit();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
  }

  // ---- internals ----

  private isInteractive(): boolean {
    if (this.state.status !== 'playing') return false;
    switch (this.opts.mode) {
      case 'local':
        return true;
      case 'ai':
        return this.state.currentSeat === 0;
      case 'online':
        return this.state.currentSeat === this.opts.mySeat;
    }
  }

  private apply(edgeId: number, silent = false): boolean {
    const seat = this.state.currentSeat;
    const r = applyMove(this.state, { edgeId, seat });
    if (!r.ok) return false;
    this.state = r.state;
    this.log.push(edgeId);
    this.lastMove = { edgeId, seat };
    this.lastResult = {
      completedFaces: r.completedFaces,
      claimedCubes: r.claimedCubes,
      extraTurn: r.extraTurn,
    };
    if (!silent) {
      this.emit();
      this.scheduleFollowUp();
    }
    return true;
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  private scheduleFollowUp(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.state.status !== 'playing') return;

    const seat = this.state.currentSeat;
    const aiTurn = this.opts.mode === 'ai' && seat === 1;
    if (aiTurn) {
      this.timer = setTimeout(() => {
        if (this.disposed || this.state.status !== 'playing' || this.state.currentSeat !== 1) return;
        this.apply(chooseMove(this.state, this.opts.aiDifficulty ?? 'medium'));
      }, AI_DELAY_MS);
      return;
    }

    // autoplay forced completions for a human-controlled seat with the turn
    if (!this.opts.autoplayChains) return;
    const humanSeat =
      this.opts.mode === 'local' || (this.opts.mode === 'ai' && seat === 0)
        ? true
        : this.opts.mode === 'online' && seat === this.opts.mySeat;
    if (!humanSeat) return;
    const next = findCompletingMove(this.state);
    if (next === null) return;
    this.timer = setTimeout(() => {
      if (this.disposed || this.state.status !== 'playing' || this.state.currentSeat !== seat) return;
      const stillNext = findCompletingMove(this.state);
      if (stillNext === null) return;
      if (this.opts.mode === 'online') {
        this.opts.transport!.sendMove(this.log.length, stillNext);
      } else {
        this.apply(stillNext);
      }
    }, AUTOPLAY_DELAY_MS);
  }
}
