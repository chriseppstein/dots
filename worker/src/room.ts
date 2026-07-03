/**
 * GameRoom Durable Object — a thin adapter binding RoomLogic to the
 * Workers runtime. Uses the WebSocket hibernation API: sessions live in
 * socket attachments and game state lives in storage (as a move log), so
 * the room survives eviction and hibernation with zero special handling.
 */

import { RoomLogic, type Client, type Session } from './room-logic.ts';
import { parseClientMessage, type ServerMessage } from '../../src/protocol/messages.ts';
import type { GameConfig } from '../../src/engine/game.ts';

/** Rooms idle this long are deleted (storage wiped). */
const ROOM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function wrap(ws: WebSocket): Client {
  return {
    send(msg: ServerMessage) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        // socket already closing; the close handler will announce it
      }
    },
    getSession(): Session | null {
      return (ws.deserializeAttachment() as Session | null) ?? null;
    },
    setSession(session: Session) {
      ws.serializeAttachment(session);
    },
    close(code?: number, reason?: string) {
      ws.close(code, reason);
    },
  };
}

export class GameRoom {
  private readonly logic: RoomLogic;

  constructor(
    private readonly ctx: DurableObjectState,
    _env: unknown,
  ) {
    this.logic = new RoomLogic(this.ctx.storage, () => this.ctx.getWebSockets().map(wrap));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/init') {
      const config = (await request.json()) as GameConfig;
      await this.logic.init(config);
      await this.touch();
      return Response.json({ ok: true });
    }

    if (request.method === 'GET' && url.pathname === '/info') {
      if (!(await this.logic.isInitialized())) {
        return Response.json({ error: 'room not found' }, { status: 404 });
      }
      return Response.json(await this.logic.info());
    }

    if (request.method === 'GET' && url.pathname === '/ws') {
      if (!(await this.logic.isInitialized())) {
        return Response.json({ error: 'room not found' }, { status: 404 });
      }
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      await this.touch();
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return new Response('not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const msg = parseClientMessage(message);
    if (!msg) {
      wrap(ws).send({ type: 'error', code: 'bad-message', message: 'unrecognized message' });
      return;
    }
    await this.logic.handleMessage(wrap(ws), msg);
    await this.touch();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.logic.handleClose(wrap(ws));
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.logic.handleClose(wrap(ws));
  }

  /** Idle-room garbage collection. */
  async alarm(): Promise<void> {
    if (this.ctx.getWebSockets().length > 0) {
      await this.touch(); // still in use — postpone
      return;
    }
    await this.ctx.storage.deleteAll();
  }

  private async touch(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }
}
