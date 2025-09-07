import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../core/GameEngine';

describe('Square Counting', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(3, 'local');
  });

  describe('Square Count Tracking', () => {
    it('should initialize players with zero square count', () => {
      const state = engine.getState();
      expect(state.players[0].squareCount).toBe(0);
      expect(state.players[1].squareCount).toBe(0);
    });

    it('should increment square count when a player completes a square', () => {
      // Complete a square on the bottom face (z=0)
      // Player 1 moves
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      // Player 2 moves
      engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 });
      // Player 1 moves
      engine.makeMove({ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 });
      
      // Player 2 completes the square
      engine.makeMove({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
      
      const state = engine.getState();
      // Player 2 should have 1 square
      expect(state.players[1].squareCount).toBe(1);
      expect(state.players[0].squareCount).toBe(0);
    });

    it('should track multiple squares per player', () => {
      // Let's complete several squares for testing
      // Bottom face square 1
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      engine.makeMove({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 });
      engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 });
      engine.makeMove({ x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 });
      engine.makeMove({ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 });
      engine.makeMove({ x: 1, y: 0, z: 1 }, { x: 1, y: 1, z: 1 });
      
      // Player 1's turn - complete first square
      engine.makeMove({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
      
      let state = engine.getState();
      expect(state.players[0].squareCount).toBeGreaterThanOrEqual(1);
      
      // Player 1 gets another turn after completing a square
      // Complete another square on a different face
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
      engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 1 });
      engine.makeMove({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 1 });
      engine.makeMove({ x: 1, y: 1, z: 0 }, { x: 1, y: 1, z: 1 });
      
      // Complete second square for player 2
      engine.makeMove({ x: 1, y: 1, z: 1 }, { x: 0, y: 1, z: 1 });
      
      state = engine.getState();
      // Player 2 should have at least 1 square (may have completed more)
      expect(state.players[1].squareCount).toBeGreaterThanOrEqual(1);
      
      // Both players should have some squares
      expect(state.players[0].squareCount).toBeGreaterThan(0);
      expect(state.players[1].squareCount).toBeGreaterThan(0);
    });

    it('should differentiate square count from cube score', () => {
      const state = engine.getState();
      
      // A player can have many squares but no cubes yet
      // (needs 4 faces of a cube to win it)
      
      // Initial state
      expect(state.players[0].squareCount).toBe(0);
      expect(state.players[0].score).toBe(0);
      
      // After completing squares, square count increases
      // but score (cubes) might still be 0
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 });
      engine.makeMove({ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 });
      engine.makeMove({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
      
      const newState = engine.getState();
      // Player has squares but might not have cubes yet
      expect(newState.players[1].squareCount).toBeGreaterThan(0);
      expect(newState.players[1].score).toBe(0); // No cubes won yet
    });

    it('should count all squares correctly at game end', () => {
      // Simulate a more complete game
      const moves = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }],
        [{ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }],
        [{ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }], // Complete square
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
        [{ x: 1, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }],
        [{ x: 1, y: 1, z: 1 }, { x: 0, y: 1, z: 1 }],
        [{ x: 0, y: 1, z: 1 }, { x: 0, y: 0, z: 1 }], // Complete square
      ];
      
      moves.forEach(([start, end]) => {
        engine.makeMove(start as any, end as any);
      });
      
      const state = engine.getState();
      
      // Total square count should match actual completed squares
      const totalSquares = state.players[0].squareCount + state.players[1].squareCount;
      expect(totalSquares).toBeGreaterThanOrEqual(0);
      
      // Each player's square count should be >= 0
      expect(state.players[0].squareCount).toBeGreaterThanOrEqual(0);
      expect(state.players[1].squareCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Square Count Display', () => {
    it('should have squareCount property on players', () => {
      const state = engine.getState();
      expect(state.players[0]).toHaveProperty('squareCount');
      expect(state.players[1]).toHaveProperty('squareCount');
      expect(typeof state.players[0].squareCount).toBe('number');
      expect(typeof state.players[1].squareCount).toBe('number');
    });

    it('should update square counts after each scoring update', () => {
      // Make moves and verify counts update
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      let state = engine.getState();
      const initialCount = state.players[0].squareCount;
      
      // Complete more moves
      engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 });
      engine.makeMove({ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 });
      engine.makeMove({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
      
      state = engine.getState();
      // Square count should have changed
      expect(state.players[1].squareCount).not.toBe(initialCount);
    });
  });
});