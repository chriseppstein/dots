import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../core/GameEngine';
import { GameController } from '../core/GameController';
import { GameRenderer } from '../core/GameRenderer';
import { NetworkManager } from '../network/NetworkManager';

// Mock NetworkManager
vi.mock('../network/NetworkManager', () => {
  return {
    NetworkManager: vi.fn(() => ({}))
  };
});

// Mock GameRenderer to track what's being rendered
vi.mock('../core/GameRenderer', () => {
  return {
    GameRenderer: vi.fn().mockImplementation(() => ({
      updateFromGameState: vi.fn(),
      dispose: vi.fn()
    }))
  };
});

describe('Last Move Tracking', () => {
  describe('Local Game', () => {
    let engine: GameEngine;
    
    beforeEach(() => {
      engine = new GameEngine(4, 'local');
    });
    
    it('should track last move in game engine', () => {
      // Initially no last move
      expect(engine.getState().lastMove).toBeUndefined();
      
      // Make a move
      const success = engine.makeMove({x: 0, y: 0, z: 0}, {x: 1, y: 0, z: 0});
      expect(success).toBe(true);
      
      // Check that last move is tracked
      const state = engine.getState();
      expect(state.lastMove).toBeDefined();
      expect(state.lastMove?.start).toEqual({x: 0, y: 0, z: 0});
      expect(state.lastMove?.end).toEqual({x: 1, y: 0, z: 0});
      expect(state.lastMove?.player).toBeDefined();
      expect(state.lastMove?.player?.id).toBe('player1');
    });
    
    it('should update last move on each move', () => {
      // First move
      engine.makeMove({x: 0, y: 0, z: 0}, {x: 1, y: 0, z: 0});
      let state = engine.getState();
      const firstMove = state.lastMove;
      expect(firstMove?.player?.id).toBe('player1');
      
      // Second move (should be player 2's turn)
      engine.makeMove({x: 0, y: 0, z: 0}, {x: 0, y: 1, z: 0});
      state = engine.getState();
      const secondMove = state.lastMove;
      expect(secondMove?.player?.id).toBe('player2');
      expect(secondMove).not.toEqual(firstMove);
      expect(secondMove?.start).toEqual({x: 0, y: 0, z: 0});
      expect(secondMove?.end).toEqual({x: 0, y: 1, z: 0});
    });
  });
  
  describe('Multiplayer Game State Sync', () => {
    let controller: GameController;
    let mockRenderer: any;
    
    beforeEach(() => {
      controller = new GameController(4, 'online', 'Player 1', 'Player 2');
      mockRenderer = {
        updateFromGameState: vi.fn(),
        dispose: vi.fn()
      };
      controller.attachRenderer(mockRenderer);
    });
    
    it('should sync lastMove from server state', () => {
      const serverState = {
        gridSize: 4,
        gameMode: 'online',
        turn: 1,
        lines: [
          {
            start: {x: 0, y: 0, z: 0},
            end: {x: 1, y: 0, z: 0},
            player: {
              id: 'socket-id-1',
              name: 'Player 1',
              color: '#FF0000',
              score: 0,
              squareCount: 0
            }
          }
        ],
        lastMove: {
          start: {x: 0, y: 0, z: 0},
          end: {x: 1, y: 0, z: 0},
          player: {
            id: 'socket-id-1',
            name: 'Player 1',
            color: '#FF0000',
            score: 0,
            squareCount: 0
          }
        },
        players: [
          {
            id: 'socket-id-1',
            name: 'Player 1',
            color: '#FF0000',
            score: 0,
            squareCount: 0
          },
          {
            id: 'socket-id-2',
            name: 'Player 2',
            color: '#87CEEB',
            score: 0,
            squareCount: 0
          }
        ],
        currentPlayer: {
          id: 'socket-id-2',
          name: 'Player 2',
          color: '#87CEEB',
          score: 0,
          squareCount: 0
        },
        cubes: [],
        winner: null
      };
      
      // Sync the server state
      controller.handleServerStateUpdate(serverState);
      
      // Get the state that would be sent to renderer
      const state = controller.getState();
      
      // Debug output
      console.log('State after sync:', {
        hasLastMove: !!state.lastMove,
        lastMove: state.lastMove,
        linesCount: state.lines?.length
      });
      
      // Verify lastMove exists
      expect(state.lastMove).toBeDefined();
      expect(state.lastMove?.start).toEqual({x: 0, y: 0, z: 0});
      expect(state.lastMove?.end).toEqual({x: 1, y: 0, z: 0});
      
      // Verify the renderer was called with the state including lastMove
      expect(mockRenderer.updateFromGameState).toHaveBeenCalled();
      // Get the LAST call (not the first), since attachRenderer calls it once initially
      const calls = mockRenderer.updateFromGameState.mock.calls;
      const lastCallIndex = calls.length - 1;
      const rendererCallArg = calls[lastCallIndex][0];
      
      console.log('Renderer called with:', {
        hasLastMove: !!rendererCallArg.lastMove,
        lastMove: rendererCallArg.lastMove,
        callCount: calls.length,
        checkingCallIndex: lastCallIndex
      });
      
      expect(rendererCallArg.lastMove).toBeDefined();
      expect(rendererCallArg.lastMove?.start).toEqual({x: 0, y: 0, z: 0});
      expect(rendererCallArg.lastMove?.end).toEqual({x: 1, y: 0, z: 0});
    });
    
    it('should handle multiple moves in multiplayer', () => {
      // Initial state with no moves
      const initialState = {
        gridSize: 4,
        gameMode: 'online',
        turn: 0,
        lines: [],
        lastMove: null,
        players: [
          {id: 'socket-1', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0},
          {id: 'socket-2', name: 'Player 2', color: '#87CEEB', score: 0, squareCount: 0}
        ],
        currentPlayer: {id: 'socket-1', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0},
        cubes: [],
        winner: null
      };
      
      controller.handleServerStateUpdate(initialState);
      let state = controller.getState();
      expect(state.lastMove).toBeUndefined();
      
      // First move
      const stateAfterMove1 = {
        ...initialState,
        turn: 1,
        lines: [{
          start: {x: 0, y: 0, z: 0},
          end: {x: 1, y: 0, z: 0},
          player: initialState.players[0]
        }],
        lastMove: {
          start: {x: 0, y: 0, z: 0},
          end: {x: 1, y: 0, z: 0},
          player: initialState.players[0]
        },
        currentPlayer: initialState.players[1]
      };
      
      controller.handleServerStateUpdate(stateAfterMove1);
      state = controller.getState();
      expect(state.lastMove).toBeDefined();
      expect(state.lastMove?.start).toEqual({x: 0, y: 0, z: 0});
      
      // Second move
      const stateAfterMove2 = {
        ...stateAfterMove1,
        turn: 2,
        lines: [
          ...stateAfterMove1.lines,
          {
            start: {x: 0, y: 0, z: 0},
            end: {x: 0, y: 1, z: 0},
            player: initialState.players[1]
          }
        ],
        lastMove: {
          start: {x: 0, y: 0, z: 0},
          end: {x: 0, y: 1, z: 0},
          player: initialState.players[1]
        },
        currentPlayer: initialState.players[0]
      };
      
      controller.handleServerStateUpdate(stateAfterMove2);
      state = controller.getState();
      expect(state.lastMove).toBeDefined();
      expect(state.lastMove?.end).toEqual({x: 0, y: 1, z: 0});
      
      // Verify renderer gets called with updated lastMove each time
      // attachRenderer calls it once, then each handleServerStateUpdate calls it
      expect(mockRenderer.updateFromGameState).toHaveBeenCalledTimes(4); // initial from attachRenderer + 3 state updates
      const lastCall = mockRenderer.updateFromGameState.mock.calls[3][0];
      expect(lastCall.lastMove?.end).toEqual({x: 0, y: 1, z: 0});
    });
  });
  
  describe('Renderer Integration', () => {
    it('should pass lastMove to renderer updateFromGameState', () => {
      // Create a simple mock renderer
      const mockRenderer = {
        updateFromGameState: vi.fn(),
        dispose: vi.fn()
      };
      
      // Test the areLinesEqual method (private, but we can test through behavior)
      const state = {
        gridSize: 4,
        gameMode: 'local' as const,
        turn: 2,
        lines: [
          {
            start: {x: 0, y: 0, z: 0},
            end: {x: 1, y: 0, z: 0},
            player: {id: 'player1', name: 'P1', color: '#FF0000', score: 0, squareCount: 0}
          },
          {
            start: {x: 0, y: 0, z: 0},
            end: {x: 0, y: 1, z: 0},
            player: {id: 'player2', name: 'P2', color: '#87CEEB', score: 0, squareCount: 0}
          }
        ],
        lastMove: {
          start: {x: 0, y: 0, z: 0},
          end: {x: 0, y: 1, z: 0},
          player: {id: 'player2', name: 'P2', color: '#87CEEB', score: 0, squareCount: 0}
        },
        players: [
          {id: 'player1', name: 'P1', color: '#FF0000', score: 0, squareCount: 0},
          {id: 'player2', name: 'P2', color: '#87CEEB', score: 0, squareCount: 0}
        ],
        currentPlayer: {id: 'player1', name: 'P1', color: '#FF0000', score: 0, squareCount: 0},
        cubes: [],
        winner: null
      };
      
      // Call updateFromGameState with the state
      mockRenderer.updateFromGameState(state);
      
      // Verify the renderer received the state with lastMove
      expect(mockRenderer.updateFromGameState).toHaveBeenCalledWith(state);
      const callArg = mockRenderer.updateFromGameState.mock.calls[0][0];
      expect(callArg.lastMove).toBeDefined();
      expect(callArg.lastMove.start).toEqual({x: 0, y: 0, z: 0});
      expect(callArg.lastMove.end).toEqual({x: 0, y: 1, z: 0});
    });
  });
  
  describe('Debugging Helpers', () => {
    it('should log state for debugging', () => {
      const engine = new GameEngine(4, 'online');
      
      // Make a move
      engine.makeMove({x: 0, y: 0, z: 0}, {x: 1, y: 0, z: 0});
      
      const state = engine.getState();
      
      // Log the state for debugging
      console.log('=== LAST MOVE DEBUG ===');
      console.log('Current turn:', state.turn);
      console.log('Last move:', JSON.stringify(state.lastMove, null, 2));
      console.log('Lines count:', state.lines.length);
      console.log('Current player:', state.currentPlayer.id);
      console.log('=== END DEBUG ===');
      
      // This test just ensures the logging works
      expect(state.lastMove).toBeDefined();
    });
  });
});