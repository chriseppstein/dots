/**
 * Runtime-agnostic game-room brain. The Durable Object in room.ts is a
 * thin adapter over this class; tests drive it directly with fakes.
 *
 * Persistence model: the append-only move log is the source of truth.
 * Any instance (fresh after eviction or not) rebuilds exact game state by
 * folding the shared reducer over the log — the prototype worker's
 * "restore would go here" data loss is structurally impossible here.
 */

import {
  applyMove,
  newGame,
  replay,
  type GameConfig,
  type GameState,
  type Seat,
} from '../../src/engine/game.ts';
import type {
  ClientMessage,
  RoomInfo,
  RoomPlayer,
  ServerMessage,
} from '../../src/protocol/messages.ts';

export interface RoomStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

/** A connected socket. Session survives DO hibernation via attachments. */
export interface Client {
  send(msg: ServerMessage): void;
  getSession(): Session | null;
  setSession(session: Session): void;
  close(code?: number, reason?: string): void;
}

export interface Session {
  token: string;
  name: string;
  /** null = spectator. */
  seat: Seat | null;
}

interface StoredPlayer {
  token: string;
  name: string;
  seat: Seat;
}

export class RoomLogic {
  /** Replay cache: valid while log length matches. */
  private cached: { length: number; state: GameState } | null = null;

  constructor(
    private readonly storage: RoomStorage,
    private readonly clients: () => Client[],
  ) {}

  async init(config: GameConfig): Promise<void> {
    if (await this.storage.get('config')) return; // idempotent
    await this.storage.put('config', config);
    await this.storage.put('players', []);
    await this.storage.put('log', []);
  }

  async isInitialized(): Promise<boolean> {
    return (await this.storage.get('config')) !== undefined;
  }

  async info(): Promise<RoomInfo> {
    const config = await this.mustGetConfig();
    const log = await this.getLog();
    const state = await this.state(config, log);
    return {
      config,
      players: await this.roomPlayers(),
      seq: log.length,
      finished: state.status === 'finished',
    };
  }

  async handleMessage(client: Client, msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case 'join':
        return this.handleJoin(client, msg.token, msg.name);
      case 'move':
        return this.handleMove(client, msg.seq, msg.edgeId);
      case 'resync':
        return this.handleResync(client, msg.from);
      case 'ping':
        client.send({ type: 'pong' });
        return;
    }
  }

  async handleClose(client: Client): Promise<void> {
    const session = client.getSession();
    if (session?.seat === null || session === null) return;
    // announce only if no other connection holds the same seat
    const stillConnected = this.clients().some(
      (c) => c !== client && c.getSession()?.token === session.token,
    );
    if (!stillConnected) {
      this.broadcast({ type: 'player-connection', seat: session.seat, connected: false }, client);
    }
  }

  private async handleJoin(client: Client, token: string, name: string): Promise<void> {
    const config = await this.mustGetConfig();
    const players = (await this.storage.get<StoredPlayer[]>('players')) ?? [];
    const log = await this.getLog();

    let seat: Seat | null = null;
    const existing = players.find((p) => p.token === token);
    if (existing) {
      seat = existing.seat;
      if (existing.name !== name) {
        existing.name = name;
        await this.storage.put('players', players);
      }
    } else if (players.length < 2) {
      seat = players.length as Seat;
      players.push({ token, name, seat });
      await this.storage.put('players', players);
    }

    client.setSession({ token, name, seat });
    client.send({
      type: 'joined',
      seat,
      config,
      players: await this.roomPlayers(),
      moves: log,
    });

    if (seat !== null) {
      if (existing) {
        this.broadcast({ type: 'player-connection', seat, connected: true }, client);
      } else {
        this.broadcast(
          { type: 'player-joined', player: { seat, name, connected: true } },
          client,
        );
      }
    }
  }

  private async handleMove(client: Client, seq: number, edgeId: number): Promise<void> {
    const session = client.getSession();
    if (!session) return client.send(err('not-joined', 'join before moving'));
    if (session.seat === null) return client.send(err('spectator', 'spectators cannot move'));

    const players = (await this.storage.get<StoredPlayer[]>('players')) ?? [];
    if (players.length < 2) return client.send(err('not-started', 'waiting for the second player'));

    const config = await this.mustGetConfig();
    const log = await this.getLog();

    if (seq !== log.length) {
      // stale client: answer with the moves it is missing instead of applying
      client.send({ type: 'moves', from: seq, edgeIds: log.slice(seq) });
      return;
    }

    const state = await this.state(config, log);
    if (state.currentSeat !== session.seat) {
      return client.send(err('not-your-turn', `seat ${state.currentSeat} is on turn`));
    }
    const r = applyMove(state, { edgeId, seat: session.seat });
    if (!r.ok) return client.send(err('invalid-move', r.error));

    const newLog = [...log, edgeId];
    await this.storage.put('log', newLog);
    this.cached = { length: newLog.length, state: r.state };
    this.broadcast({ type: 'move-applied', seq, edgeId, seat: session.seat });
  }

  private async handleResync(client: Client, from: number): Promise<void> {
    const log = await this.getLog();
    client.send({ type: 'moves', from, edgeIds: log.slice(from) });
  }

  private broadcast(msg: ServerMessage, except?: Client): void {
    for (const c of this.clients()) {
      if (c !== except) c.send(msg);
    }
  }

  private async roomPlayers(): Promise<RoomPlayer[]> {
    const players = (await this.storage.get<StoredPlayer[]>('players')) ?? [];
    const connectedTokens = new Set(
      this.clients()
        .map((c) => c.getSession()?.token)
        .filter((t): t is string => t !== undefined),
    );
    return players.map((p) => ({
      seat: p.seat,
      name: p.name,
      connected: connectedTokens.has(p.token),
    }));
  }

  private async state(config: GameConfig, log: number[]): Promise<GameState> {
    if (this.cached?.length === log.length) return this.cached.state;
    const state = log.length === 0 ? newGame(config) : replay(config, log);
    this.cached = { length: log.length, state };
    return state;
  }

  private async getLog(): Promise<number[]> {
    return (await this.storage.get<number[]>('log')) ?? [];
  }

  private async mustGetConfig(): Promise<GameConfig> {
    const config = await this.storage.get<GameConfig>('config');
    if (!config) throw new Error('room not initialized');
    return config;
  }
}

function err(code: Extract<ServerMessage, { type: 'error' }>['code'], message: string): ServerMessage {
  return { type: 'error', code, message };
}
