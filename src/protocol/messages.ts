/**
 * Wire protocol shared verbatim by the browser client and the Cloudflare
 * worker. Identity is a durable player token (random, kept in the client's
 * localStorage) mapped to a seat index — never a socket id, and never a
 * player object. The move log index (`seq`) versions all game state:
 * a client whose seq disagrees with the server's requests a resync.
 *
 * Per the project rule, nothing here describes presentation: seats are
 * numbers and clients map them to names/colors locally.
 */

import type { GameConfig, Seat } from '../engine/game.ts';

export interface RoomPlayer {
  seat: Seat;
  name: string;
  connected: boolean;
}

export interface RoomInfo {
  config: GameConfig;
  players: RoomPlayer[];
  /** Number of moves played — the state version. */
  seq: number;
  finished: boolean;
}

export type ClientMessage =
  | { type: 'join'; token: string; name: string }
  | { type: 'move'; seq: number; edgeId: number }
  | { type: 'resync'; from: number }
  | { type: 'ping' };

export type ServerMessage =
  | {
      type: 'joined';
      /** null = the room was full; the connection is a spectator. */
      seat: Seat | null;
      config: GameConfig;
      players: RoomPlayer[];
      /** Full move log — folding it reproduces exact state. */
      moves: number[];
    }
  | { type: 'player-joined'; player: RoomPlayer }
  | { type: 'player-connection'; seat: Seat; connected: boolean }
  | { type: 'move-applied'; seq: number; edgeId: number; seat: Seat }
  | { type: 'moves'; from: number; edgeIds: number[] }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'pong' };

export type ErrorCode =
  | 'bad-message'
  | 'not-joined'
  | 'not-started'
  | 'not-your-turn'
  | 'invalid-move'
  | 'bad-seq'
  | 'spectator';

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string') return null;
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof msg !== 'object' || msg === null) return null;
  const m = msg as Record<string, unknown>;
  switch (m.type) {
    case 'join':
      return typeof m.token === 'string' && m.token.length >= 8 && typeof m.name === 'string'
        ? { type: 'join', token: m.token, name: sanitizeName(m.name) }
        : null;
    case 'move':
      return typeof m.seq === 'number' && typeof m.edgeId === 'number'
        ? { type: 'move', seq: m.seq, edgeId: m.edgeId }
        : null;
    case 'resync':
      return typeof m.from === 'number' && m.from >= 0 ? { type: 'resync', from: m.from } : null;
    case 'ping':
      return { type: 'ping' };
    default:
      return null;
  }
}

export function sanitizeName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : 'Player';
}
