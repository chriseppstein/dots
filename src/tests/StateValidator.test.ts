import { describe, it, expect, beforeEach } from 'vitest';
import { StateValidator, ValidationResult } from '../core/StateValidator';
import { GameState, Player, Line, Cube } from '../core/types';

describe('StateValidator', () => {
  let validState: GameState;
  
  beforeEach(() => {
    // Create a valid base state for testing
    const player1: Player = {
      id: 'player1',
      name: 'Alice',
      color: '#FF0000',
      score: 0,
      squareCount: 0
    };
    
    const player2: Player = {
      id: 'player2',
      name: 'Bob',
      color: '#0000FF',
      score: 0,
      squareCount: 0,
      isAI: false
    };
    
    validState = {
      gridSize: 3,
      currentPlayer: player1,
      players: [player1, player2],
      lines: [],
      cubes: createCubes(3),
      gameMode: 'local',
      winner: null,
      turn: 0
    };
  });
  
  function createCubes(gridSize: number): Cube[] {
    const cubes: Cube[] = [];
    const size = gridSize - 1;
    
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          cubes.push({
            position: { x, y, z },
            faces: Array(6).fill(null).map(() => ({
              lines: [],
              player: null
            })),
            owner: null
          });
        }
      }
    }
    
    return cubes;
  }
  
  describe('Basic State Validation', () => {
    it('should validate a correct initial state', () => {
      const result = StateValidator.validate(validState);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject null state', () => {
      const result = StateValidator.validate(null as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'NULL_STATE')).toBe(true);
    });
    
    it('should reject state with wrong number of players', () => {
      const invalidState = { ...validState, players: [validState.players[0]] };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PLAYER_COUNT')).toBe(true);
    });
    
    it('should reject state with no current player', () => {
      const invalidState = { ...validState, currentPlayer: null as any };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'NO_CURRENT_PLAYER')).toBe(true);
    });
    
    it('should reject invalid grid size', () => {
      const invalidState = { ...validState, gridSize: 10 };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_GRID_SIZE')).toBe(true);
    });
  });
  
  describe('Player Validation', () => {
    it('should reject duplicate player IDs', () => {
      const invalidState = {
        ...validState,
        players: [
          { ...validState.players[0], id: 'same' },
          { ...validState.players[1], id: 'same' }
        ]
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_PLAYER_ID')).toBe(true);
    });
    
    it('should reject negative scores', () => {
      const invalidState = {
        ...validState,
        players: [
          { ...validState.players[0], score: -1 },
          validState.players[1]
        ]
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_PLAYER_SCORE')).toBe(true);
    });
    
    it('should reject current player not in game', () => {
      const invalidState = {
        ...validState,
        currentPlayer: { ...validState.currentPlayer, id: 'unknown' }
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'CURRENT_PLAYER_NOT_IN_GAME')).toBe(true);
    });
  });
  
  describe('Line Validation', () => {
    it('should accept valid unit-length lines', () => {
      const stateWithLine = {
        ...validState,
        lines: [{
          start: { x: 0, y: 0, z: 0 },
          end: { x: 1, y: 0, z: 0 },
          player: validState.players[0]
        }]
      };
      const result = StateValidator.validate(stateWithLine);
      expect(result.valid).toBe(true);
    });
    
    it('should reject non-unit-length lines', () => {
      const invalidState = {
        ...validState,
        lines: [{
          start: { x: 0, y: 0, z: 0 },
          end: { x: 2, y: 0, z: 0 }, // Distance = 2
          player: validState.players[0]
        }]
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_LINE_LENGTH')).toBe(true);
    });
    
    it('should reject duplicate lines', () => {
      const line = {
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
        player: validState.players[0]
      };
      const invalidState = {
        ...validState,
        lines: [line, line]
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_LINE')).toBe(true);
    });
    
    it('should reject lines out of bounds', () => {
      const invalidState = {
        ...validState,
        lines: [{
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 0, z: 5 }, // Out of bounds for 3x3x3 grid
          player: validState.players[0]
        }]
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'LINE_OUT_OF_BOUNDS')).toBe(true);
    });
  });
  
  describe('Cube Validation', () => {
    it('should validate correct cube count', () => {
      const result = StateValidator.validate(validState);
      expect(result.errors.some(e => e.code === 'INCORRECT_CUBE_COUNT')).toBe(false);
    });
    
    it('should reject incorrect cube count', () => {
      const invalidState = {
        ...validState,
        cubes: validState.cubes.slice(0, 5) // Should have 8 cubes for 3x3x3
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INCORRECT_CUBE_COUNT')).toBe(true);
    });
    
    it('should reject cube ownership without enough faces', () => {
      const invalidState = {
        ...validState,
        cubes: [{
          ...validState.cubes[0],
          owner: validState.players[0], // Claiming cube
          faces: validState.cubes[0].faces.map((face, index) => ({
            ...face,
            player: index < 3 ? validState.players[0] : null // Only 3 faces owned
          }))
        }, ...validState.cubes.slice(1)]
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_CUBE_OWNERSHIP')).toBe(true);
    });
  });
  
  describe('Score Validation', () => {
    it('should validate matching scores', () => {
      const stateWithScores = {
        ...validState,
        players: [
          { ...validState.players[0], score: 1 },
          { ...validState.players[1], score: 0 }
        ],
        cubes: [
          { ...validState.cubes[0], owner: validState.players[0] },
          ...validState.cubes.slice(1)
        ]
      };
      const result = StateValidator.validate(stateWithScores);
      expect(result.errors.some(e => e.code === 'SCORE_MISMATCH')).toBe(false);
    });
    
    it('should reject mismatched scores', () => {
      const invalidState = {
        ...validState,
        players: [
          { ...validState.players[0], score: 5 }, // Claims 5 cubes
          validState.players[1]
        ],
        cubes: validState.cubes // But no cubes are owned
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'SCORE_MISMATCH')).toBe(true);
    });
  });
  
  describe('State Transition Validation', () => {
    it('should accept valid move transition', () => {
      const afterState = {
        ...validState,
        lines: [{
          start: { x: 0, y: 0, z: 0 },
          end: { x: 1, y: 0, z: 0 },
          player: validState.players[0]
        }],
        turn: 1
      };
      
      const result = StateValidator.validateTransition(
        validState,
        afterState,
        { type: 'MAKE_MOVE' }
      );
      expect(result.valid).toBe(true);
    });
    
    it('should reject turn going backward', () => {
      const beforeState = { ...validState, turn: 5 };
      const afterState = { ...validState, turn: 3 };
      
      const result = StateValidator.validateTransition(
        beforeState,
        afterState,
        { type: 'MAKE_MOVE' }
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'TURN_WENT_BACKWARD')).toBe(true);
    });
    
    it('should reject lines being removed', () => {
      const line = {
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
        player: validState.players[0]
      };
      const beforeState = { ...validState, lines: [line] };
      const afterState = { ...validState, lines: [] };
      
      const result = StateValidator.validateTransition(
        beforeState,
        afterState,
        { type: 'MAKE_MOVE' }
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'LINES_REMOVED')).toBe(true);
    });
    
    it('should reject score decreasing', () => {
      const beforeState = {
        ...validState,
        players: [
          { ...validState.players[0], score: 5 },
          validState.players[1]
        ]
      };
      const afterState = {
        ...validState,
        players: [
          { ...validState.players[0], score: 3 },
          validState.players[1]
        ]
      };
      
      const result = StateValidator.validateTransition(
        beforeState,
        afterState,
        { type: 'MAKE_MOVE' }
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'SCORE_DECREASED')).toBe(true);
    });
    
    it('should reject winner changing', () => {
      const beforeState = {
        ...validState,
        winner: validState.players[0]
      };
      const afterState = {
        ...validState,
        winner: validState.players[1]
      };
      
      const result = StateValidator.validateTransition(
        beforeState,
        afterState,
        { type: 'MAKE_MOVE' }
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'WINNER_CHANGED')).toBe(true);
    });
  });
  
  describe('Invariant Validation', () => {
    it('should enforce cube count invariant', () => {
      const invalidState = {
        ...validState,
        gridSize: 4, // 4x4x4 grid should have 27 cubes
        cubes: createCubes(3) // But only has 8 cubes
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'CUBE_COUNT_INVARIANT')).toBe(true);
    });
    
    it('should enforce score sum invariant', () => {
      const invalidState = {
        ...validState,
        players: [
          { ...validState.players[0], score: 5 },
          { ...validState.players[1], score: 5 }
        ],
        cubes: createCubes(3) // Only 8 cubes total, but players claim 10
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'SCORE_INVARIANT')).toBe(true);
    });
    
    it('should enforce maximum lines invariant', () => {
      // For a 3x3x3 grid, max lines = 3 * 3 * (3-1)² = 3 * 3 * 4 = 36
      const lines: Line[] = [];
      for (let i = 0; i < 50; i++) {
        lines.push({
          start: { x: 0, y: 0, z: 0 },
          end: { x: 1, y: 0, z: 0 },
          player: validState.players[0]
        });
      }
      
      const invalidState = {
        ...validState,
        lines
      };
      const result = StateValidator.validate(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'TOO_MANY_LINES')).toBe(true);
    });
  });
  
  describe('Warning Detection', () => {
    it('should warn about turn/line count mismatch', () => {
      const stateWithMismatch = {
        ...validState,
        turn: 2,
        lines: Array(10).fill(null).map((_, i) => ({
          start: { x: 0, y: 0, z: i % 3 },
          end: { x: 1, y: 0, z: i % 3 },
          player: validState.players[i % 2]
        }))
      };
      const result = StateValidator.validate(stateWithMismatch);
      expect(result.warnings.some(w => w.code === 'TURN_LINE_MISMATCH')).toBe(true);
    });
    
    it('should warn about questionable win', () => {
      const stateWithQuestionableWin = {
        ...validState,
        winner: validState.players[0],
        players: [
          { ...validState.players[0], score: 2 }, // Only 2 of 8 cubes
          { ...validState.players[1], score: 1 }
        ],
        cubes: [
          { ...validState.cubes[0], owner: validState.players[0] },
          { ...validState.cubes[1], owner: validState.players[0] },
          { ...validState.cubes[2], owner: validState.players[1] },
          ...validState.cubes.slice(3)
        ]
      };
      const result = StateValidator.validate(stateWithQuestionableWin);
      expect(result.warnings.some(w => w.code === 'QUESTIONABLE_WIN')).toBe(true);
    });
  });
});