import { describe, it, expect, beforeEach } from 'vitest';
import { RoomLogic, type Client, type RoomStorage, type Session } from './room-logic.ts';
import type { ServerMessage } from '../../src/protocol/messages.ts';
import { getLattice } from '../../src/engine/lattice.ts';
import { newGame, applyMove, validMoves } from '../../src/engine/game.ts';

// Room behavior spec: seat assignment, reconnection by durable token,
// spectators, server-authoritative move validation with seq versioning,
// and resync. This is the contract the prototype's server never honored
// (its documented "token-based reconnection" did not exist).

class FakeStorage implements RoomStorage {
  data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.data.set(key, structuredClone(value));
  }
}

class FakeClient implements Client {
  sent: ServerMessage[] = [];
  session: Session | null = null;
  closed = false;
  send(msg: ServerMessage): void {
    this.sent.push(msg);
  }
  getSession(): Session | null {
    return this.session;
  }
  setSession(s: Session): void {
    this.session = s;
  }
  close(): void {
    this.closed = true;
  }
  last(): ServerMessage {
    return this.sent[this.sent.length - 1]!;
  }
  ofType<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }>[] {
    return this.sent.filter((m) => m.type === type) as Extract<ServerMessage, { type: T }>[];
  }
}

function setup() {
  const storage = new FakeStorage();
  const clients: FakeClient[] = [];
  const room = new RoomLogic(storage, () => clients.filter((c) => !c.closed));
  const connect = () => {
    const c = new FakeClient();
    clients.push(c);
    return c;
  };
  return { storage, room, connect };
}

const TOKEN_A = 'token-aaaaaaaa';
const TOKEN_B = 'token-bbbbbbbb';
const TOKEN_C = 'token-cccccccc';

describe('broadcast exclusion under Durable Object re-wrapping', () => {
  // The DO adapter creates a FRESH wrapper object per getWebSockets() call,
  // so excluding "the sender" by object identity can never match. Exclusion
  // must work by session token. Regression: the joiner received a
  // player-joined about itself and the client started the game solo.
  class SharedState {
    sent: ServerMessage[] = [];
    session: Session | null = null;
  }
  const rewrap = (s: SharedState): Client => ({
    send: (msg) => s.sent.push(msg),
    getSession: () => s.session,
    setSession: (session) => (s.session = session),
    close: () => {},
  });

  it('does not echo player-joined or player-connection back to the joiner', async () => {
    const storage = new FakeStorage();
    // connections appear as they connect, and every clients() call returns
    // fresh wrapper objects, like the real DO
    const states: SharedState[] = [];
    const room = new RoomLogic(storage, () => states.map(rewrap));
    await room.init({ gridSize: 3 });

    const a = new SharedState();
    states.push(a);
    await room.handleMessage(rewrap(a), { type: 'join', token: TOKEN_A, name: 'Alice' });
    expect(a.sent.filter((m) => m.type === 'player-joined')).toHaveLength(0);

    const b = new SharedState();
    states.push(b);
    await room.handleMessage(rewrap(b), { type: 'join', token: TOKEN_B, name: 'Bob' });
    expect(b.sent.filter((m) => m.type === 'player-joined')).toHaveLength(0);
    expect(a.sent.filter((m) => m.type === 'player-joined')).toHaveLength(1);

    // reconnect announcement must also skip the reconnector itself
    const a2 = new SharedState();
    states.push(a2);
    await room.handleMessage(rewrap(a2), { type: 'join', token: TOKEN_A, name: 'Alice' });
    expect(a2.sent.filter((m) => m.type === 'player-connection')).toHaveLength(0);
    expect(b.sent.filter((m) => m.type === 'player-connection')).toHaveLength(1);
  });
});

