import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../core/GameEngine';
import { GameStateManager, StateChangeListener } from '../core/GameStateManager';

describe('GameStateManager', () => {
  let engine: GameEngine;
  let stateManager: GameStateManager;
  let mockListener: StateChangeListener;

  beforeEach(() => {
    engine = new GameEngine(3, 'local');
    stateManager = new GameStateManager(engine);
    mockListener = {
      onStateChange: vi.fn(),
      onMove: vi.fn(),
      onTurnChange: vi.fn(),
      onGameEnd: vi.fn(),
      onError: vi.fn()
    };
  });

  describe('Basic State Management', () => {
    it('should return current state from engine', () => {
      const state = stateManager.getState();
      
      expect(state).toBeDefined();
      expect(state.gridSize).toBe(3);
      expect(state.players).toHaveLength(2);
      expect(state.gameMode).toBe('local');
    });

    it('should provide immutable state copies', () => {
      const state1 = stateManager.getState();
      const state2 = stateManager.getState();
      
      // Should be equal in content but not the same reference
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });
  });

  describe('Listener Management', () => {
    it('should add and notify listeners', () => {
      stateManager.addListener(mockListener);
      
      // Should have received initial state notification
      expect(mockListener.onStateChange).toHaveBeenCalledWith(
        'initial',
        expect.any(Object),
        { previousState: null }
      );
    });

    it('should remove listeners', () => {
      stateManager.addListener(mockListener);
      vi.clearAllMocks();
      
      stateManager.removeListener(mockListener);
      
      // Make a move - listener should not be called
      stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      expect(mockListener.onStateChange).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners', () => {
      const listener1 = { onStateChange: vi.fn() };
      const listener2 = { onStateChange: vi.fn() };
      
      stateManager.addListener(listener1);
      stateManager.addListener(listener2);
      
      stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      expect(listener1.onStateChange).toHaveBeenCalledTimes(2); // initial + move
      expect(listener2.onStateChange).toHaveBeenCalledTimes(2); // initial + move
    });
  });

  describe('Move Management', () => {
    it('should handle successful moves and notify listeners', () => {
      stateManager.addListener(mockListener);
      vi.clearAllMocks();
      
      const success = stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      expect(success).toBe(true);
      expect(mockListener.onStateChange).toHaveBeenCalledWith(
        'move',
        expect.any(Object),
        expect.objectContaining({
          start: { x: 0, y: 0, z: 0 },
          end: { x: 1, y: 0, z: 0 },
          previousState: expect.any(Object)
        })
      );
      
      expect(mockListener.onMove).toHaveBeenCalledWith(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        expect.any(Object)
      );
    });

    it('should handle failed moves without notification', () => {
      stateManager.addListener(mockListener);
      vi.clearAllMocks();
      
      // Try to make an invalid move (same start and end)
      const success = stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
      
      expect(success).toBe(false);
      expect(mockListener.onStateChange).not.toHaveBeenCalled();
      expect(mockListener.onMove).not.toHaveBeenCalled();
    });

    it('should detect turn changes', () => {
      stateManager.addListener(mockListener);
      vi.clearAllMocks();
      
      const initialState = stateManager.getState();
      const initialPlayer = initialState.currentPlayer;
      
      // Make a move to change turns
      stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      const newState = stateManager.getState();
      
      expect(mockListener.onTurnChange).toHaveBeenCalledWith(
        newState.currentPlayer,
        newState
      );
      
      // Current player should have changed
      expect(newState.currentPlayer.id).not.toBe(initialPlayer.id);
    });
  });

  describe('Server State Synchronization', () => {
    it('should sync with server state and notify listeners', () => {
      stateManager.addListener(mockListener);
      vi.clearAllMocks();
      
      const serverState = {
        turn: 5,
        lines: [
          {
            start: { x: 0, y: 0, z: 0 },
            end: { x: 1, y: 0, z: 0 },
            player: { id: 'socket-123', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0 }
          }
        ],
        players: [
          { id: 'socket-123', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0 },
          { id: 'socket-456', name: 'Player 2', color: '#87CEEB', score: 0, squareCount: 0 }
        ]
      };
      
      stateManager.syncWithServerState(serverState);
      
      expect(mockListener.onStateChange).toHaveBeenCalledWith(
        'sync',
        expect.any(Object),
        expect.objectContaining({
          serverState,
          previousState: expect.any(Object)
        })
      );
      
      const newState = stateManager.getState();
      expect(newState.turn).toBe(5);
      expect(newState.lines).toHaveLength(1);
    });

    it('should handle sync errors and notify listeners', () => {
      stateManager.addListener(mockListener);
      vi.clearAllMocks();
      
      // Provide invalid server state
      const invalidServerState = null as any;
      
      stateManager.syncWithServerState(invalidServerState);
      
      expect(mockListener.onError).toHaveBeenCalledWith(
        'sync-error',
        expect.any(Error)
      );
    });
  });

  describe('Game End Detection', () => {
    it('should detect game end and notify listeners', () => {
      stateManager.addListener(mockListener);
      
      // Create a mock engine that will return a winner
      const mockEngine = {
        getState: vi.fn(),
        makeMove: vi.fn(),
        syncWithServerState: vi.fn(),
        resetGame: vi.fn()
      };
      
      const winnerState = {
        ...engine.getState(),
        winner: { id: 'player1', name: 'Player 1', color: '#FF0000', score: 1, squareCount: 4 }
      };
      
      mockEngine.getState.mockReturnValue(winnerState);
      mockEngine.makeMove.mockReturnValue(true);
      
      const testStateManager = new GameStateManager(mockEngine as any);
      testStateManager.addListener(mockListener);
      vi.clearAllMocks();
      
      testStateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      expect(mockListener.onGameEnd).toHaveBeenCalledWith(
        winnerState.winner,
        winnerState
      );
    });
  });

  describe('State Change Detection', () => {
    it('should only notify when state actually changes', () => {
      stateManager.addListener(mockListener);
      vi.clearAllMocks();
      
      // Force multiple notifications with same state
      stateManager.forceNotify();
      stateManager.forceNotify();
      
      // Should get notifications because force-update always notifies
      expect(mockListener.onStateChange).toHaveBeenCalledTimes(2);
    });

    it('should detect state changes automatically', () => {
      stateManager.addListener(mockListener);
      vi.clearAllMocks();
      
      // Make a move directly on engine (bypassing state manager)
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      // Check for changes
      stateManager.checkAndNotifyChanges();
      
      expect(mockListener.onStateChange).toHaveBeenCalledWith(
        'auto-detect',
        expect.any(Object),
        { previousState: null }
      );
    });
  });

  describe('Game Reset', () => {
    it('should reset game and notify listeners', () => {
      stateManager.addListener(mockListener);
      
      // Make some moves first
      stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      vi.clearAllMocks();
      
      stateManager.resetGame();
      
      expect(mockListener.onStateChange).toHaveBeenCalledWith(
        'reset',
        expect.any(Object),
        expect.objectContaining({
          previousState: expect.any(Object)
        })
      );
      
      const newState = stateManager.getState();
      expect(newState.turn).toBe(0);
      expect(newState.lines).toHaveLength(0);
      expect(newState.winner).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle listener errors gracefully', () => {
      const faultyListener = {
        onStateChange: vi.fn().mockImplementation(() => {
          throw new Error('Listener error');
        })
      };
      
      const goodListener = {
        onStateChange: vi.fn()
      };
      
      stateManager.addListener(faultyListener);
      stateManager.addListener(goodListener);
      
      // Should not throw despite faulty listener
      expect(() => {
        stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      }).not.toThrow();
      
      // Good listener should still be called
      expect(goodListener.onStateChange).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on dispose', () => {
      stateManager.addListener(mockListener);
      
      stateManager.dispose();
      
      // After disposal, moves should not notify listeners
      stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      // Should only have the initial notification, no move notification
      expect(mockListener.onStateChange).toHaveBeenCalledTimes(1);
    });
  });
});