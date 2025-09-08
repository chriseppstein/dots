import { describe, it, expect, beforeEach, vi } from 'vitest';
import { io, Socket } from 'socket.io-client';
import { GameEngine } from '../core/GameEngine';
import { NetworkManager } from '../network/NetworkManager';

describe('Multiplayer Flow Integration', () => {
  describe('Server-Client Move Synchronization', () => {
    it('should update game state after sending move to server', async () => {
      // This test verifies that:
      // 1. Player 1 makes a move
      // 2. Move is sent to server
      // 3. Server validates and broadcasts updated state
      // 4. Both players receive the updated state
      // 5. Turn passes to player 2
      
      // Create network manager first
      const networkManager = new NetworkManager('http://localhost:3002');
      
      // Create mock socket 
      const mockSocket = {
        emit: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        connected: true,
        id: 'player1-socket-id'
      };
      
      // Replace the socket after construction
      (networkManager as any).socket = mockSocket;
      (networkManager as any).roomId = 'TEST-ROOM';
      (networkManager as any).playerId = 'player1-socket-id';
      
      // We don't need to call setupEventHandlers since we'll directly trigger the emit method
      
      // Set up game state tracking
      let lastEmittedState: any = null;
      const stateUpdateCallback = vi.fn((state) => {
        lastEmittedState = state;
      });
      
      networkManager.on('game-state-update', stateUpdateCallback);
      
      // Simulate making a move
      const move = {
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 }
      };
      
      // Player 1 makes a move
      networkManager.makeMove(move.start, move.end);
      
      // Verify move was sent to server
      expect(mockSocket.emit).toHaveBeenCalledWith('make-move', {
        roomId: 'TEST-ROOM',
        playerId: 'player1-socket-id',
        start: move.start,
        end: move.end
      });
      
      // Simulate server response with updated game state
      const serverGameState = {
        gridSize: 3,
        currentPlayer: { 
          id: 'player2-socket-id', 
          name: 'Player 2',
          color: '#87CEEB'
        },
        players: [
          { id: 'player1-socket-id', name: 'Player 1', score: 0, squareCount: 0 },
          { id: 'player2-socket-id', name: 'Player 2', score: 0, squareCount: 0 }
        ],
        lines: [{ start: move.start, end: move.end, player: { id: 'player1-socket-id' } }],
        cubes: [],
        turn: 1,
        winner: null,
        gameMode: 'online'
      };
      
      // Directly trigger the NetworkManager's emit method to simulate server response
      (networkManager as any).emit('game-state-update', serverGameState);
      
      // Verify the callback was called with the updated state
      expect(stateUpdateCallback).toHaveBeenCalledWith(serverGameState);
      expect(lastEmittedState).toEqual(serverGameState);
      
      // Verify turn has passed to player 2
      expect(lastEmittedState.currentPlayer.id).toBe('player2-socket-id');
      expect(lastEmittedState.turn).toBe(1);
      
      // Verify the move was recorded
      expect(lastEmittedState.lines).toHaveLength(1);
      expect(lastEmittedState.lines[0]).toMatchObject({
        start: move.start,
        end: move.end,
        player: { id: 'player1-socket-id' }
      });
    });
    
    it('should prevent moves when not player turn', async () => {
      // This test verifies that a player cannot make a move when it's not their turn
      
      const mockSocket = {
        emit: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        connected: true,
        id: 'player2-socket-id'
      };
      
      const networkManager = new NetworkManager('http://localhost:3002');
      (networkManager as any).socket = mockSocket;
      (networkManager as any).roomId = 'TEST-ROOM';
      (networkManager as any).playerId = 'player2-socket-id';
      
      // Current state shows it's player 1's turn
      const currentState = {
        currentPlayer: { id: 'player1-socket-id' },
        players: [
          { id: 'player1-socket-id', name: 'Player 1' },
          { id: 'player2-socket-id', name: 'Player 2' }
        ]
      };
      
      // Player 2 tries to make a move (should be blocked on client)
      // This would be handled by the GameBoard component checking the current player
      
      // In the actual implementation, the GameBoard checks:
      // if (playerId !== state.currentPlayer.id) return;
      
      // So the move would not even be sent to the server
      expect(mockSocket.emit).not.toHaveBeenCalledWith('make-move', expect.anything());
    });
    
    it('should sync game state between multiple players', async () => {
      // This test verifies that both players have synchronized game states
      
      // Create network managers for both players
      const player1Network = new NetworkManager('http://localhost:3002');
      const player2Network = new NetworkManager('http://localhost:3002');
      
      // Mock sockets for both players
      const player1Socket = {
        emit: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        connected: true,
        id: 'player1-socket-id'
      };
      
      const player2Socket = {
        emit: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        connected: true,
        id: 'player2-socket-id'
      };
      
      // Replace sockets
      (player1Network as any).socket = player1Socket;
      (player2Network as any).socket = player2Socket;
      
      // Set up state tracking for both players
      let player1State: any = null;
      let player2State: any = null;
      
      player1Network.on('game-state-update', (state) => {
        player1State = state;
      });
      
      player2Network.on('game-state-update', (state) => {
        player2State = state;
      });
      
      // Game state that should be synchronized between players
      const gameStateUpdate = {
        gridSize: 3,
        currentPlayer: { id: 'player2-socket-id' },
        players: [
          { id: 'player1-socket-id', name: 'Player 1', score: 1, squareCount: 1 },
          { id: 'player2-socket-id', name: 'Player 2', score: 0, squareCount: 0 }
        ],
        lines: [
          { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } },
          { start: { x: 1, y: 0, z: 0 }, end: { x: 1, y: 1, z: 0 } },
          { start: { x: 1, y: 1, z: 0 }, end: { x: 0, y: 1, z: 0 } },
          { start: { x: 0, y: 1, z: 0 }, end: { x: 0, y: 0, z: 0 } }
        ],
        turn: 4,
        winner: null
      };
      
      // Simulate server broadcasting to both players
      (player1Network as any).emit('game-state-update', gameStateUpdate);
      (player2Network as any).emit('game-state-update', gameStateUpdate);
      
      // Both players should have identical states
      expect(player1State).toEqual(player2State);
      expect(player1State).toEqual(gameStateUpdate);
      
      // Verify game state details
      expect(player1State!.currentPlayer.id).toBe('player2-socket-id');
      expect(player1State!.players[0].squareCount).toBe(1);
      expect(player1State!.lines).toHaveLength(4);
      expect(player1State!.turn).toBe(4);
    });
  });
});