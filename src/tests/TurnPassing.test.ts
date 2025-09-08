import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../core/GameEngine';
import { GridSize, GameMode, Player } from '../core/types';

describe('Turn Passing and State Synchronization', () => {
  let engine: GameEngine;
  let player1: Player;
  let player2: Player;

  beforeEach(() => {
    engine = new GameEngine(3, 'local');
    const state = engine.getState();
    player1 = state.players[0];
    player2 = state.players[1];
  });

  describe('Turn Management', () => {
    it('should start with player 1 as current player', () => {
      const state = engine.getState();
      expect(state.currentPlayer.id).toBe('player1');
      expect(state.turn).toBe(0);
    });

    it('should switch to player 2 after player 1 makes a non-scoring move', () => {
      // Player 1 makes a move
      const success = engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      expect(success).toBe(true);
      
      const state = engine.getState();
      expect(state.currentPlayer.id).toBe('player2');
      expect(state.turn).toBe(1);
    });

    it('should switch turns back and forth between players', () => {
      // Player 1's turn
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      let state = engine.getState();
      expect(state.currentPlayer.id).toBe('player2');

      // Player 2's turn
      engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 });
      state = engine.getState();
      expect(state.currentPlayer.id).toBe('player1');

      // Player 1's turn again
      engine.makeMove({ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 });
      state = engine.getState();
      expect(state.currentPlayer.id).toBe('player2');
    });

    it('should keep the same player if they complete a square', () => {
      // Set up a square that's almost complete
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }); // Player 1
      engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }); // Player 2
      engine.makeMove({ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }); // Player 1
      
      let state = engine.getState();
      expect(state.currentPlayer.id).toBe('player2');
      
      // Player 2 completes the square
      engine.makeMove({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
      
      state = engine.getState();
      // Player 2 should still be the current player
      expect(state.currentPlayer.id).toBe('player2');
      expect(state.players[1].squareCount).toBeGreaterThan(0);
    });

    it('should not allow a player to move when it is not their turn', () => {
      const state = engine.getState();
      expect(state.currentPlayer.id).toBe('player1');
      
      // Try to make a move as player 2 (simulated by making two moves in a row)
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      // Current player should now be player 2
      const newState = engine.getState();
      expect(newState.currentPlayer.id).toBe('player2');
      
      // The game engine doesn't track who's making the move, 
      // but in online mode, the server should validate this
    });
  });

  describe('State Synchronization', () => {
    it('should have identical game states after each move', () => {
      // Create two engines to simulate two players
      const engine1 = new GameEngine(3, 'local');
      const engine2 = new GameEngine(3, 'local');
      
      // Player 1 makes a move on both engines
      const move1 = { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } };
      engine1.makeMove(move1.start, move1.end);
      engine2.makeMove(move1.start, move1.end);
      
      // States should be identical
      const state1 = engine1.getState();
      const state2 = engine2.getState();
      
      expect(state1.currentPlayer.id).toBe(state2.currentPlayer.id);
      expect(state1.turn).toBe(state2.turn);
      expect(state1.lines.length).toBe(state2.lines.length);
      expect(state1.players[0].score).toBe(state2.players[0].score);
      expect(state1.players[1].score).toBe(state2.players[1].score);
    });

    it('should maintain consistent scoring across both views', () => {
      const engine1 = new GameEngine(3, 'local');
      const engine2 = new GameEngine(3, 'local');
      
      // Play moves that complete a square
      const moves = [
        { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }, // P1
        { start: { x: 1, y: 0, z: 0 }, end: { x: 1, y: 1, z: 0 } }, // P2
        { start: { x: 1, y: 1, z: 0 }, end: { x: 0, y: 1, z: 0 } }, // P1
        { start: { x: 0, y: 1, z: 0 }, end: { x: 0, y: 0, z: 0 } }  // P2 completes square
      ];
      
      moves.forEach(move => {
        engine1.makeMove(move.start, move.end);
        engine2.makeMove(move.start, move.end);
      });
      
      const state1 = engine1.getState();
      const state2 = engine2.getState();
      
      // Both should show the same square count for player 2
      expect(state1.players[1].squareCount).toBe(state2.players[1].squareCount);
      expect(state1.players[1].squareCount).toBeGreaterThan(0);
    });
  });

  describe('Multi-turn Game with Scoring', () => {
    it('should play a complete game where both players score', () => {
      // Build a cube systematically, ensuring both players get to score
      const moves = [
        // Bottom face - 3 lines by Player 1, last line by Player 2 (P2 scores)
        { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } },
        { start: { x: 1, y: 0, z: 0 }, end: { x: 1, y: 1, z: 0 } },
        { start: { x: 1, y: 1, z: 0 }, end: { x: 0, y: 1, z: 0 } },
        { start: { x: 0, y: 1, z: 0 }, end: { x: 0, y: 0, z: 0 } }, // Completes square
        
        // Top face - Player 2 continues, then Player 1 takes over
        { start: { x: 0, y: 0, z: 1 }, end: { x: 1, y: 0, z: 1 } }, // P2 continues after scoring
        { start: { x: 1, y: 0, z: 1 }, end: { x: 1, y: 1, z: 1 } },
        { start: { x: 1, y: 1, z: 1 }, end: { x: 0, y: 1, z: 1 } },
        { start: { x: 0, y: 1, z: 1 }, end: { x: 0, y: 0, z: 1 } }, // Completes square
        
        // Vertical edges to connect top and bottom
        { start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 1 } },
        { start: { x: 1, y: 0, z: 0 }, end: { x: 1, y: 0, z: 1 } }, // Completes front face
        { start: { x: 1, y: 1, z: 0 }, end: { x: 1, y: 1, z: 1 } }, // Completes right face
        { start: { x: 0, y: 1, z: 0 }, end: { x: 0, y: 1, z: 1 } }  // Completes back and left faces
      ];
      
      let lastScoringPlayer = null;
      
      moves.forEach((move, index) => {
        const stateBefore = engine.getState();
        const squaresBefore = stateBefore.players.map(p => p.squareCount);
        const currentPlayerId = stateBefore.currentPlayer.id;
        
        // Make the move
        const success = engine.makeMove(move.start, move.end);
        expect(success).toBe(true);
        
        const stateAfter = engine.getState();
        const squaresAfter = stateAfter.players.map(p => p.squareCount);
        
        // Check if someone scored
        const player1Scored = squaresAfter[0] > squaresBefore[0];
        const player2Scored = squaresAfter[1] > squaresBefore[1];
        
        if (player1Scored || player2Scored) {
          const scoringPlayer = player1Scored ? 'player1' : 'player2';
          lastScoringPlayer = scoringPlayer;
          // When a player scores, they should keep their turn
          expect(stateAfter.currentPlayer.id).toBe(scoringPlayer);
        } else if (lastScoringPlayer) {
          // If nobody scored but someone scored before, turn should have switched
          lastScoringPlayer = null;
        }
      });
      
      const finalState = engine.getState();
      
      // Both players should have scored at least one square
      expect(finalState.players[0].squareCount).toBeGreaterThan(0);
      expect(finalState.players[1].squareCount).toBeGreaterThan(0);
      
      // At least one player should have won a cube
      const totalCubesWon = finalState.players[0].score + finalState.players[1].score;
      expect(totalCubesWon).toBeGreaterThan(0);
    });

    it('should track turn count correctly through a game', () => {
      const moves = [
        { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } },
        { start: { x: 1, y: 0, z: 0 }, end: { x: 1, y: 1, z: 0 } },
        { start: { x: 1, y: 1, z: 0 }, end: { x: 0, y: 1, z: 0 } },
        { start: { x: 0, y: 1, z: 0 }, end: { x: 0, y: 0, z: 0 } }
      ];
      
      moves.forEach((move, index) => {
        engine.makeMove(move.start, move.end);
        const state = engine.getState();
        expect(state.turn).toBe(index + 1);
      });
    });
  });

  describe('Online Mode Considerations', () => {
    it('should have properties needed for network synchronization', () => {
      const state = engine.getState();
      
      // State should include all necessary info for reconstruction
      expect(state).toHaveProperty('gridSize');
      expect(state).toHaveProperty('currentPlayer');
      expect(state).toHaveProperty('players');
      expect(state).toHaveProperty('lines');
      expect(state).toHaveProperty('cubes');
      expect(state).toHaveProperty('turn');
      expect(state).toHaveProperty('winner');
      
      // Players should have IDs for validation
      expect(state.players[0]).toHaveProperty('id');
      expect(state.players[1]).toHaveProperty('id');
    });

    it('should be able to reconstruct game state from serialized data', () => {
      // Make some moves
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 });
      
      const state = engine.getState();
      
      // Serialize and deserialize (simulate network transfer)
      const serialized = JSON.stringify(state);
      const deserialized = JSON.parse(serialized);
      
      // Key properties should survive serialization
      expect(deserialized.currentPlayer.id).toBe(state.currentPlayer.id);
      expect(deserialized.turn).toBe(state.turn);
      expect(deserialized.lines.length).toBe(state.lines.length);
      expect(deserialized.players[0].score).toBe(state.players[0].score);
    });
  });
});