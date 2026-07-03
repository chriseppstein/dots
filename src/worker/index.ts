export { GameRoom } from './gameroom';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Serve static assets
    if (url.pathname.startsWith('/assets/') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.ico') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.svg')) {
      return env.ASSETS.fetch(request);
    }

    // WebSocket upgrade for game connections
    if (request.headers.get('upgrade') === 'websocket') {
      return handleWebSocket(request, env);
    }

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    // Serve index.html for all other routes (SPA routing)
    const indexRequest = new Request(new URL('/', request.url), request);
    return env.ASSETS.fetch(indexRequest);
  }
};

async function handleWebSocket(request: Request, env: Env): Promise<Response> {
  const upgradeHeader = request.headers.get('upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected websocket', { status: 400 });
  }

  const url = new URL(request.url);
  const roomId = url.searchParams.get('room') || 'default';

  // Get Durable Object instance for this room
  const id = env.GAME_ROOMS.idFromName(roomId);
  const room = env.GAME_ROOMS.get(id);

  return room.fetch(request);
}

async function handleAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');

  if (path === '/room-info' && request.method === 'GET') {
    const roomId = url.searchParams.get('roomId');
    if (!roomId) {
      return new Response(JSON.stringify({ error: 'Room ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = env.GAME_ROOMS.idFromName(roomId);
    const room = env.GAME_ROOMS.get(id);

    return room.fetch(new Request(url.toString(), { method: 'GET' }));
  }

  return new Response('Not found', { status: 404 });
}

interface Env {
  ASSETS: Fetcher;
  GAME_ROOMS: DurableObjectNamespace;
  ENVIRONMENT: string;
}