describe('joining and seats', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(async () => {
    s = setup();
    await s.room.init({ gridSize: 3 });
  });

  it('assigns seat 0 to the first joiner and seat 1 to the second', async () => {
    const a = s.connect();
    await s.room.handleMessage(a, { type: 'join', token: TOKEN_A, name: 'Alice' });
    expect(a.last()).toMatchObject({ type: 'joined', seat: 0, moves: [] });

    const b = s.connect();
    await s.room.handleMessage(b, { type: 'join', token: TOKEN_B, name: 'Bob' });
    expect(b.last()).toMatchObject({ type: 'joined', seat: 1 });

    // first joiner is told about the second
    expect(a.ofType('player-joined')).toHaveLength(1);
    expect(a.ofType('player-joined')[0]!.player).toMatchObject({ seat: 1, name: 'Bob' });
  });

  it('a third token becomes a spectator, not an error', async () => {
    const a = s.connect();
    const b = s.connect();
    const c = s.connect();
    await s.room.handleMessage(a, { type: 'join', token: TOKEN_A, name: 'Alice' });
    await s.room.handleMessage(b, { type: 'join', token: TOKEN_B, name: 'Bob' });
    await s.room.handleMessage(c, { type: 'join', token: TOKEN_C, name: 'Carol' });
    expect(c.last()).toMatchObject({ type: 'joined', seat: null });
  });

  it('rejoining with the same token recovers the same seat and the move log', async () => {
    const a = s.connect();
    const b = s.connect();
    await s.room.handleMessage(a, { type: 'join', token: TOKEN_A, name: 'Alice' });
    await s.room.handleMessage(b, { type: 'join', token: TOKEN_B, name: 'Bob' });
    await s.room.handleMessage(a, { type: 'move', seq: 0, edgeId: 5 });

    a.closed = true; // the runtime drops closed sockets from clients()
    await s.room.handleClose(a);
    const a2 = s.connect();
    await s.room.handleMessage(a2, { type: 'join', token: TOKEN_A, name: 'Alice' });
    expect(a2.last()).toMatchObject({ type: 'joined', seat: 0, moves: [5] });
  });

  it('announces disconnect and reconnect to the other player', async () => {
    const a = s.connect();
    const b = s.connect();
    await s.room.handleMessage(a, { type: 'join', token: TOKEN_A, name: 'Alice' });
    await s.room.handleMessage(b, { type: 'join', token: TOKEN_B, name: 'Bob' });
    a.closed = true; // the runtime drops closed sockets from clients()
    await s.room.handleClose(a);
    expect(b.ofType('player-connection')).toContainEqual({
      type: 'player-connection',
      seat: 0,
      connected: false,
    });
    const a2 = s.connect();
    await s.room.handleMessage(a2, { type: 'join', token: TOKEN_A, name: 'Alice' });
    expect(b.ofType('player-connection')).toContainEqual({
      type: 'player-connection',
      seat: 0,
      connected: true,
    });
  });
});

