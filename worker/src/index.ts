/**
 * dots-3d-api — the multiplayer backend, deployed separately from the
 * static site (which lives on Cloudflare Pages). Routes:
 *
 *   POST /api/rooms          create a room  → { roomId }
 *   GET  /api/rooms/:id      invite-screen info (players, grid, progress)
 *   GET  /api/rooms/:id/ws   WebSocket upgrade into the room
 *
 * Each room is one GameRoom Durable Object addressed by idFromName(roomId).
 */

export { GameRoom } from './room.ts';

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  /** Comma-separated allowed origins; unset = allow any (dev). */
  ALLOWED_ORIGINS?: string;
}

const GRID_SIZES = [3, 4, 5, 6];

// Unambiguous alphabet (no 0/O/1/I/L) — 30^8 ≈ 6.5e11 room ids.
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const ROOM_ID_LENGTH = 8;
const ROOM_ID_RE = new RegExp(`^[${ROOM_ALPHABET}]{${ROOM_ID_LENGTH}}$`);

function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_ID_LENGTH));
  return [...bytes].map((b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  if (!origin) return {};
  const allowed = env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim());
  if (allowed && !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return Response.json(data, { status, headers: cors });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/rooms(?:\/([A-Z0-9]+))?(\/ws)?$/i);
    if (!match) return json({ error: 'not found' }, 404, cors);
    const [, roomId, wsSuffix] = match;

    if (!roomId) {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);
      let gridSize: unknown;
      try {
        ({ gridSize } = (await request.json()) as { gridSize?: unknown });
      } catch {
        return json({ error: 'invalid JSON body' }, 400, cors);
      }
      if (typeof gridSize !== 'number' || !GRID_SIZES.includes(gridSize)) {
        return json({ error: `gridSize must be one of ${GRID_SIZES.join(', ')}` }, 400, cors);
      }
      const id = newRoomId();
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(id));
      await stub.fetch('https://room/init', {
        method: 'POST',
        body: JSON.stringify({ gridSize }),
      });
      return json({ roomId: id }, 201, cors);
    }

    const normalized = roomId.toUpperCase();
    if (!ROOM_ID_RE.test(normalized)) return json({ error: 'room not found' }, 404, cors);
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(normalized));

    if (wsSuffix) {
      // WebSocket upgrade — pass through untouched (101 responses carry the socket)
      return stub.fetch('https://room/ws', request);
    }

    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, cors);
    const info = await stub.fetch('https://room/info');
    const body = await info.json();
    return json(body, info.status, cors);
  },
};
