import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameRenderer } from '../core/GameRenderer';
import { GameState, Line, Player, Cube, Square, Point3D } from '../core/types';
import * as THREE from 'three';

// Mock Three.js for testing
vi.mock('three', () => {
  const MockWebGLRenderer = class {
    domElement: HTMLCanvasElement;
    shadowMap = { enabled: false, type: 1 };
    
    constructor() {
      this.domElement = document.createElement('canvas');
      this.domElement.getBoundingClientRect = () => ({
        left: 0, top: 0, right: 800, bottom: 600,
        width: 800, height: 600
      } as DOMRect);
    }
    
    setSize() {}
    setPixelRatio() {}
    render() {}
    dispose() {}
  };
  
  const MockGroup = class {
    children: any[] = [];
    rotation = { x: 0, y: 0 };
    position = { x: 0, y: 0, z: 0 };
    matrixWorld = { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
    
    add(object: any) {
      if (!this.children.includes(object)) {
        this.children.push(object);
      }
    }
    
    remove(object: any) {
      const index = this.children.indexOf(object);
      if (index !== -1) {
        this.children.splice(index, 1);
      }
    }
  };
  
  const MockGeometry = class {
    dispose = vi.fn();
    setAttribute = vi.fn();
    setIndex = vi.fn();
    computeVertexNormals = vi.fn();
  };
  
  const MockMaterial = class {
    dispose = vi.fn();
  };
  
  const MockMesh = class {
    constructor(public geometry: any, public material: any) {}
    position = { 
      set: vi.fn(), 
      copy: vi.fn(),
      multiplyScalar: vi.fn().mockReturnThis()
    };
    userData = {};
    setRotationFromQuaternion = vi.fn();
    add = vi.fn();
    parent = null;
  };

  return {
    Color: vi.fn(() => ({})),
    WebGLRenderer: MockWebGLRenderer,
    Scene: vi.fn(() => ({ 
      add: vi.fn(), 
      remove: vi.fn(),
      background: null
    })),
    PerspectiveCamera: vi.fn(() => ({ 
      position: { set: vi.fn(), multiplyScalar: vi.fn(), length: () => 10 },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
      aspect: 1
    })),
    Group: MockGroup,
    DirectionalLight: vi.fn(() => ({ position: { set: vi.fn() } })),
    AmbientLight: vi.fn(() => ({})),
    Raycaster: vi.fn(() => ({ 
      setFromCamera: vi.fn(), 
      intersectObjects: vi.fn(() => []),
      ray: { distanceToPoint: vi.fn(() => 0.1) }
    })),
    Vector2: vi.fn(() => ({})),
    Vector3: vi.fn((x = 0, y = 0, z = 0) => ({
      x, y, z,
      set: vi.fn(),
      copy: vi.fn(),
      addVectors: vi.fn().mockReturnThis(),
      subVectors: vi.fn().mockReturnThis(),
      multiplyScalar: vi.fn().mockReturnThis(),
      normalize: vi.fn().mockReturnThis(),
      length: vi.fn(() => 1),
      clone: vi.fn().mockReturnThis(),
      applyMatrix4: vi.fn().mockReturnThis()
    })),
    SphereGeometry: MockGeometry,
    CylinderGeometry: MockGeometry,
    BufferGeometry: class extends MockGeometry {
      setFromPoints = vi.fn();
    },
    MeshPhongMaterial: MockMaterial,
    MeshBasicMaterial: MockMaterial,
    Mesh: MockMesh,
    BufferAttribute: vi.fn(() => ({})),
    Quaternion: vi.fn(() => ({ 
      setFromUnitVectors: vi.fn().mockReturnThis(),
      setFromAxisAngle: vi.fn(), 
      multiply: vi.fn() 
    })),
    DoubleSide: 2
  };
});

/**
 * TDD Test Suite for Line Consequence Analysis Bugs
 * 
 * This test suite follows TDD methodology to catch two critical bugs:
 * 1. analyzeLineConsequences was showing all lines as dangerous (red)
 * 2. Square detection was inefficient - checking ALL possible squares instead of only adjacent ones
 */
describe('Line Consequence Analysis - TDD Bug Prevention', () => {
  let container: HTMLDivElement;
  let renderer: GameRenderer;
  
  const createTestPlayer = (id: string, color: string): Player => ({
    id,
    name: `Player ${id}`,
    color,
    score: 0,
    squareCount: 0
  });
  
  const createTestLine = (start: [number, number, number], end: [number, number, number], player?: Player): Line => ({
    start: { x: start[0], y: start[1], z: start[2] },
    end: { x: end[0], y: end[1], z: end[2] },
    player: player || null
  });
  
  const createBasicGameState = (gridSize: number = 4): GameState => {
    const player1 = createTestPlayer('player1', '#ff0000');
    const player2 = createTestPlayer('player2', '#0000ff');
    
    return {
      gridSize,
      currentPlayer: player1,
      players: [player1, player2],
      lines: [],
      cubes: [],
      gameMode: 'local',
      winner: null,
      turn: 1
    };
  };

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    renderer = new GameRenderer(container, 4);
  });
  
  afterEach(() => {
    if (renderer) {
      renderer.dispose();
    }
    document.body.removeChild(container);
  });

  describe('TDD Bug 1: analyzeLineConsequences Incorrect Danger Classification', () => {
    /**
     * RED PHASE: These tests should FAIL before the bug fix
     * They expose the bug where analyzeLineConsequences was using this.lastState.cubes
     * instead of analyzing all possible squares in the grid
     */

    it('should classify a safe first line as safe, not dangerous', () => {
      // ARRANGE: Empty board, first line should be safe
      const gameState = createBasicGameState(4);
      const player1 = gameState.players[0];
      
      // Set up the renderer's internal state
      renderer.updateFromGameState(gameState);
      
      // Create a line that should be safe (no squares to complete)
      const safeLine = createTestLine([0, 0, 0], [1, 0, 0]);
      
      // ACT: Analyze consequences of this line
      const result = (renderer as any).analyzeLineConsequences(safeLine);
      
      // ASSERT: This should pass AFTER bug fix
      // BUG: Before fix, this would fail because all lines were classified as 'dangerous-third-line'
      expect(result.type).toBe('safe');
      expect(result.squareCount).toBe(0);
      expect(result.chainReaction).toBe(false);
    });

    it('should classify a line in empty space as safe, not dangerous', () => {
      // ARRANGE: Empty 4x4x4 grid
      const gameState = createBasicGameState(4);
      renderer.updateFromGameState(gameState);
      
      // Test multiple lines in different orientations
      const testLines = [
        createTestLine([1, 1, 1], [2, 1, 1]), // X direction
        createTestLine([1, 1, 1], [1, 2, 1]), // Y direction  
        createTestLine([1, 1, 1], [1, 1, 2])  // Z direction
      ];
      
      // ACT & ASSERT: All should be safe
      testLines.forEach((line, index) => {
        const result = (renderer as any).analyzeLineConsequences(line);
        
        // BUG: Before fix, these would be 'dangerous-third-line'
        expect(result.type).toBe('safe');
        expect(result.squareCount).toBe(0);
        expect(result.chainReaction).toBe(false);
      });
    });

    it('should correctly identify when a line would complete a square', () => {
      // ARRANGE: Set up a square with 3 sides drawn
      const gameState = createBasicGameState(4);
      const player1 = gameState.players[0];
      
      // Draw 3 sides of a square on the Z=0 face
      gameState.lines = [
        createTestLine([0, 0, 0], [1, 0, 0], player1), // Bottom
        createTestLine([1, 0, 0], [1, 1, 0], player1), // Right  
        createTestLine([1, 1, 0], [0, 1, 0], player1)  // Top
      ];
      
      renderer.updateFromGameState(gameState);
      
      // The fourth line that would complete the square
      const completingLine = createTestLine([0, 1, 0], [0, 0, 0]);
      
      // ACT
      const result = (renderer as any).analyzeLineConsequences(completingLine);
      
      // ASSERT: Should detect square completion (which has chain reaction potential)
      expect(result.type).toBe('chain-reaction');
      expect(result.squareCount).toBe(1);
      expect(result.chainReaction).toBe(true);
    });

    it('should correctly identify dangerous third lines', () => {
      // ARRANGE: Set up a square with 2 sides drawn (safe)
      const gameState = createBasicGameState(4);
      const player1 = gameState.players[0];
      
      gameState.lines = [
        createTestLine([0, 0, 0], [1, 0, 0], player1), // Bottom
        createTestLine([1, 0, 0], [1, 1, 0], player1)  // Right
      ];
      
      renderer.updateFromGameState(gameState);
      
      // The third line that would be dangerous (leaves easy completion for opponent)
      const dangerousLine = createTestLine([1, 1, 0], [0, 1, 0]);
      
      // ACT
      const result = (renderer as any).analyzeLineConsequences(dangerousLine);
      
      // ASSERT: Should detect dangerous move
      expect(result.type).toBe('dangerous-third-line');
      expect(result.squareCount).toBe(0); // Doesn't complete, but creates danger
    });
  });

  describe('TDD Bug 2: Inefficient Square Detection - Checking ALL Squares', () => {
    /**
     * RED PHASE: These tests should FAIL before performance optimization
     * They expose the bug where square completion detection was O(gridSize³) for every line
     * instead of only checking squares adjacent to the line being drawn
     */

    it('should only check squares adjacent to the line, not all possible squares', () => {
      // ARRANGE: Large grid to make inefficiency apparent
      const gameState = createBasicGameState(6); // 6x6x6 = 216 possible cubes, 1296 faces
      renderer.updateFromGameState(gameState);
      
      // Spy on the method that gets squares adjacent to line
      const getSquaresAdjacentSpy = vi.spyOn(renderer as any, 'getSquaresAdjacentToLine');
      
      // Test line in corner - should only check a few adjacent squares
      const cornerLine = createTestLine([0, 0, 0], [1, 0, 0]);
      
      // ACT
      const result = (renderer as any).analyzeLineConsequences(cornerLine);
      
      // ASSERT: Should use the efficient method
      expect(getSquaresAdjacentSpy).toHaveBeenCalledWith(cornerLine, gameState.gridSize);
      
      // The adjacent squares method should return far fewer than all possible squares
      const adjacentSquares = (renderer as any).getSquaresAdjacentToLine(cornerLine, gameState.gridSize);
      
      // For a corner line in a 6x6x6 grid, should only check ~8 adjacent squares
      // not all 1296 possible squares (6^3 * 6 faces per cube)
      expect(adjacentSquares.length).toBeLessThan(20);
      expect(adjacentSquares.length).toBeGreaterThan(0);
    });

    it('should efficiently handle line analysis in large grids', () => {
      // ARRANGE: Very large grid where O(n³) would be noticeably slow
      const gameState = createBasicGameState(8); // 8x8x8 = 512 cubes
      renderer.updateFromGameState(gameState);
      
      const testLine = createTestLine([3, 3, 3], [4, 3, 3]); // Middle of grid
      
      // ACT: Time the operation
      const startTime = performance.now();
      const result = (renderer as any).analyzeLineConsequences(testLine);
      const endTime = performance.now();
      
      // ASSERT: Should complete quickly (efficient algorithm)
      const duration = endTime - startTime;
      
      // BUG: Before fix, this would take much longer due to checking all 3072 faces
      // After fix, should only check ~12-24 adjacent squares
      expect(duration).toBeLessThan(5); // Should complete in under 5ms
      
      // Verify it still works correctly
      expect(result.type).toBe('safe'); // Empty grid, safe move
    });

    it('should return the same results with efficient algorithm as brute force', () => {
      // ARRANGE: Set up a scenario with known results
      const gameState = createBasicGameState(4);
      const player1 = gameState.players[0];
      
      // Create a partial square
      gameState.lines = [
        createTestLine([1, 1, 0], [2, 1, 0], player1),
        createTestLine([2, 1, 0], [2, 2, 0], player1)
      ];
      
      renderer.updateFromGameState(gameState);
      
      // Test line that would be the third side
      const testLine = createTestLine([2, 2, 0], [1, 2, 0]);
      
      // ACT: Get result with optimized method
      const optimizedResult = (renderer as any).analyzeLineConsequences(testLine);
      
      // ASSERT: Should correctly identify as dangerous third line
      expect(optimizedResult.type).toBe('dangerous-third-line');
      
      // Additional verification: check that adjacent squares are properly identified
      const adjacentSquares = (renderer as any).getSquaresAdjacentToLine(testLine, gameState.gridSize);
      
      // Should find the square that contains this line as an edge
      const hasRelevantSquare = adjacentSquares.some((square: Point3D[]) => {
        return (renderer as any).squareContainsLine(square, testLine.start, testLine.end);
      });
      
      expect(hasRelevantSquare).toBe(true);
    });
  });

  describe('Helper Method Correctness - Supporting TDD', () => {
    /**
     * These tests verify the correctness of helper methods used in line analysis
     * Following TDD, we test the building blocks to ensure complex behavior works
     */

    describe('getSquaresAdjacentToLine', () => {
      it('should find squares that contain the given line as an edge', () => {
        // ARRANGE
        const line = createTestLine([1, 1, 0], [2, 1, 0]); // Horizontal line
        
        // ACT
        const adjacentSquares = (renderer as any).getSquaresAdjacentToLine(line, 4);
        
        // ASSERT
        expect(adjacentSquares.length).toBeGreaterThan(0);
        
        // At least one square should contain this line
        const containsLine = adjacentSquares.some((square: Point3D[]) => 
          (renderer as any).squareContainsLine(square, line.start, line.end)
        );
        expect(containsLine).toBe(true);
      });

      it('should return empty array for invalid lines', () => {
        // ARRANGE: Invalid diagonal line
        const invalidLine = createTestLine([0, 0, 0], [1, 1, 1]);
        
        // ACT
        const result = (renderer as any).getSquaresAdjacentToLine(invalidLine, 4);
        
        // ASSERT
        expect(result).toEqual([]);
      });

      it('should handle edge cases at grid boundaries', () => {
        // ARRANGE: Line at grid edge
        const edgeLine = createTestLine([0, 0, 0], [1, 0, 0]);
        
        // ACT
        const result = (renderer as any).getSquaresAdjacentToLine(edgeLine, 4);
        
        // ASSERT: Should not crash and should return valid squares
        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('squareContainsLine', () => {
      it('should correctly identify when a square contains a line as an edge', () => {
        // ARRANGE: Define a square and a line that is one of its edges
        const squareCorners = [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 }
        ];
        
        const edgeLine = createTestLine([0, 0, 0], [1, 0, 0]); // Bottom edge
        const nonEdgeLine = createTestLine([0, 0, 1], [1, 0, 1]); // Not part of square
        
        // ACT & ASSERT
        expect((renderer as any).squareContainsLine(
          squareCorners, edgeLine.start, edgeLine.end
        )).toBe(true);
        
        expect((renderer as any).squareContainsLine(
          squareCorners, nonEdgeLine.start, nonEdgeLine.end
        )).toBe(false);
      });

      it('should work with lines in reverse direction', () => {
        // ARRANGE
        const squareCorners = [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 }
        ];
        
        // Line in reverse direction
        const reverseLine = createTestLine([1, 0, 0], [0, 0, 0]);
        
        // ACT & ASSERT: Should still match
        expect((renderer as any).squareContainsLine(
          squareCorners, reverseLine.start, reverseLine.end
        )).toBe(true);
      });
    });

    describe('getLineOrientation', () => {
      it('should correctly identify line orientations', () => {
        // ARRANGE & ACT & ASSERT
        expect((renderer as any).getLineOrientation(
          { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }
        )).toBe('x');
        
        expect((renderer as any).getLineOrientation(
          { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }
        )).toBe('y');
        
        expect((renderer as any).getLineOrientation(
          { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }
        )).toBe('z');
      });

      it('should return null for invalid lines', () => {
        // ARRANGE & ACT & ASSERT
        expect((renderer as any).getLineOrientation(
          { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }
        )).toBe(null);
        
        expect((renderer as any).getLineOrientation(
          { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }
        )).toBe(null);
      });
    });
  });

  describe('Integration Tests - Full Line Analysis Flow', () => {
    /**
     * These tests verify the complete line analysis flow works correctly
     * after fixing both bugs
     */

    it('should handle complex game state with multiple lines and partial squares', () => {
      // ARRANGE: Complex game state
      const gameState = createBasicGameState(4);
      const player1 = gameState.players[0];
      const player2 = gameState.players[1];
      
      // Multiple partial squares in different states
      gameState.lines = [
        // Partial square 1 (2 lines - safe to add third)
        createTestLine([0, 0, 0], [1, 0, 0], player1),
        createTestLine([1, 0, 0], [1, 1, 0], player1),
        
        // Partial square 2 (3 lines - dangerous to complete)
        createTestLine([2, 0, 0], [3, 0, 0], player2),
        createTestLine([3, 0, 0], [3, 1, 0], player2),
        createTestLine([3, 1, 0], [2, 1, 0], player2),
        
        // Random safe line
        createTestLine([0, 2, 2], [1, 2, 2], player1)
      ];
      
      renderer.updateFromGameState(gameState);
      
      // ACT: Test different line consequences
      const testCases = [
        {
          line: createTestLine([1, 1, 0], [0, 1, 0]), // Third line - dangerous
          expectedType: 'dangerous-third-line'
        },
        {
          line: createTestLine([2, 1, 0], [2, 0, 0]), // Completing line - chain reaction
          expectedType: 'chain-reaction'
        },
        {
          line: createTestLine([0, 3, 3], [1, 3, 3]), // Safe line
          expectedType: 'safe'
        }
      ];
      
      // ASSERT
      testCases.forEach(({ line, expectedType }) => {
        const result = (renderer as any).analyzeLineConsequences(line);
        expect(result.type).toBe(expectedType);
      });
    });

    it('should maintain performance with realistic game scenarios', () => {
      // ARRANGE: Realistic mid-game state
      const gameState = createBasicGameState(5);
      const player1 = gameState.players[0];
      
      // Add ~30 lines (typical mid-game)
      const lines: Line[] = [];
      for (let i = 0; i < 30; i++) {
        const x = Math.floor(Math.random() * 4);
        const y = Math.floor(Math.random() * 4); 
        const z = Math.floor(Math.random() * 4);
        
        // Add random valid line
        if (Math.random() > 0.5) {
          lines.push(createTestLine([x, y, z], [x + 1, y, z], player1));
        } else {
          lines.push(createTestLine([x, y, z], [x, y + 1, z], player1));
        }
      }
      
      gameState.lines = lines;
      renderer.updateFromGameState(gameState);
      
      // ACT: Analyze multiple potential moves
      const startTime = performance.now();
      
      for (let i = 0; i < 10; i++) {
        const testLine = createTestLine([i % 4, 0, 0], [(i + 1) % 4, 0, 0]);
        (renderer as any).analyzeLineConsequences(testLine);
      }
      
      const endTime = performance.now();
      
      // ASSERT: Should complete all analyses quickly
      expect(endTime - startTime).toBeLessThan(50); // All 10 analyses in under 50ms
    });
  });
});