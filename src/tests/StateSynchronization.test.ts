import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../core/GameEngine';
import { GameState, Player } from '../core/types';

describe('State Synchronization', () => {
  let engine: GameEngine;
  let initialState: GameState;

  beforeEach(() => {
    engine = new GameEngine(3, 'online');
    initialState = engine.getState();
  });

  describe('syncWithServerState', () => {
    it('should sync lines from server state', () => {
      const serverState = {
        lines: [
          {
            start: { x: 0, y: 0, z: 0 },
            end: { x: 1, y: 0, z: 0 },
            player: initialState.players[0]
          }
        ]
      };

      engine.syncWithServerState(serverState);
      const state = engine.getState();

      expect(state.lines).toHaveLength(1);
      expect(state.lines[0].start).toEqual({ x: 0, y: 0, z: 0 });
      expect(state.lines[0].end).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('should sync player properties but preserve engine IDs', () => {
      const serverState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 5, squareCount: 2, isAI: false },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 3, squareCount: 1, isAI: false }
        ]
      };

      engine.syncWithServerState(serverState);
      const state = engine.getState();

      // Engine IDs should be preserved
      expect(state.players[0].id).toBe('player1');
      expect(state.players[1].id).toBe('player2');

      // Other properties should be synced
      expect(state.players[0].name).toBe('Alice');
      expect(state.players[0].score).toBe(5);
      expect(state.players[0].squareCount).toBe(2);
      expect(state.players[1].name).toBe('Bob');
      expect(state.players[1].score).toBe(3);
    });

    it('should sync current player by position', () => {
      const serverState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0, isAI: false },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0, isAI: false }
        ],
        currentPlayer: { id: 'socket-456', name: 'Bob' }
      };

      engine.syncWithServerState(serverState);
      const state = engine.getState();

      // Current player should be player2 (Bob)
      expect(state.currentPlayer.id).toBe('player2');
      expect(state.currentPlayer.name).toBe('Bob');
    });

    it('should sync turn number', () => {
      const serverState = {
        turn: 5
      };

      engine.syncWithServerState(serverState);
      const state = engine.getState();

      expect(state.turn).toBe(5);
    });

    it('should sync winner by position', () => {
      const serverState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 10, squareCount: 5, isAI: false },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 3, squareCount: 2, isAI: false }
        ],
        winner: { id: 'socket-123', name: 'Alice' }
      };

      engine.syncWithServerState(serverState);
      const state = engine.getState();

      expect(state.winner).toBeDefined();
      expect(state.winner!.id).toBe('player1');
      expect(state.winner!.name).toBe('Alice');
    });

    it('should sync lastMove with correct player reference', () => {
      const serverState = {
        players: [
          { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0, isAI: false },
          { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0, isAI: false }
        ],
        lastMove: {
          start: { x: 0, y: 0, z: 0 },
          end: { x: 1, y: 0, z: 0 },
          player: { id: 'socket-456', name: 'Bob' }
        }
      };

      engine.syncWithServerState(serverState);
      const state = engine.getState();

      expect(state.lastMove).toBeDefined();
      expect(state.lastMove!.player.id).toBe('player2');
      expect(state.lastMove!.player.name).toBe('Bob');
    });

    it('should handle null lastMove', () => {
      const serverState = {
        lastMove: null
      };

      engine.syncWithServerState(serverState);
      const state = engine.getState();

      expect(state.lastMove).toBeNull();
    });

    it('should sync cubes with deep copy', () => {
      const serverState = {
        cubes: [
          {
            position: { x: 0, y: 0, z: 0 },
            faces: [
              {
                corners: [
                  { x: 0, y: 0, z: 0 },
                  { x: 1, y: 0, z: 0 },
                  { x: 1, y: 1, z: 0 },
                  { x: 0, y: 1, z: 0 }
                ],
                player: initialState.players[0]
              }
            ],
            owner: null,
            claimedFaces: 1
          }
        ]
      };

      engine.syncWithServerState(serverState);
      const state = engine.getState();

      expect(state.cubes).toHaveLength(1);
      expect(state.cubes[0].faces).toHaveLength(1);
      expect(state.cubes[0].claimedFaces).toBe(1);
      
      // Verify deep copy - modifying server state shouldn't affect engine state
      serverState.cubes[0].claimedFaces = 99;
      expect(state.cubes[0].claimedFaces).toBe(1);
    });

    it('should handle partial state updates', () => {
      // First update: just lines
      engine.syncWithServerState({
        lines: [
          {
            start: { x: 0, y: 0, z: 0 },
            end: { x: 1, y: 0, z: 0 },
            player: initialState.players[0]
          }
        ]
      });

      let state = engine.getState();
      expect(state.lines).toHaveLength(1);
      expect(state.turn).toBe(0); // Unchanged

      // Second update: just turn
      engine.syncWithServerState({
        turn: 3
      });

      state = engine.getState();
      expect(state.lines).toHaveLength(1); // Preserved from previous update
      expect(state.turn).toBe(3);
    });

    it('should throw error for invalid state', () => {
      // Missing required data
      expect(() => {
        engine.syncWithServerState(null as any);
      }).toThrow('Server state is required for synchronization');

      // Invalid current player
      expect(() => {
        engine.syncWithServerState({
          players: [
            { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0, isAI: false },
            { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0, isAI: false }
          ],
          currentPlayer: { id: 'socket-999', name: 'Invalid' }
        });
      }).not.toThrow(); // Should handle gracefully by not updating currentPlayer

      // Invalid winner
      expect(() => {
        engine.syncWithServerState({
          players: [
            { id: 'socket-123', name: 'Alice', color: '#FF0000', score: 0, squareCount: 0, isAI: false },
            { id: 'socket-456', name: 'Bob', color: '#0000FF', score: 0, squareCount: 0, isAI: false }
          ],
          winner: { id: 'socket-999', name: 'Invalid' }
        });
      }).not.toThrow(); // Should handle gracefully by not updating winner
    });
  });

  describe('State Validation', () => {
    it('should validate that game has exactly 2 players', () => {
      const invalidState = {
        players: [initialState.players[0]], // Only 1 player
        currentPlayer: initialState.players[0],
        lines: [],
        cubes: [],
        turn: 0
      };

      expect(() => {
        (engine as any).validateState(invalidState);
      }).toThrow('Game must have exactly 2 players');
    });

    it('should validate that current player exists', () => {
      const invalidState = {
        ...initialState,
        currentPlayer: { id: 'invalid', name: 'Invalid', color: '#000000', score: 0, squareCount: 0 } as Player
      };

      expect(() => {
        (engine as any).validateState(invalidState);
      }).toThrow('Current player must be one of the game players');
    });

    it('should validate turn number is not negative', () => {
      const invalidState = {
        ...initialState,
        turn: -1
      };

      expect(() => {
        (engine as any).validateState(invalidState);
      }).toThrow('Turn number cannot be negative');
    });

    it('should warn about lines referencing non-existent players during sync', () => {
      const invalidState = {
        ...initialState,
        lines: [
          {
            start: { x: 0, y: 0, z: 0 },
            end: { x: 1, y: 0, z: 0 },
            player: { id: 'invalid', name: 'Invalid', color: '#000000', score: 0, squareCount: 0 } as Player
          }
        ]
      };

      // Spy on console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw, just warn
      expect(() => {
        (engine as any).validateState(invalidState);
      }).not.toThrow();

      // Should have warned about the invalid player
      expect(warnSpy).toHaveBeenCalledWith('Line references player with ID: invalid - will be resolved during sync');

      warnSpy.mockRestore();
    });

    it('should validate winner is one of the players', () => {
      const invalidState = {
        ...initialState,
        winner: { id: 'invalid', name: 'Invalid', color: '#000000', score: 0, squareCount: 0 } as Player
      };

      expect(() => {
        (engine as any).validateState(invalidState);
      }).toThrow('Winner must be one of the game players');
    });
  });
});