import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameSession, type MoveTransport } from './session.ts';
import { getLattice } from '../engine/lattice.ts';

// Session behavior: mode-specific move routing (who may act, when the AI
// fires, when autoplay dispatches), and the online contract — the server
// broadcast is the only thing that changes online state, exactly like the
// prototype's (correct) server-authoritative path but with seq versioning.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('local mode', () => {
  it('applies moves for whichever player is on turn and reports the result', () => {
    const s = new GameSession({ mode: 'local', gridSize: 3, playerNames: ['A', 'B'] });
    expect(s.snapshot().interactive).toBe(true);
    expect(s.requestMove(0)).toBe(true);
    const snap = s.snapshot();
    expect(snap.state.currentSeat).toBe(1);
    expect(snap.lastMove).toEqual({ edgeId: 0, seat: 0 });
    expect(snap.interactive).toBe(true); // hot-seat: next human plays
  });

  it('rejects an illegal move without changing state', () => {
    const s = new GameSession({ mode: 'local', gridSize: 3, playerNames: ['A', 'B'] });
    s.requestMove(0);
    expect(s.requestMove(0)).toBe(false);
    expect(s.snapshot().state.movesPlayed).toBe(1);
  });

  it('notifies subscribers on every applied move', () => {
    const s = new GameSession({ mode: 'local', gridSize: 3, playerNames: ['A', 'B'] });
    const seen: number[] = [];
    s.subscribe((snap) => seen.push(snap.state.movesPlayed));
    s.requestMove(0);
    s.requestMove(1);
    expect(seen).toEqual([1, 2]);
  });

  it('autoplay takes the follow-up completions after a face is completed', () => {
    const lat = getLattice(3);
    // face A missing shared edge s; face B missing s and one more edge b3
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
    const s = new GameSession({
      mode: 'local',
      gridSize: 3,
      playerNames: ['A', 'B'],
      autoplayChains: true,
    });
    for (const e of [...aEdges, ...bEdges.slice(0, 2)]) expect(s.requestMove(e)).toBe(true);
    const mover = s.snapshot().state.currentSeat;
    expect(s.requestMove(shared)).toBe(true); // completes A, exposes B
    vi.runAllTimers(); // autoplay takes b3 (and anything it opens)
    const snap = s.snapshot();
    expect(snap.state.faces[fA]).toBe(mover + 1);
    expect(snap.state.faces[fB]).toBe(mover + 1);
    expect(snap.state.currentSeat).toBe(mover); // extra turn retained
  });
});

describe('ai mode', () => {
  it('is only interactive on the human seat and fires the AI after a delay', () => {
    const s = new GameSession({
      mode: 'ai',
      gridSize: 3,
      playerNames: ['Human', 'Computer'],
      aiDifficulty: 'medium',
    });
    expect(s.snapshot().interactive).toBe(true);
    expect(s.requestMove(0)).toBe(true);
    expect(s.snapshot().interactive).toBe(false); // AI's turn
    expect(s.snapshot().state.movesPlayed).toBe(1);
    vi.runAllTimers();
    const snap = s.snapshot();
    expect(snap.state.movesPlayed).toBe(2);
    expect(snap.lastMove!.seat).toBe(1);
    expect(snap.interactive).toBe(true); // back to the human
  });

  it('ignores human input while the AI is on turn', () => {
    const s = new GameSession({
      mode: 'ai',
      gridSize: 3,
      playerNames: ['H', 'C'],
      aiDifficulty: 'easy',
    });
    s.requestMove(0);
    expect(s.requestMove(1)).toBe(false);
  });
});

describe('online mode', () => {
  function makeTransport() {
    const sent: { seq: number; edgeId: number }[] = [];
    const resyncs: number[] = [];
    const transport: MoveTransport & { sent: typeof sent; resyncs: typeof resyncs } = {
      sent,
      resyncs,
      sendMove: (seq, edgeId) => sent.push({ seq, edgeId }),
      resync: (from) => resyncs.push(from),
    };
    return transport;
  }

  it('sends the move to the server instead of applying it', () => {
    const t = makeTransport();
    const s = new GameSession({
      mode: 'online',
      gridSize: 3,
      playerNames: ['Me', 'Them'],
      mySeat: 0,
      transport: t,
    });
    expect(s.requestMove(4)).toBe(true);
    expect(t.sent).toEqual([{ seq: 0, edgeId: 4 }]);
    expect(s.snapshot().state.movesPlayed).toBe(0); // not applied yet
  });

  it('applies server broadcasts in order', () => {
    const t = makeTransport();
    const s = new GameSession({
      mode: 'online',
      gridSize: 3,
      playerNames: ['Me', 'Them'],
      mySeat: 0,
      transport: t,
    });
    s.applyRemoteMove(0, 4, 0);
    s.applyRemoteMove(1, 9, 1);
    const snap = s.snapshot();
    expect(snap.state.movesPlayed).toBe(2);
    expect(snap.lastMove).toEqual({ edgeId: 9, seat: 1 });
  });

  it('refuses input when it is the opponent turn', () => {
    const t = makeTransport();
    const s = new GameSession({
      mode: 'online',
      gridSize: 3,
      playerNames: ['Me', 'Them'],
      mySeat: 1,
      transport: t,
    });
    expect(s.snapshot().interactive).toBe(false);
    expect(s.requestMove(4)).toBe(false);
    expect(t.sent).toHaveLength(0);
  });

  it('requests a resync when a broadcast arrives from the future', () => {
    const t = makeTransport();
    const s = new GameSession({
      mode: 'online',
      gridSize: 3,
      playerNames: ['Me', 'Them'],
      mySeat: 0,
      transport: t,
    });
    s.applyRemoteMove(3, 12, 1); // we missed moves 0-2
    expect(t.resyncs).toEqual([0]);
    expect(s.snapshot().state.movesPlayed).toBe(0);
  });

  it('applies a resync batch and ignores already-known moves', () => {
    const t = makeTransport();
    const s = new GameSession({
      mode: 'online',
      gridSize: 3,
      playerNames: ['Me', 'Them'],
      mySeat: 0,
      transport: t,
    });
    s.applyRemoteMove(0, 4, 0);
    s.applyRemoteMoves(0, [4, 9, 14]); // overlap: move 0 already applied
    expect(s.snapshot().state.movesPlayed).toBe(3);
  });
});
