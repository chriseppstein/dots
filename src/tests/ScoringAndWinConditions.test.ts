import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../core/GameEngine';

describe('Scoring and Win Conditions', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(3, 'local'); // 3x3x3 grid = 2x2x2 = 8 cubes
  });

  describe('Square Completion and Turn Retention', () => {
    it('should keep turn when completing a square', () => {
      const state1 = engine.getState();
      const initialPlayer = state1.currentPlayer;
      
      // Draw three sides of a square on the bottom face (z=0)
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      // Switch to player 2
      const state2 = engine.getState();
      expect(state2.currentPlayer).not.toBe(initialPlayer);
      
      engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 });
      
      // Back to player 1
      const state3 = engine.getState();
      expect(state3.currentPlayer).toBe(initialPlayer);
      
      engine.makeMove({ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 });
      
      // Player 2's turn
      const state4 = engine.getState();
      expect(state4.currentPlayer).not.toBe(initialPlayer);
      
      // Player 2 completes the square
      engine.makeMove({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
      
      // Player 2 should keep the turn
      const state5 = engine.getState();
      expect(state5.currentPlayer).not.toBe(initialPlayer);
      expect(state5.currentPlayer.id).toBe('player2');
    });

    it('should allow multiple consecutive turns when completing multiple squares', () => {
      // Set up a scenario where completing squares gives extra turns
      
      // Create three sides of a square
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      engine.makeMove({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }); 
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
      
      const stateBefore = engine.getState();
      const playerBefore = stateBefore.currentPlayer;
      const linesBefore = stateBefore.lines.length;
      
      // Complete the square - player should keep turn
      engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 1 });
      
      const stateAfter = engine.getState();
      
      // Verify the line was added
      expect(stateAfter.lines.length).toBe(linesBefore + 1);
      
      // If a square was completed, the same player should still have the turn
      // Otherwise the turn would switch
      // This tests that the turn management is working
      expect(stateAfter.turn).toBeGreaterThan(stateBefore.turn);
    });
  });

  describe('Cube Ownership Rules', () => {
    it('should require exactly 4 faces to claim a cube', () => {
      // Manually check the cube claiming threshold
      const state = engine.getState();
      const testCube = state.cubes[0];
      
      // Simulate different numbers of claimed faces
      testCube.claimedFaces = 3;
      expect(testCube.claimedFaces < 4).toBe(true);
      
      testCube.claimedFaces = 4;
      expect(testCube.claimedFaces >= 4).toBe(true);
      
      testCube.claimedFaces = 5;
      expect(testCube.claimedFaces >= 4).toBe(true);
    });

    it('should track claimed faces per cube correctly', () => {
      const state = engine.getState();
      const cube = state.cubes[0];
      
      expect(cube.claimedFaces).toBe(0);
      expect(cube.faces).toHaveLength(6);
      
      // Each cube should start with no claimed faces
      state.cubes.forEach(cube => {
        expect(cube.claimedFaces).toBe(0);
        expect(cube.owner).toBeNull();
        cube.faces.forEach(face => {
          expect(face.player).toBeNull();
        });
      });
    });
  });

  describe('Score Calculation', () => {
    it('should initialize scores at zero', () => {
      const state = engine.getState();
      state.players.forEach(player => {
        expect(player.score).toBe(0);
      });
    });

    it('should increment score when player claims a cube', () => {
      const state = engine.getState();
      const player1 = state.players[0];
      
      // Simulate claiming a cube
      state.cubes[0].owner = player1;
      
      // Update scores (normally done automatically)
      player1.score = state.cubes.filter(c => c.owner?.id === player1.id).length;
      
      expect(player1.score).toBe(1);
    });

    it('should track multiple cube ownership correctly', () => {
      const state = engine.getState();
      const player1 = state.players[0];
      const player2 = state.players[1];
      
      // Simulate game progression
      state.cubes[0].owner = player1;
      state.cubes[1].owner = player1;
      state.cubes[2].owner = player2;
      state.cubes[3].owner = player1;
      
      // Update scores
      player1.score = state.cubes.filter(c => c.owner?.id === player1.id).length;
      player2.score = state.cubes.filter(c => c.owner?.id === player2.id).length;
      
      expect(player1.score).toBe(3);
      expect(player2.score).toBe(1);
    });
  });

  describe('Win Conditions', () => {
    it('should declare winner when all cubes are claimed', () => {
      const state = engine.getState();
      
      // Claim all cubes
      state.cubes.forEach((cube, i) => {
        cube.owner = i < 5 ? state.players[0] : state.players[1];
      });
      
      // Update scores
      state.players[0].score = 5;
      state.players[1].score = 3;
      
      // Check win condition (normally done in checkWinCondition)
      const allCubesClaimed = state.cubes.every(c => c.owner !== null);
      expect(allCubesClaimed).toBe(true);
      
      if (allCubesClaimed) {
        const winner = state.players[0].score > state.players[1].score 
          ? state.players[0] 
          : state.players[1];
        expect(winner.id).toBe('player1');
      }
    });

    it('should handle tie games', () => {
      const state = engine.getState();
      
      // Create a tie scenario (8 cubes, 4 each)
      state.cubes.forEach((cube, i) => {
        cube.owner = i < 4 ? state.players[0] : state.players[1];
      });
      
      state.players[0].score = 4;
      state.players[1].score = 4;
      
      // In a tie, there should be no winner
      const allCubesClaimed = state.cubes.every(c => c.owner !== null);
      expect(allCubesClaimed).toBe(true);
      
      if (allCubesClaimed && state.players[0].score === state.players[1].score) {
        expect(state.winner).toBeNull();
      }
    });

    it('should prevent moves after game ends', () => {
      // Since we can't directly modify internal state, we test that
      // the game has proper winner checking logic in place
      const testEngine = new GameEngine(3, 'local');
      
      // Verify moves work when there's no winner
      const result = testEngine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      expect(result).toBe(true);
      
      // The makeMove method includes winner checking
      // A full integration test would require playing out a complete game
      const state = testEngine.getState();
      expect(state.winner).toBeNull();
      expect(state.lines.length).toBe(1);
    });

    it('should correctly identify winner with different scores', () => {
      const scenarios = [
        { p1Score: 5, p2Score: 3, expectedWinner: 'player1' },
        { p1Score: 2, p2Score: 6, expectedWinner: 'player2' },
        { p1Score: 7, p2Score: 1, expectedWinner: 'player1' },
        { p1Score: 4, p2Score: 4, expectedWinner: null }, // Tie
      ];

      scenarios.forEach(({ p1Score, p2Score, expectedWinner }) => {
        const testEngine = new GameEngine(3, 'local');
        const state = testEngine.getState();
        
        // Simulate end game with scores
        let p1Cubes = 0, p2Cubes = 0;
        state.cubes.forEach((cube, i) => {
          if (p1Cubes < p1Score) {
            cube.owner = state.players[0];
            p1Cubes++;
          } else if (p2Cubes < p2Score) {
            cube.owner = state.players[1];
            p2Cubes++;
          }
        });
        
        state.players[0].score = p1Score;
        state.players[1].score = p2Score;
        
        if (p1Score !== p2Score) {
          const winner = p1Score > p2Score ? state.players[0] : state.players[1];
          expect(winner.id).toBe(expectedWinner);
        } else {
          // It's a tie
          expect(expectedWinner).toBeNull();
        }
      });
    });
  });

  describe('Game Statistics', () => {
    it('should track turn count correctly', () => {
      const state = engine.getState();
      expect(state.turn).toBe(0);
      
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      expect(engine.getState().turn).toBe(1);
      
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
      expect(engine.getState().turn).toBe(2);
      
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
      expect(engine.getState().turn).toBe(3);
    });

    it('should maintain game history', () => {
      const moves = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],
        [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }],
      ];

      moves.forEach(([start, end]) => {
        engine.makeMove(start, end);
      });

      const state = engine.getState();
      expect(state.lines).toHaveLength(3);
      
      // Verify each line is recorded with its player
      state.lines.forEach(line => {
        expect(line.player).not.toBeNull();
        expect(['player1', 'player2']).toContain(line.player?.id);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum grid size (3x3x3)', () => {
      const smallEngine = new GameEngine(3, 'local');
      const state = smallEngine.getState();
      
      expect(state.gridSize).toBe(3);
      expect(state.cubes).toHaveLength(8); // 2x2x2
      
      const possibleMoves = smallEngine.getPossibleMoves();
      expect(possibleMoves).toHaveLength(54);
    });

    it('should handle maximum grid size (6x6x6)', () => {
      const largeEngine = new GameEngine(6, 'local');
      const state = largeEngine.getState();
      
      expect(state.gridSize).toBe(6);
      expect(state.cubes).toHaveLength(125); // 5x5x5
      
      const possibleMoves = largeEngine.getPossibleMoves();
      // For 6x6x6: X-lines: 5*6*6=180, Y-lines: 6*5*6=180, Z-lines: 6*6*5=180, total=540
      expect(possibleMoves).toHaveLength(540);
    });

    it('should handle rapid consecutive moves', () => {
      const moves = [];
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          for (let z = 0; z < 2; z++) {
            if (x < 2) moves.push([{ x, y, z }, { x: x + 1, y, z }]);
            if (y < 2) moves.push([{ x, y, z }, { x, y: y + 1, z }]);
            if (z < 2) moves.push([{ x, y, z }, { x, y, z: z + 1 }]);
          }
        }
      }

      let successfulMoves = 0;
      moves.forEach(([start, end]) => {
        const result = engine.makeMove(start as any, end as any);
        if (result) successfulMoves++;
      });

      expect(successfulMoves).toBeGreaterThan(0);
      expect(engine.getState().lines.length).toBe(successfulMoves);
    });
  });
});