import { describe, it, expect } from 'vitest';
import {
  validateMove,
  getCompletedSquares,
  getClaimedCubes,
  calculateScore,
  checkWinCondition,
  shouldPlayerKeepTurn,
  getValidMoves,
  cloneGameState,
  applyMove
} from '../domain/GameRules';
import { GameState, Player } from '../core/types';
import { PLAYER_COLORS } from '../core/PlayerColors';

describe('GameRules - Pure Functions', () => {
  // Helper function to create a test game state
  function createTestState(): GameState {
    const player1: Player = {
      id: 'player1',
      name: 'Player 1',
      color: PLAYER_COLORS.PLAYER_1,
      score: 0,
      squareCount: 0
    };
    
    const player2: Player = {
      id: 'player2', 
      name: 'Player 2',
      color: '#0000FF',
      score: 0,
      squareCount: 0
    };
    
    return {
      gridSize: 3,
      currentPlayer: player1,
      players: [player1, player2],
      lines: [],
      squares: [],
      cubes: [],
      turn: 0,
      winner: null,
      gameMode: 'local'
    };
  }

  describe('validateMove', () => {
    it('should validate a legal move', () => {
      const state = createTestState();
      const result = validateMove(state, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject move with same start and end points', () => {
      const state = createTestState();
      const result = validateMove(state, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Start and end points must be different');
    });

    it('should reject move outside grid bounds', () => {
      const state = createTestState();
      const result = validateMove(state, { x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 });
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Points must be within grid bounds');
    });

    it('should reject non-adjacent points', () => {
      const state = createTestState();
      const result = validateMove(state, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 });
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Points must be adjacent');
    });

    it('should reject duplicate lines', () => {
      const state = createTestState();
      state.lines.push({
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
        player: state.currentPlayer
      });
      
      const result = validateMove(state, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Line already exists');
    });

    it('should reject moves after game is won', () => {
      const state = createTestState();
      state.winner = state.players[0];
      
      const result = validateMove(state, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Game is already over');
    });
  });

  describe('calculateScore', () => {
    it('should calculate correct scores for empty game', () => {
      const state = createTestState();
      const scores = calculateScore(state);
      
      expect(scores.player1Score).toBe(0);
      expect(scores.player2Score).toBe(0);
      expect(scores.player1Squares).toBe(0);
      expect(scores.player2Squares).toBe(0);
    });

    it('should count cubes correctly', () => {
      const state = createTestState();
      
      // Add some cubes
      state.cubes.push({
        position: { x: 0, y: 0, z: 0 },
        owner: state.players[0],
        faces: []
      });
      
      state.cubes.push({
        position: { x: 1, y: 0, z: 0 },
        owner: state.players[1],
        faces: []
      });
      
      state.cubes.push({
        position: { x: 0, y: 1, z: 0 },
        owner: state.players[0],
        faces: []
      });
      
      const scores = calculateScore(state);
      
      expect(scores.player1Score).toBe(2);
      expect(scores.player2Score).toBe(1);
    });

    it('should count squares without duplicates', () => {
      const state = createTestState();
      
      // Add squares
      const square1 = {
        corners: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 }
        ],
        player: state.players[0]
      };
      
      const square2 = {
        corners: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 0, z: 1 },
          { x: 0, y: 0, z: 1 }
        ],
        player: state.players[1]
      };
      
      state.squares.push(square1, square2);
      
      const scores = calculateScore(state);
      
      expect(scores.player1Squares).toBe(1);
      expect(scores.player2Squares).toBe(1);
    });
  });

  describe('checkWinCondition', () => {
    it('should return null for ongoing game', () => {
      const state = createTestState();
      const winner = checkWinCondition(state);
      
      expect(winner).toBeNull();
    });

    it('should declare winner when all cubes claimed', () => {
      const state = createTestState();
      
      // In a 3x3x3 grid, there are 2x2x2 = 8 cubes
      // Fill all 8 cubes
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          for (let z = 0; z < 2; z++) {
            state.cubes.push({
              position: { x, y, z },
              owner: x === 0 ? state.players[0] : state.players[1],
              faces: []
            });
          }
        }
      }
      
      // Player 1 has 4 cubes, Player 2 has 4 cubes - tie
      const winner = checkWinCondition(state);
      
      expect(winner).toBeDefined();
    });

    it('should handle ties by checking square count', () => {
      const state = createTestState();
      
      // Equal cubes but different square counts
      state.cubes.push({
        position: { x: 0, y: 0, z: 0 },
        owner: state.players[0],
        faces: []
      });
      
      state.cubes.push({
        position: { x: 1, y: 0, z: 0 },
        owner: state.players[1],
        faces: []
      });
      
      // Fill remaining cubes to end game
      for (let i = 2; i < 8; i++) {
        state.cubes.push({
          position: { x: i % 2, y: Math.floor(i / 2) % 2, z: Math.floor(i / 4) },
          owner: state.players[0],
          faces: []
        });
      }
      
      const winner = checkWinCondition(state);
      
      expect(winner).toBe(state.players[0]);
    });
  });

  describe('shouldPlayerKeepTurn', () => {
    it('should keep turn when squares are completed', () => {
      const squares = [{
        corners: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 }
        ],
        player: {} as Player
      }];
      
      const result = shouldPlayerKeepTurn(squares, []);
      expect(result).toBe(true);
    });

    it('should keep turn when cubes are claimed', () => {
      const cubes = [{
        position: { x: 0, y: 0, z: 0 },
        owner: {} as Player,
        faces: []
      }];
      
      const result = shouldPlayerKeepTurn([], cubes);
      expect(result).toBe(true);
    });

    it('should not keep turn when nothing is completed', () => {
      const result = shouldPlayerKeepTurn([], []);
      expect(result).toBe(false);
    });
  });

  describe('cloneGameState', () => {
    it('should create a deep copy of the game state', () => {
      const state = createTestState();
      state.lines.push({
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
        player: state.currentPlayer
      });
      
      const cloned = cloneGameState(state);
      
      // Modify original
      state.lines[0].start.x = 2;
      state.currentPlayer.name = 'Modified';
      
      // Check cloned is unchanged
      expect(cloned.lines[0].start.x).toBe(0);
      expect(cloned.currentPlayer.name).toBe('Player 1');
    });
  });

  describe('applyMove', () => {
    it('should return new state without mutating original', () => {
      const state = createTestState();
      const originalLineCount = state.lines.length;
      const originalTurn = state.turn;
      
      const newState = applyMove(state, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      // Original unchanged
      expect(state.lines.length).toBe(originalLineCount);
      expect(state.turn).toBe(originalTurn);
      
      // New state updated
      expect(newState.lines.length).toBe(originalLineCount + 1);
      expect(newState.turn).toBe(originalTurn + 1);
    });

    it('should add the line to the state', () => {
      const state = createTestState();
      const newState = applyMove(state, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      expect(newState.lines.length).toBe(1);
      expect(newState.lines[0].start).toEqual({ x: 0, y: 0, z: 0 });
      expect(newState.lines[0].end).toEqual({ x: 1, y: 0, z: 0 });
      expect(newState.lines[0].player.id).toBe(state.currentPlayer.id);
    });

    it('should set lastMove correctly', () => {
      const state = createTestState();
      const newState = applyMove(state, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      expect(newState.lastMove).toBeDefined();
      expect(newState.lastMove?.start).toEqual({ x: 0, y: 0, z: 0 });
      expect(newState.lastMove?.end).toEqual({ x: 1, y: 0, z: 0 });
      expect(newState.lastMove?.player).toBe(state.currentPlayer);
    });

    it('should switch players when no squares completed', () => {
      const state = createTestState();
      const player1 = state.currentPlayer;
      
      const newState = applyMove(state, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      
      expect(newState.currentPlayer.id).not.toBe(player1.id);
      expect(newState.currentPlayer.id).toBe(state.players[1].id);
    });
  });

  describe('getValidMoves', () => {
    it('should return all valid moves for empty board', () => {
      const state = createTestState();
      const moves = getValidMoves(state);
      
      // In a 3x3x3 grid, there are many possible lines
      expect(moves.length).toBeGreaterThan(0);
      
      // All moves should be valid
      for (const move of moves) {
        const validation = validateMove(state, move.start, move.end);
        expect(validation.valid).toBe(true);
      }
    });

    it('should exclude existing lines', () => {
      const state = createTestState();
      
      // Add a line
      state.lines.push({
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
        player: state.currentPlayer
      });
      
      const moves = getValidMoves(state);
      
      // Should not include the existing line
      const hasExisting = moves.some(m => 
        (m.start.x === 0 && m.start.y === 0 && m.start.z === 0 &&
         m.end.x === 1 && m.end.y === 0 && m.end.z === 0) ||
        (m.start.x === 1 && m.start.y === 0 && m.start.z === 0 &&
         m.end.x === 0 && m.end.y === 0 && m.end.z === 0)
      );
      
      expect(hasExisting).toBe(false);
    });

    it('should return empty array when game is won', () => {
      const state = createTestState();
      state.winner = state.players[0];
      
      const moves = getValidMoves(state);
      
      expect(moves.length).toBe(0);
    });
  });
});