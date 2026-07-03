/**
 * WebSocket client for the dots-3d-api worker. Reconnects with backoff
 * using the durable player token (kept in localStorage), so a dropped
 * connection or reloaded tab recovers its seat and the full move log.
 */

import type { RoomInfo, ServerMessage } from '../protocol/messages.ts';
import type { GridSize } from '../engine/lattice.ts';

/** Base URL of the worker (no trailing slash), e.g. https://api.dots-3d.com */
export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  return (configured ?? 'http://localhost:8787').replace(/\/$/, '');
}

export async function createRoom(gridSize: GridSize): Promise<string> {
  const res = await fetch(`${apiBaseUrl()}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gridSize }),
  });
  if (!res.ok) throw new Error(`room creation failed (${res.status})`);
  const { roomId } = (await res.json()) as { roomId: string };
  return roomId;
}

export async function getRoomInfo(roomId: string): Promise<RoomInfo | null> {
  const res = await fetch(`${apiBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`room lookup failed (${res.status})`);
  return (await res.json()) as RoomInfo;
}

const TOKEN_KEY = 'dots3d-player-token';

/** Durable player identity — survives reloads; one token per browser. */
export function playerToken(): string {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

const ROOMS_KEY = 'dots3d-rooms';

/** Remember rooms this browser has a seat in, so links auto-rejoin. */
export function rememberRoom(roomId: string, name: string): void {
  const rooms = knownRooms();
  rooms[roomId] = name;
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

export function recallRoomName(roomId: string): string | null {
  return knownRooms()[roomId] ?? null;
}

function knownRooms(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ROOMS_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export interface NetClientOptions {
  roomId: string;
  token: string;
  name: string;
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
}

export class NetClient {
  private ws: WebSocket | null = null;
  private disposed = false;
  private retryDelay = 500;
  private retryHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: NetClientOptions) {}

  connect(): void {
    if (this.disposed) return;
    this.opts.onStatus('connecting');
    const wsBase = apiBaseUrl().replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/api/rooms/${encodeURIComponent(this.opts.roomId)}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      this.retryDelay = 500;
      this.opts.onStatus('open');
      this.send({ type: 'join', token: this.opts.token, name: this.opts.name });
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as ServerMessage;
      } catch {
        return;
      }
      this.opts.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.opts.onStatus('closed');
      this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  sendMove(seq: number, edgeId: number): void {
    this.send({ type: 'move', seq, edgeId });
  }

  resync(from: number): void {
    this.send({ type: 'resync', from });
  }

  dispose(): void {
    this.disposed = true;
    if (this.retryHandle) clearTimeout(this.retryHandle);
    this.ws?.close();
    this.ws = null;
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    this.retryHandle = setTimeout(() => this.connect(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 10_000);
  }
}
