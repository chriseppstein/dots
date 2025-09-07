import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../core/GameEngine';
import { Point3D, GameState } from '../core/types';

// Mock EventEmitter for socket simulation
class MockEventEmitter {
  private handlers: Map<string, Set<Function>> = new Map();

  on(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  once(event: string, handler: Function) {
    const wrapper = (...args: any[]) => {
      handler(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  off(event: string, handler?: Function) {
    if (!handler) {
      this.handlers.delete(event);
    } else {
      this.handlers.get(event)?.delete(handler);
    }
  }

  emit(event: string, ...args: any[]) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }
}

// Mock Socket for client
class MockSocket extends MockEventEmitter {
  id: string;
  connected: boolean = false;
  server?: MockServer;

  constructor(id: string) {
    super();
    this.id = id;
  }

  connect() {
    this.connected = true;
    this.emit('connect');
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnect');
  }

  emit(event: string, ...args: any[]): void {
    // Only forward specific client-to-server events
    const clientToServerEvents = ['create-room', 'join-room', 'make-move', 'get-rooms', 'get-room-info'];
    if (this.server && clientToServerEvents.includes(event)) {
      // Simulate network delay
      setTimeout(() => {
        this.server?.handleClientMessage(this, event, args[0]);
      }, 0);
    }
    // Also emit locally for client handlers
    super.emit(event, ...args);
  }
}

// Mock Server
class MockServer {
  private rooms: Map<string, any> = new Map();
  private clients: Map<string, MockSocket> = new Map();
  private roomIdCounter = 0;

  connectClient(socket: MockSocket) {
    socket.server = this;
    this.clients.set(socket.id, socket);
    socket.connect();
  }

  handleClientMessage(socket: MockSocket, event: string, data: any) {
    console.log(`Server received ${event} from ${socket.id}:`, data);

    switch (event) {
      case 'create-room':
        this.handleCreateRoom(socket, data);
        break;
      case 'join-room':
        this.handleJoinRoom(socket, data);
        break;
      case 'make-move':
        this.handleMakeMove(socket, data);
        break;
    }
  }

  private handleCreateRoom(socket: MockSocket, data: { playerName: string, gridSize: number }) {
    const roomId = `ROOM${++this.roomIdCounter}`;
    const room = {
      id: roomId,
      players: new Map([[socket.id, { 
        id: socket.id, 
        name: data.playerName, 
        socketId: socket.id 
      }]]),
      gameEngine: null,
      gridSize: data.gridSize,
      started: false
    };
    
    this.rooms.set(roomId, room);
    
    // Send response to creator
    socket.emit('room-created', { roomId, playerId: socket.id });
    console.log(`Room ${roomId} created by ${data.playerName}`);
  }

  private handleJoinRoom(socket: MockSocket, data: { roomId: string, playerName: string }) {
    const room = this.rooms.get(data.roomId);
    
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    if (room.players.size >= 2) {
      socket.emit('error', 'Room is full');
      return;
    }
    
    room.players.set(socket.id, { 
      id: socket.id, 
      name: data.playerName, 
      socketId: socket.id 
    });
    
    if (room.players.size === 2 && !room.started) {
      room.gameEngine = new GameEngine(room.gridSize, 'online');
      room.started = true;
      
      const players = Array.from(room.players.values());
      const gameState = room.gameEngine.getState();
      
      // Update player names in the engine
      gameState.players[0].name = players[0].name;
      gameState.players[1].name = players[1].name;
      
      // Create state for clients with socket IDs for UI identification
      const stateForClients = JSON.parse(JSON.stringify(gameState));
      stateForClients.players[0].id = players[0].id;
      stateForClients.players[1].id = players[1].id;
      // Current player uses socket ID for client-side turn validation
      stateForClients.currentPlayer = { ...gameState.currentPlayer, id: players[0].id };
      
      // Emit to both players
      this.emitToRoom(data.roomId, 'game-started', stateForClients);
      console.log(`Game started in room ${data.roomId}`);
    }
  }

  private handleMakeMove(socket: MockSocket, data: { roomId: string, playerId: string, start: Point3D, end: Point3D }) {
    console.log(`Move received from ${socket.id} in room ${data.roomId}:`, { start: data.start, end: data.end });
    const room = this.rooms.get(data.roomId);
    
    if (!room || !room.gameEngine) {
      console.log('Error: Game not found');
      socket.emit('error', 'Game not found');
      return;
    }
    
    const gameState = room.gameEngine.getState();
    const players = Array.from(room.players.values());
    const playerIndex = players.findIndex(p => p.socketId === socket.id);
    
    if (playerIndex === -1) {
      console.log('Error: Player not in room');
      socket.emit('error', 'Player not in room');
      return;
    }
    
    // The game engine uses 'player1' and 'player2' internally
    const gamePlayerId = playerIndex === 0 ? 'player1' : 'player2';
    
    console.log(`Player ${gamePlayerId} (socket: ${socket.id}) attempting move. Current player in engine: ${gameState.currentPlayer.id}`);
    
    // Check if it's this player's turn (compare game engine IDs)
    if (gameState.currentPlayer.id !== gamePlayerId) {
      console.log('Error: Not player turn');
      socket.emit('error', 'Not your turn');
      return;
    }
    
    const success = room.gameEngine.makeMove(data.start, data.end);
    console.log(`Move result: ${success ? 'success' : 'failed'}`);
    
    if (success) {
      const updatedState = room.gameEngine.getState();
      
      // Create state for clients with socket IDs for UI identification
      const stateForClients = JSON.parse(JSON.stringify(updatedState));
      stateForClients.players[0].id = players[0].id;
      stateForClients.players[1].id = players[1].id;
      // Map current player to socket ID
      stateForClients.currentPlayer = updatedState.currentPlayer.id === 'player1' 
        ? { ...updatedState.currentPlayer, id: players[0].id }
        : { ...updatedState.currentPlayer, id: players[1].id };
      
      console.log(`Broadcasting game-state-update to room ${data.roomId}. Turn: ${updatedState.turn}, Current player: ${stateForClients.currentPlayer.id}`);
      this.emitToRoom(data.roomId, 'game-state-update', stateForClients);
    } else {
      console.log('Error: Invalid move');
      socket.emit('error', 'Invalid move');
    }
  }

  private emitToRoom(roomId: string, event: string, data: any) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    room.players.forEach((player: any) => {
      const socket = this.clients.get(player.socketId);
      if (socket) {
        // Simulate network delay
        setTimeout(() => {
          socket.emit(event, data);
        }, 10);
      }
    });
  }

  getRoomState(roomId: string) {
    const room = this.rooms.get(roomId);
    return room?.gameEngine?.getState();
  }
}

// Mock NetworkManager that works with MockSocket
class MockNetworkManager {
  private socket: MockSocket;
  private roomId: string | null = null;
  private playerId: string | null = null;
  private callbacks: Map<string, Function> = new Map();

  constructor(socketId: string, server: MockServer) {
    this.socket = new MockSocket(socketId);
    server.connectClient(this.socket);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.socket.on('room-created', (data: { roomId: string, playerId: string }) => {
      this.roomId = data.roomId;
      this.playerId = data.playerId;
      this.emit('room-created', data);
    });

    this.socket.on('game-started', (gameState: GameState) => {
      this.emit('game-started', gameState);
    });

    this.socket.on('game-state-update', (gameState: GameState) => {
      this.emit('game-state-update', gameState);
    });

    this.socket.on('error', (error: string) => {
      console.error('Client received error:', error);
      this.emit('error', error);
    });
  }

  createRoom(playerName: string, gridSize: number) {
    this.socket.emit('create-room', { playerName, gridSize });
  }

  joinRoom(roomId: string, playerName: string) {
    this.roomId = roomId;
    this.playerId = this.socket.id;
    this.socket.emit('join-room', { roomId, playerName });
  }

  makeMove(start: Point3D, end: Point3D) {
    if (!this.roomId) return;
    
    this.socket.emit('make-move', {
      roomId: this.roomId,
      playerId: this.playerId,
      start,
      end
    });
  }

  on(event: string, callback: Function) {
    this.callbacks.set(event, callback);
  }

  off(event: string) {
    this.callbacks.delete(event);
  }

  private emit(event: string, data?: any) {
    const callback = this.callbacks.get(event);
    if (callback) {
      callback(data);
    }
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  getRoomId(): string | null {
    return this.roomId;
  }
}

describe('Multiplayer Integration Test', () => {
  let server: MockServer;
  let player1Network: MockNetworkManager;
  let player2Network: MockNetworkManager;
  let player1Engine: GameEngine;
  let player2Engine: GameEngine;
  let roomId: string;

  beforeEach(() => {
    server = new MockServer();
    player1Network = new MockNetworkManager('player1-socket', server);
    player2Network = new MockNetworkManager('player2-socket', server);
    player1Engine = new GameEngine(3, 'online');
    player2Engine = new GameEngine(3, 'online');
  });

  it('should synchronize game state between two players over multiple turns', { timeout: 10000 }, async () => {
    // Track game states
    let player1State: GameState | null = null;
    let player2State: GameState | null = null;
    
    // Player 1 creates room
    const roomCreated = new Promise<void>((resolve) => {
      player1Network.on('room-created', (data: { roomId: string }) => {
        roomId = data.roomId;
        console.log('Player 1 received room-created:', roomId);
        resolve();
      });
    });
    
    player1Network.createRoom('Player 1', 3);
    await roomCreated;
    
    // Set up game-started handlers for both players
    const player1GameStarted = new Promise<void>((resolve) => {
      player1Network.on('game-started', (gameState: GameState) => {
        console.log('Player 1 received game-started');
        player1State = gameState;
        // Sync player 1's engine
        const engineState = player1Engine.getState();
        Object.assign(engineState, gameState);
        resolve();
      });
    });
    
    const player2GameStarted = new Promise<void>((resolve) => {
      player2Network.on('game-started', (gameState: GameState) => {
        console.log('Player 2 received game-started');
        player2State = gameState;
        // Sync player 2's engine
        const engineState = player2Engine.getState();
        Object.assign(engineState, gameState);
        resolve();
      });
    });
    
    // Set up game-state-update handlers
    player1Network.on('game-state-update', (gameState: GameState) => {
      console.log('Player 1 received game-state-update with turn:', gameState.turn);
      player1State = gameState;
      const engineState = player1Engine.getState();
      Object.assign(engineState, gameState);
    });
    
    player2Network.on('game-state-update', (gameState: GameState) => {
      console.log('Player 2 received game-state-update with turn:', gameState.turn);
      player2State = gameState;
      const engineState = player2Engine.getState();
      Object.assign(engineState, gameState);
    });
    
    // Player 2 joins room
    player2Network.joinRoom(roomId, 'Player 2');
    
    // Wait for both players to receive game-started
    await Promise.all([player1GameStarted, player2GameStarted]);
    
    // Verify initial state
    expect(player1State).toBeTruthy();
    expect(player2State).toBeTruthy();
    expect(player1State!.players[0].id).toBe('player1-socket');
    expect(player1State!.players[1].id).toBe('player2-socket');
    expect(player1State!.currentPlayer.id).toBe('player1-socket');
    expect(player1State).toEqual(player2State);
    
    // Turn 1: Player 1 makes a move
    console.log('\n=== Turn 1: Player 1 moves ===');
    const move1 = { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } };
    
    player1Network.makeMove(move1.start, move1.end);
    
    // Wait for both players to receive the update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify after turn 1
    expect(player1State!.turn).toBe(1);
    expect(player2State!.turn).toBe(1);
    expect(player1State!.currentPlayer.id).toBe('player2-socket');
    expect(player2State!.currentPlayer.id).toBe('player2-socket');
    expect(player1State!.lines.length).toBe(1);
    expect(player2State!.lines.length).toBe(1);
    
    // Turn 2: Player 2 makes a move
    console.log('\n=== Turn 2: Player 2 moves ===');
    const move2 = { start: { x: 1, y: 0, z: 0 }, end: { x: 1, y: 1, z: 0 } };
    
    player2Network.makeMove(move2.start, move2.end);
    
    // Wait for both players to receive the update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify after turn 2
    expect(player1State!.turn).toBe(2);
    expect(player2State!.turn).toBe(2);
    expect(player1State!.currentPlayer.id).toBe('player1-socket');
    expect(player2State!.currentPlayer.id).toBe('player1-socket');
    expect(player1State!.lines.length).toBe(2);
    expect(player2State!.lines.length).toBe(2);
    
    // Turn 3: Player 1 makes another move
    console.log('\n=== Turn 3: Player 1 moves ===');
    const move3 = { start: { x: 1, y: 1, z: 0 }, end: { x: 0, y: 1, z: 0 } };
    
    player1Network.makeMove(move3.start, move3.end);
    
    // Wait for both players to receive the update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify after turn 3
    expect(player1State!.turn).toBe(3);
    expect(player2State!.turn).toBe(3);
    expect(player1State!.currentPlayer.id).toBe('player2-socket');
    expect(player2State!.currentPlayer.id).toBe('player2-socket');
    expect(player1State!.lines.length).toBe(3);
    expect(player2State!.lines.length).toBe(3);
    
    // Turn 4: Player 2 completes a square
    console.log('\n=== Turn 4: Player 2 completes square ===');
    const move4 = { start: { x: 0, y: 1, z: 0 }, end: { x: 0, y: 0, z: 0 } };
    
    player2Network.makeMove(move4.start, move4.end);
    
    // Wait for both players to receive the update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Final verification
    console.log('\n=== Final State Verification ===');
    expect(player1State!.turn).toBe(4);
    expect(player2State!.turn).toBe(4);
    expect(player1State!.lines.length).toBe(4);
    expect(player2State!.lines.length).toBe(4);
    
    // Player 2 should have scored and keep their turn
    expect(player1State!.players[1].squareCount).toBeGreaterThan(0);
    expect(player2State!.players[1].squareCount).toBeGreaterThan(0);
    expect(player1State!.currentPlayer.id).toBe('player2-socket'); // Player 2 keeps turn after scoring
    expect(player2State!.currentPlayer.id).toBe('player2-socket');
    
    // Verify states are identical
    expect(player1State).toEqual(player2State);
    
    // Verify server state matches
    const serverState = server.getRoomState(roomId);
    expect(serverState).toBeTruthy();
    expect(serverState!.turn).toBe(4);
    expect(serverState!.lines.length).toBe(4);
  });

  it('should prevent out-of-turn moves', async () => {
    // Set up the game
    const roomCreated = new Promise<void>((resolve) => {
      player1Network.on('room-created', (data: { roomId: string }) => {
        roomId = data.roomId;
        resolve();
      });
    });
    
    player1Network.createRoom('Player 1', 3);
    await roomCreated;
    
    const gameStarted = new Promise<void>((resolve) => {
      player2Network.on('game-started', () => resolve());
    });
    
    player2Network.joinRoom(roomId, 'Player 2');
    await gameStarted;
    
    // Player 2 tries to move when it's Player 1's turn
    let errorReceived = false;
    player2Network.on('error', (error: string) => {
      errorReceived = true;
      expect(error).toBe('Not your turn');
    });
    
    player2Network.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(errorReceived).toBe(true);
  });
});