import { GameEngine } from '../core/GameEngine';
import { GridSize, Point3D } from '../core/types';

interface Player {
  id: string;
  name: string;
  websocket?: WebSocket;
}

interface StoredRoom {
  id: string;
  players: Player[];
  gridSize: GridSize;
  started: boolean;
  gameState?: any;
}

export class GameRoom implements DurableObject {
  private state: DurableObjectState;
  private room: StoredRoom | null = null;
  private gameEngine: GameEngine | null = null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle API requests
    if (request.method === 'GET' && url.pathname === '/api/room-info') {
      return this.getRoomInfo(url.searchParams.get('roomId') || '');
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const roomId = url.searchParams.get('room') || 'default';

    // Load room state if not loaded
    if (!this.room) {
      const stored = await this.state.storage.get<StoredRoom>('room');
      if (stored) {
        this.room = stored;
        if (this.room.gameState) {
          this.gameEngine = new GameEngine(this.room.gridSize, 'online');
          // Restore game state would go here
        }
      } else {
        // Create new room
        this.room = {
          id: roomId,
          players: [],
          gridSize: { width: 3, height: 3, depth: 3 },
          started: false
        };
      }
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Set up event handlers
    server.addEventListener('message', (event) => {
      this.handleMessage(server, event.data);
    });

    server.addEventListener('close', () => {
      this.handleDisconnect(server);
    });

    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleMessage(websocket: WebSocket, data: string | ArrayBuffer) {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'create-room':
          await this.createRoom(websocket, message.data);
          break;
        case 'join-room':
          await this.joinRoom(websocket, message.data);
          break;
        case 'make-move':
          await this.makeMove(websocket, message.data);
          break;
        case 'get-room-info':
          await this.sendRoomInfo(websocket, message.data.roomId);
          break;
        default:
          console.error('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      websocket.send(JSON.stringify({ type: 'error', data: 'Invalid message format' }));
    }
  }

  private async createRoom(websocket: WebSocket, data: { playerName: string, gridSize: GridSize }) {
    if (!this.room) return;

    const playerId = this.generatePlayerId();
    const player: Player = {
      id: playerId,
      name: data.playerName,
      websocket
    };

    this.room.players = [player];
    this.room.gridSize = data.gridSize;

    await this.saveRoom();

    websocket.send(JSON.stringify({
      type: 'room-created',
      data: { roomId: this.room.id, playerId }
    }));
  }

  private async joinRoom(websocket: WebSocket, data: { roomId: string, playerName: string }) {
    if (!this.room || this.room.players.length >= 2) {
      websocket.send(JSON.stringify({ type: 'error', data: 'Room is full or not found' }));
      return;
    }

    const playerId = this.generatePlayerId();
    const player: Player = {
      id: playerId,
      name: data.playerName,
      websocket
    };

    this.room.players.push(player);

    // Send confirmation to joining player
    websocket.send(JSON.stringify({
      type: 'room-joined',
      data: {
        roomId: this.room.id,
        playerId,
        gameState: null,
        player1Name: this.room.players[0]?.name || 'Player 1'
      }
    }));

    if (this.room.players.length === 2 && !this.room.started) {
      // Start the game
      this.gameEngine = new GameEngine(this.room.gridSize, 'online');
      this.room.started = true;

      const gameState = this.gameEngine.getState();

      // Update player names
      gameState.players[0].name = this.room.players[0].name;
      gameState.players[1].name = this.room.players[1].name;

      // Create state for clients
      const stateForClients = JSON.parse(JSON.stringify(gameState));
      stateForClients.players[0].id = this.room.players[0].id;
      stateForClients.players[1].id = this.room.players[1].id;
      stateForClients.currentPlayer = { ...gameState.currentPlayer, id: this.room.players[0].id };

      this.room.gameState = gameState;
      await this.saveRoom();

      // Broadcast game start to both players
      this.broadcastToRoom({
        type: 'game-started',
        data: stateForClients
      });
    } else {
      await this.saveRoom();
    }
  }

  private async makeMove(websocket: WebSocket, data: { roomId: string, playerId: string, start: Point3D, end: Point3D }) {
    if (!this.room || !this.gameEngine) {
      websocket.send(JSON.stringify({ type: 'error', data: 'Game not found' }));
      return;
    }

    const playerIndex = this.room.players.findIndex(p => p.websocket === websocket);
    if (playerIndex === -1) {
      websocket.send(JSON.stringify({ type: 'error', data: 'Player not in room' }));
      return;
    }

    const gamePlayerId = playerIndex === 0 ? 'player1' : 'player2';
    const gameState = this.gameEngine.getState();

    // Check if it's this player's turn
    if (gameState.currentPlayer.id !== gamePlayerId) {
      websocket.send(JSON.stringify({ type: 'error', data: 'Not your turn' }));
      return;
    }

    const success = this.gameEngine.makeMove(data.start, data.end);

    if (success) {
      const updatedState = this.gameEngine.getState();

      // Create state for clients
      const stateForClients = JSON.parse(JSON.stringify(updatedState));
      stateForClients.players[0].id = this.room.players[0].id;
      stateForClients.players[1].id = this.room.players[1].id;

      // Map current player to client ID
      stateForClients.currentPlayer = updatedState.currentPlayer.id === 'player1'
        ? { ...updatedState.currentPlayer, id: this.room.players[0].id }
        : { ...updatedState.currentPlayer, id: this.room.players[1].id };

      // Map lastMove player if exists
      if (updatedState.lastMove?.player) {
        const lastMovePlayerClientId = updatedState.lastMove.player.id === 'player1'
          ? this.room.players[0].id
          : this.room.players[1].id;
        stateForClients.lastMove.player = {
          ...updatedState.lastMove.player,
          id: lastMovePlayerClientId
        };
      }

      this.room.gameState = updatedState;
      await this.saveRoom();

      this.broadcastToRoom({
        type: 'game-state-update',
        data: stateForClients
      });

      if (updatedState.winner) {
        // Game ended, clean up room
        await this.state.storage.delete('room');
      }
    } else {
      websocket.send(JSON.stringify({ type: 'error', data: 'Invalid move' }));
    }
  }

  private async sendRoomInfo(websocket: WebSocket, roomId: string) {
    if (!this.room) {
      websocket.send(JSON.stringify({ type: 'room-info-error', data: 'Room not found' }));
      return;
    }

    if (this.room.players.length >= 2) {
      websocket.send(JSON.stringify({ type: 'room-info-error', data: 'Room is full' }));
      return;
    }

    websocket.send(JSON.stringify({
      type: 'room-info',
      data: {
        roomId,
        player1Name: this.room.players[0]?.name || 'Player 1',
        gridSize: this.room.gridSize,
        playersCount: this.room.players.length
      }
    }));
  }

  private async getRoomInfo(roomId: string): Promise<Response> {
    if (!this.room) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (this.room.players.length >= 2) {
      return new Response(JSON.stringify({ error: 'Room is full' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      roomId,
      player1Name: this.room.players[0]?.name || 'Player 1',
      gridSize: this.room.gridSize,
      playersCount: this.room.players.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleDisconnect(websocket: WebSocket) {
    if (!this.room) return;

    const playerIndex = this.room.players.findIndex(p => p.websocket === websocket);
    if (playerIndex !== -1) {
      this.room.players.splice(playerIndex, 1);

      if (this.room.players.length === 0) {
        // Delete empty room
        await this.state.storage.delete('room');
        this.room = null;
        this.gameEngine = null;
      } else {
        await this.saveRoom();
        // Notify remaining player
        this.broadcastToRoom({
          type: 'player-left',
          data: { playerId: this.generatePlayerId() }
        });
      }
    }
  }

  private broadcastToRoom(message: { type: string, data: any }) {
    if (!this.room) return;

    this.room.players.forEach(player => {
      if (player.websocket) {
        try {
          player.websocket.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error sending message to player:', error);
        }
      }
    });
  }

  private generatePlayerId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private async saveRoom() {
    if (this.room) {
      // Don't store websocket objects
      const roomToStore = {
        ...this.room,
        players: this.room.players.map(p => ({ id: p.id, name: p.name }))
      };
      await this.state.storage.put('room', roomToStore);
    }
  }
}