describe('moves', () => {
  let s: ReturnType<typeof setup>;
  let a: FakeClient;
  let b: FakeClient;
  beforeEach(async () => {
    s = setup();
    await s.room.init({ gridSize: 3 });
    a = s.connect();
    b = s.connect();
    await s.room.handleMessage(a, { type: 'join', token: TOKEN_A, name: 'Alice' });
    await s.room.handleMessage(b, { type: 'join', token: TOKEN_B, name: 'Bob' });
  });

  it('applies a legal move and broadcasts it to everyone with its seq', async () => {
    await s.room.handleMessage(a, { type: 'move', seq: 0, edgeId: 7 });
    const expected = { type: 'move-applied', seq: 0, edgeId: 7, seat: 0 };
    expect(a.ofType('move-applied')).toContainEqual(expected);
    expect(b.ofType('move-applied')).toContainEqual(expected);
  });

  it('rejects a move from the seat not on turn', async () => {
    await s.room.handleMessage(b, { type: 'move', seq: 0, edgeId: 7 });
    expect(b.last()).toMatchObject({ type: 'error', code: 'not-your-turn' });
    expect(a.ofType('move-applied')).toHaveLength(0);
  });

  it('rejects an illegal edge', async () => {
    await s.room.handleMessage(a, { type: 'move', seq: 0, edgeId: 999 });
    expect(a.last()).toMatchObject({ type: 'error', code: 'invalid-move' });
  });

  it('a stale seq gets a resync instead of applying the move', async () => {
    await s.room.handleMessage(a, { type: 'move', seq: 0, edgeId: 7 });
    // b (thinking no moves happened) tries seq 0 — its edge is not applied
    await s.room.handleMessage(b, { type: 'move', seq: 0, edgeId: 9 });
    const resync = b.ofType('moves');
    expect(resync).toHaveLength(1);
    expect(resync[0]).toMatchObject({ from: 0, edgeIds: [7] });
    expect((await s.room.info()).seq).toBe(1);
  });

  it('spectators cannot move', async () => {
    const c = s.connect();
    await s.room.handleMessage(c, { type: 'join', token: TOKEN_C, name: 'Carol' });
    await s.room.handleMessage(c, { type: 'move', seq: 0, edgeId: 7 });
    expect(c.last()).toMatchObject({ type: 'error', code: 'spectator' });
  });

  it('rejects moves before both seats are filled', async () => {
    const s2 = setup();
    await s2.room.init({ gridSize: 3 });
    const solo = s2.connect();
    await s2.room.handleMessage(solo, { type: 'join', token: TOKEN_A, name: 'Alice' });
    await s2.room.handleMessage(solo, { type: 'move', seq: 0, edgeId: 7 });
    expect(solo.last()).toMatchObject({ type: 'error', code: 'not-started' });
  });

  it('extra turns work over the wire: completing a face keeps the seat', async () => {
    const lat = getLattice(3);
    const faceEdges = lat.faceEdges(0);
    // mirror the engine locally to know whose turn it is
    let g = newGame({ gridSize: 3 });
    let seq = 0;
    const clientFor = (seat: number) => (seat === 0 ? a : b);
    for (const e of faceEdges) {
      await s.room.handleMessage(clientFor(g.currentSeat), { type: 'move', seq, edgeId: e });
      const r = applyMove(g, { edgeId: e, seat: g.currentSeat });
      if (!r.ok) throw new Error(r.error);
      g = r.state;
      seq++;
    }
    // the face completer (seat 1) kept the turn: a 5th move by seat 1 works
    const next = validMoves(g)[0]!;
    await s.room.handleMessage(b, { type: 'move', seq, edgeId: next });
    expect(b.ofType('move-applied')).toContainEqual({
      type: 'move-applied',
      seq,
      edgeId: next,
      seat: 1,
    });
  });
});

describe('resync and info', () => {
  it('answers resync with all moves from the requested index', async () => {
    const s = setup();
    await s.room.init({ gridSize: 3 });
    const a = s.connect();
    const b = s.connect();
    await s.room.handleMessage(a, { type: 'join', token: TOKEN_A, name: 'Alice' });
    await s.room.handleMessage(b, { type: 'join', token: TOKEN_B, name: 'Bob' });
    await s.room.handleMessage(a, { type: 'move', seq: 0, edgeId: 3 });
    await s.room.handleMessage(b, { type: 'move', seq: 1, edgeId: 8 });
    await s.room.handleMessage(a, { type: 'resync', from: 1 });
    expect(a.ofType('moves')).toContainEqual({ type: 'moves', from: 1, edgeIds: [8] });
  });

  it('info reports players, seq, and finished status', async () => {
    const s = setup();
    await s.room.init({ gridSize: 3 });
    const a = s.connect();
    await s.room.handleMessage(a, { type: 'join', token: TOKEN_A, name: 'Alice' });
    const info = await s.room.info();
    expect(info.config).toEqual({ gridSize: 3 });
    expect(info.players).toEqual([{ seat: 0, name: 'Alice', connected: true }]);
    expect(info.seq).toBe(0);
    expect(info.finished).toBe(false);
  });

  it('survives eviction: a fresh RoomLogic over the same storage has the full game', async () => {
    const s = setup();
    await s.room.init({ gridSize: 3 });
    const a = s.connect();
    const b = s.connect();
    await s.room.handleMessage(a, { type: 'join', token: TOKEN_A, name: 'Alice' });
    await s.room.handleMessage(b, { type: 'join', token: TOKEN_B, name: 'Bob' });
    await s.room.handleMessage(a, { type: 'move', seq: 0, edgeId: 3 });

    // "eviction": new logic instance, same storage (the DO restart case the
    // prototype worker got wrong — it discarded the game on reload)
    const clients2: FakeClient[] = [];
    const room2 = new RoomLogic(s.storage, () => clients2);
    const a2 = new FakeClient();
    clients2.push(a2);
    await room2.handleMessage(a2, { type: 'join', token: TOKEN_A, name: 'Alice' });
    expect(a2.last()).toMatchObject({ type: 'joined', seat: 0, moves: [3] });
    expect((await room2.info()).seq).toBe(1);
  });
});
