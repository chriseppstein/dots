import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../core/GameEngine';
import { Point3D, Line } from '../core/types';

describe('Line Validation and Detection', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(4, 'local');
  });

  describe('Valid Line Patterns', () => {
    it('should accept horizontal lines along X axis', () => {
      const testCases: [Point3D, Point3D][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 1, y: 1, z: 1 }, { x: 2, y: 1, z: 1 }],
        [{ x: 2, y: 2, z: 2 }, { x: 3, y: 2, z: 2 }],
      ];

      testCases.forEach(([start, end]) => {
        const result = engine.makeMove(start, end);
        expect(result).toBe(true);
      });
    });

    it('should accept vertical lines along Y axis', () => {
      const testCases: [Point3D, Point3D][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],
        [{ x: 1, y: 1, z: 1 }, { x: 1, y: 2, z: 1 }],
        [{ x: 2, y: 2, z: 2 }, { x: 2, y: 3, z: 2 }],
      ];

      testCases.forEach(([start, end]) => {
        const result = engine.makeMove(start, end);
        expect(result).toBe(true);
      });
    });

    it('should accept depth lines along Z axis', () => {
      const testCases: [Point3D, Point3D][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }],
        [{ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 2 }],
        [{ x: 2, y: 2, z: 2 }, { x: 2, y: 2, z: 3 }],
      ];

      testCases.forEach(([start, end]) => {
        const result = engine.makeMove(start, end);
        expect(result).toBe(true);
      });
    });

    it('should accept lines in reverse order', () => {
      const result1 = engine.makeMove({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
      expect(result1).toBe(true);
      
      const result2 = engine.makeMove({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
      expect(result2).toBe(true);
    });
  });

  describe('Invalid Line Patterns', () => {
    it('should reject 2D diagonal lines', () => {
      const testCases: [Point3D, Point3D][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }], // XY diagonal
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }], // XZ diagonal
        [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 1 }], // YZ diagonal
      ];

      testCases.forEach(([start, end]) => {
        const result = engine.makeMove(start, end);
        expect(result).toBe(false);
      });
    });

    it('should reject 3D diagonal lines', () => {
      const result = engine.makeMove(
        { x: 0, y: 0, z: 0 }, 
        { x: 1, y: 1, z: 1 }
      );
      expect(result).toBe(false);
    });

    it('should reject lines longer than 1 unit', () => {
      const testCases: [Point3D, Point3D][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }], // Length 2 in X
        [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }], // Length 2 in Y
        [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }], // Length 2 in Z
        [{ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }], // Length 3 in X
      ];

      testCases.forEach(([start, end]) => {
        const result = engine.makeMove(start, end);
        expect(result).toBe(false);
      });
    });

    it('should reject zero-length lines (same point)', () => {
      const result = engine.makeMove(
        { x: 1, y: 1, z: 1 }, 
        { x: 1, y: 1, z: 1 }
      );
      expect(result).toBe(false);
    });
  });

  describe('Boundary Validation', () => {
    it('should accept lines on grid boundaries', () => {
      const gridSize = 4;
      const maxIndex = gridSize - 1;
      
      // Lines on the edges of the grid
      const edgeLines: [Point3D, Point3D][] = [
        // Bottom face edges
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],
        [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }],
        
        // Top face edges
        [{ x: maxIndex - 1, y: maxIndex, z: maxIndex }, { x: maxIndex, y: maxIndex, z: maxIndex }],
        [{ x: maxIndex, y: maxIndex - 1, z: maxIndex }, { x: maxIndex, y: maxIndex, z: maxIndex }],
        [{ x: maxIndex, y: maxIndex, z: maxIndex - 1 }, { x: maxIndex, y: maxIndex, z: maxIndex }],
      ];

      edgeLines.forEach(([start, end]) => {
        const result = engine.makeMove(start, end);
        expect(result).toBe(true);
      });
    });

    it('should reject lines outside grid boundaries', () => {
      const invalidLines: [Point3D, Point3D][] = [
        [{ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
        [{ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }],
        [{ x: 4, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }],
        [{ x: 0, y: 4, z: 0 }, { x: 0, y: 5, z: 0 }],
        [{ x: 0, y: 0, z: 4 }, { x: 0, y: 0, z: 5 }],
      ];

      invalidLines.forEach(([start, end]) => {
        const result = engine.makeMove(start, end);
        expect(result).toBe(false);
      });
    });

    it('should reject partially out-of-bounds lines', () => {
      const result1 = engine.makeMove({ x: 3, y: 3, z: 3 }, { x: 4, y: 3, z: 3 });
      expect(result1).toBe(false);
      
      const result2 = engine.makeMove({ x: 3, y: 3, z: 3 }, { x: 3, y: 4, z: 3 });
      expect(result2).toBe(false);
    });
  });

  describe('Line Duplication Detection', () => {
    it('should detect exact duplicate lines', () => {
      const start = { x: 1, y: 1, z: 1 };
      const end = { x: 2, y: 1, z: 1 };
      
      const result1 = engine.makeMove(start, end);
      expect(result1).toBe(true);
      
      const result2 = engine.makeMove(start, end);
      expect(result2).toBe(false);
    });

    it('should detect reversed duplicate lines', () => {
      const point1 = { x: 1, y: 2, z: 1 };
      const point2 = { x: 2, y: 2, z: 1 };
      
      const result1 = engine.makeMove(point1, point2);
      expect(result1).toBe(true);
      
      const result2 = engine.makeMove(point2, point1);
      expect(result2).toBe(false);
    });

    it('should allow adjacent lines sharing a point', () => {
      const sharedPoint = { x: 1, y: 1, z: 1 };
      
      const result1 = engine.makeMove(sharedPoint, { x: 2, y: 1, z: 1 });
      expect(result1).toBe(true);
      
      const result2 = engine.makeMove(sharedPoint, { x: 1, y: 2, z: 1 });
      expect(result2).toBe(true);
      
      const result3 = engine.makeMove(sharedPoint, { x: 1, y: 1, z: 2 });
      expect(result3).toBe(true);
      
      const result4 = engine.makeMove(sharedPoint, { x: 0, y: 1, z: 1 });
      expect(result4).toBe(true);
    });
  });

  describe('getPossibleMoves', () => {
    it('should return correct number of possible moves for different grid sizes', () => {
      const testCases: { size: number; expectedMoves: number }[] = [
        { size: 3, expectedMoves: 54 },  // 3*2*3 + 2*3*3 + 3*3*2 = 18+18+18
        { size: 4, expectedMoves: 144 }, // 4*3*4 + 3*4*4 + 4*4*3 = 48+48+48
        { size: 5, expectedMoves: 300 }, // 5*4*5 + 4*5*5 + 5*5*4 = 100+100+100
      ];

      testCases.forEach(({ size, expectedMoves }) => {
        const testEngine = new GameEngine(size as any, 'local');
        const moves = testEngine.getPossibleMoves();
        expect(moves).toHaveLength(expectedMoves);
      });
    });

    it('should only return undrawn lines', () => {
      const allMoves = engine.getPossibleMoves();
      const initialCount = allMoves.length;
      
      // Draw some lines
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
      engine.makeMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
      
      const remainingMoves = engine.getPossibleMoves();
      expect(remainingMoves).toHaveLength(initialCount - 3);
      
      // Verify the drawn lines are not in possible moves
      const drawnLine1 = { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 }, player: null };
      const hasDrawnLine = remainingMoves.some(move => 
        (move.start.x === drawnLine1.start.x && move.start.y === drawnLine1.start.y && 
         move.start.z === drawnLine1.start.z && move.end.x === drawnLine1.end.x && 
         move.end.y === drawnLine1.end.y && move.end.z === drawnLine1.end.z)
      );
      
      expect(hasDrawnLine).toBe(false);
    });

    it('should return valid Line objects', () => {
      const moves = engine.getPossibleMoves();
      
      moves.forEach(move => {
        expect(move).toHaveProperty('start');
        expect(move).toHaveProperty('end');
        expect(move).toHaveProperty('player');
        expect(move.player).toBeNull();
        
        // Verify it's a unit length line
        const dx = Math.abs(move.end.x - move.start.x);
        const dy = Math.abs(move.end.y - move.start.y);
        const dz = Math.abs(move.end.z - move.start.z);
        expect(dx + dy + dz).toBe(1);
      });
    });
  });
});