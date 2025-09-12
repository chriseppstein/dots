import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameController } from '../core/GameController';
import { NetworkManager } from '../network/NetworkManager';
import { PlayerIdentityService } from '../core/PlayerIdentityService';

describe('Player Identity in Multiplayer', () => {
  let controller: GameController;
  let networkManager: NetworkManager;
  
  beforeEach(() => {
    // Create a mock NetworkManager
    networkManager = {
      getPlayerId: vi.fn().mockReturnValue('socket-123'),
      makeMove: vi.fn(),
      on: vi.fn(),
      emit: vi.fn()
    } as any;
  });
  
  describe('ID Mapping Integration', () => {
    it('should properly map IDs when syncing with server state', () => {
      controller = new GameController(3, 'online', 'Alice', 'Bob', networkManager);
      
      const serverState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0 },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0 }
        ],
        currentPlayer: { id: 'socket-123' },
        lines: [],
        cubes: [],
        turn: 0,
        winner: null,
        gameMode: 'online'
      };
      
      controller.syncEngineWithServerState(serverState);
      
      // Get the identity service
      const identityService = controller.getPlayerIdentityService();
      
      // Verify mappings were created
      expect(identityService.getNetworkId('player1')).toBe('socket-123');
      expect(identityService.getNetworkId('player2')).toBe('socket-456');
      expect(identityService.getEngineId('socket-123')).toBe('player1');
      expect(identityService.getEngineId('socket-456')).toBe('player2');
      
      // Verify player names were stored
      expect(identityService.getPlayerName('player1')).toBe('Alice');
      expect(identityService.getPlayerName('player2')).toBe('Bob');
    });
    
    it('should return state with network IDs for online games', () => {
      controller = new GameController(3, 'online', 'Alice', 'Bob', networkManager);
      
      const serverState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0 },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0 }
        ],
        currentPlayer: { id: 'socket-123' },
        lines: [],
        cubes: [],
        turn: 0,
        winner: null,
        gameMode: 'online'
      };
      
      controller.syncEngineWithServerState(serverState);
      
      // Get state should return network IDs
      const state = controller.getState();
      
      expect(state.players[0].id).toBe('socket-123');
      expect(state.players[1].id).toBe('socket-456');
      expect(state.currentPlayer.id).toBe('socket-123');
    });
    
    it('should handle move validation with proper ID comparison', () => {
      controller = new GameController(3, 'online', 'Alice', 'Bob', networkManager);
      
      const serverState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0 },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0 }
        ],
        currentPlayer: { id: 'socket-123' },
        lines: [],
        cubes: [],
        turn: 0,
        winner: null,
        gameMode: 'online'
      };
      
      controller.syncEngineWithServerState(serverState);
      
      // Player 1 (socket-123) should be able to move
      const moveSuccess = controller.handleMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      expect(moveSuccess).toBe(true);
      expect(networkManager.makeMove).toHaveBeenCalledWith(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 }
      );
    });
    
    it('should prevent moves from wrong player', () => {
      controller = new GameController(3, 'online', 'Alice', 'Bob', networkManager);
      
      const serverState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0 },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0 }
        ],
        currentPlayer: { id: 'socket-456' }, // Bob's turn
        lines: [],
        cubes: [],
        turn: 0,
        winner: null,
        gameMode: 'online'
      };
      
      controller.syncEngineWithServerState(serverState);
      
      // Player 1 (socket-123) should NOT be able to move when it's Player 2's turn
      const moveSuccess = controller.handleMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      expect(moveSuccess).toBe(false);
      expect(networkManager.makeMove).not.toHaveBeenCalled();
    });
    
    it('should handle reconnection with new socket ID', () => {
      controller = new GameController(3, 'online', 'Alice', 'Bob', networkManager);
      
      // Initial connection
      const initialState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0 },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0 }
        ],
        currentPlayer: { id: 'socket-123' },
        lines: [],
        cubes: [],
        turn: 0,
        winner: null,
        gameMode: 'online'
      };
      
      controller.syncEngineWithServerState(initialState);
      
      // Simulate reconnection with new socket ID for Alice
      const reconnectState = {
        players: [
          { id: 'socket-789', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0 }, // New socket ID
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0 }
        ],
        currentPlayer: { id: 'socket-789' },
        lines: [],
        cubes: [],
        turn: 1,
        winner: null,
        gameMode: 'online'
      };
      
      controller.syncEngineWithServerState(reconnectState);
      
      const identityService = controller.getPlayerIdentityService();
      
      // Old socket ID should no longer map
      expect(identityService.getEngineId('socket-123')).toBeUndefined();
      
      // New socket ID should map correctly
      expect(identityService.getNetworkId('player1')).toBe('socket-789');
      expect(identityService.getEngineId('socket-789')).toBe('player1');
    });
    
    it('should handle lastMove with proper player ID mapping', () => {
      controller = new GameController(3, 'online', 'Alice', 'Bob', networkManager);
      
      const serverState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0 },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0 }
        ],
        currentPlayer: { id: 'socket-456' },
        lines: [
          {
            start: { x: 0, y: 0, z: 0 },
            end: { x: 1, y: 0, z: 0 },
            player: { id: 'socket-123', name: 'Alice', color: '#FF0000' }
          }
        ],
        lastMove: {
          start: { x: 0, y: 0, z: 0 },
          end: { x: 1, y: 0, z: 0 },
          player: { id: 'socket-123', name: 'Alice', color: '#FF0000' }
        },
        cubes: [],
        turn: 1,
        winner: null,
        gameMode: 'online'
      };
      
      controller.syncEngineWithServerState(serverState);
      
      // Get state with mapped IDs
      const state = controller.getState();
      
      // lastMove should have network ID
      expect(state.lastMove).toBeDefined();
      expect(state.lastMove!.player.id).toBe('socket-123');
    });
  });
  
  describe('Identity Service Cleanup', () => {
    it('should clear identity mappings on dispose', () => {
      controller = new GameController(3, 'online', 'Alice', 'Bob', networkManager);
      
      const serverState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0 },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0 }
        ],
        currentPlayer: { id: 'socket-123' },
        lines: [],
        cubes: [],
        turn: 0,
        winner: null,
        gameMode: 'online'
      };
      
      controller.syncEngineWithServerState(serverState);
      
      const identityService = controller.getPlayerIdentityService();
      expect(identityService.hasMappings()).toBe(true);
      
      // Dispose controller
      controller.dispose();
      
      // Mappings should be cleared
      expect(identityService.hasMappings()).toBe(false);
    });
  });
});