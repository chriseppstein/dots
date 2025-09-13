import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameController } from '../core/GameController';
import { GameBoard } from '../components/GameBoard';

// Mock the GameRenderer to avoid WebGL dependencies
vi.mock('../core/GameRenderer', () => {
  return {
    GameRenderer: vi.fn().mockImplementation(() => ({
      onLineClick: vi.fn(),
      updateFromGameState: vi.fn(),
      dispose: vi.fn(),
      setSquareOpacity: vi.fn()
    }))
  };
});

describe('State Management Integration', () => {
  let gameBoard: GameBoard;
  
  beforeEach(() => {
    // Clear any existing custom elements
    if (customElements.get('game-board')) {
      // Can't undefine, so create a new instance
    }
    gameBoard = new GameBoard();
    document.body.appendChild(gameBoard);
  });

  afterEach(() => {
    if (gameBoard.parentNode) {
      gameBoard.parentNode.removeChild(gameBoard);
    }
  });

  describe('Centralized State Updates', () => {
    it('should update UI automatically when state changes through StateManager', async () => {
      // Start a local game
      gameBoard.startGame(3, 'local', 'Alice', 'Bob');
      
      // Give time for initial state listener to be called
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check initial state
      const controller = (gameBoard as any).controller;
      expect(controller).toBeDefined();
      
      const initialState = controller.getState();
      expect(initialState.turn).toBe(0);
      expect(initialState.currentPlayer.name).toBe('Alice');
      
      // Mock the updateHUD method to verify it gets called
      const updateHUDSpy = vi.spyOn(gameBoard as any, 'updateHUD');
      
      // Make a move through the state manager
      const stateManager = controller.getStateManager();
      const moveSuccess = stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      expect(moveSuccess).toBe(true);
      
      // Verify updateHUD was called due to state change
      expect(updateHUDSpy).toHaveBeenCalled();
      
      // Verify state changed
      const newState = controller.getState();
      expect(newState.turn).toBe(1);
      expect(newState.currentPlayer.name).toBe('Bob');
      expect(newState.lines).toHaveLength(1);
    });

    it('should handle multiple listeners correctly', () => {
      gameBoard.startGame(3, 'local', 'Player 1', 'Player 2');
      
      const controller = (gameBoard as any).controller;
      const stateManager = controller.getStateManager();
      
      // Create additional listeners
      const listener1 = {
        onStateChange: vi.fn(),
        onMove: vi.fn(),
        onGameEnd: vi.fn()
      };
      
      const listener2 = {
        onStateChange: vi.fn()
      };
      
      stateManager.addListener(listener1);
      stateManager.addListener(listener2);
      
      // Make a move
      stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      // All listeners should be notified
      expect(listener1.onStateChange).toHaveBeenCalled();
      expect(listener1.onMove).toHaveBeenCalled();
      expect(listener2.onStateChange).toHaveBeenCalled();
      
      // Clean up
      stateManager.removeListener(listener1);
      stateManager.removeListener(listener2);
    });

    it('should clean up listeners when GameBoard is disposed', () => {
      gameBoard.startGame(3, 'local', 'Player 1', 'Player 2');
      
      const controller = (gameBoard as any).controller;
      const stateManager = controller.getStateManager();
      
      // Spy on removeListener to verify cleanup
      const removeListenerSpy = vi.spyOn(stateManager, 'removeListener');
      
      // Start a new game (which disposes the old controller)
      gameBoard.startGame(3, 'local', 'Player A', 'Player B');
      
      // Verify the old GameBoard listener was removed
      expect(removeListenerSpy).toHaveBeenCalledWith(gameBoard);
    });
  });

  describe('State Synchronization', () => {
    it('should handle server state synchronization through StateManager', () => {
      gameBoard.startGame(3, 'online', 'Alice', 'Bob');
      
      const controller = (gameBoard as any).controller;
      const stateManager = controller.getStateManager();
      
      // Mock the onStateChange method to track calls
      const onStateChangeSpy = vi.spyOn(gameBoard, 'onStateChange');
      
      // Simulate server state update
      const serverState = {
        turn: 2,
        lines: [
          {
            start: { x: 0, y: 0, z: 0 },
            end: { x: 1, y: 0, z: 0 },
            player: { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0 }
          }
        ],
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 1 },
          { id: 'socket-456', name: 'Bob', color: '#87CEEB', score: 0, squareCount: 0 }
        ]
      };
      
      stateManager.syncWithServerState(serverState);
      
      // Verify state change listener was called
      expect(onStateChangeSpy).toHaveBeenCalledWith(
        'sync',
        expect.any(Object),
        expect.objectContaining({ serverState })
      );
      
      // Verify state was updated
      const newState = controller.getState();
      expect(newState.turn).toBe(2);
      expect(newState.lines).toHaveLength(1);
    });

    it('should handle game end through StateManager', () => {
      gameBoard.startGame(3, 'local', 'Player 1', 'Player 2');
      
      const controller = (gameBoard as any).controller;
      
      // Mock showWinner to verify it gets called
      const showWinnerSpy = vi.spyOn(gameBoard as any, 'showWinner');
      
      // Mock onGameEnd to verify it gets called
      const onGameEndSpy = vi.spyOn(gameBoard, 'onGameEnd');
      
      // Create a mock state with a winner
      const winnerState = {
        ...controller.getState(),
        winner: { id: 'player1', name: 'Player 1', color: '#FF0000', score: 1, squareCount: 4 }
      };
      
      // Directly call the GameBoard's onGameEnd method
      gameBoard.onGameEnd(winnerState.winner, winnerState);
      
      // Verify showWinner was called
      expect(showWinnerSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle state manager errors gracefully', () => {
      gameBoard.startGame(3, 'local', 'Player 1', 'Player 2');
      
      // Mock console.error to verify error handling
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Trigger an error through the onError method
      const testError = new Error('Test error');
      gameBoard.onError('test-error', testError);
      
      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('GameBoard error (test-error):', testError);
      
      consoleErrorSpy.mockRestore();
    });

    it('should continue working if one listener throws an error', () => {
      gameBoard.startGame(3, 'local', 'Player 1', 'Player 2');
      
      const controller = (gameBoard as any).controller;
      const stateManager = controller.getStateManager();
      
      // Add a faulty listener
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
      
      // Make a move - should not throw despite faulty listener
      expect(() => {
        stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      }).not.toThrow();
      
      // Good listener should still have been called
      expect(goodListener.onStateChange).toHaveBeenCalled();
      
      // Clean up
      stateManager.removeListener(faultyListener);
      stateManager.removeListener(goodListener);
    });
  });

  describe('Performance', () => {
    it('should only update UI when state actually changes', () => {
      gameBoard.startGame(3, 'local', 'Player 1', 'Player 2');
      
      const controller = (gameBoard as any).controller;
      const stateManager = controller.getStateManager();
      
      // Mock updateHUD to count calls
      const updateHUDSpy = vi.spyOn(gameBoard as any, 'updateHUD');
      updateHUDSpy.mockClear(); // Clear initial call
      
      // Force multiple notifications with same state
      stateManager.forceNotify();
      stateManager.forceNotify();
      
      // Should get multiple calls because force-update always triggers
      expect(updateHUDSpy).toHaveBeenCalledTimes(2);
      
      updateHUDSpy.mockClear();
      
      // Try to make an invalid move (should not trigger state change)
      const invalidMoveSuccess = stateManager.makeMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
      expect(invalidMoveSuccess).toBe(false);
      
      // Should not have called updateHUD for failed move
      expect(updateHUDSpy).not.toHaveBeenCalled();
    });
  });
});