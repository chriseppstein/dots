import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameRenderer } from '../core/GameRenderer';
import { GameState, Line, Player, Cube, Square } from '../core/types';
import * as THREE from 'three';

// Enhanced Three.js mock with tracking capabilities
vi.mock('three', () => {
  const actualThree = vi.importActual('three');
  
  // Track all created geometries and materials for disposal verification
  const createdGeometries = new Set();
  const createdMaterials = new Set();
  const createdMeshes = new Set();
  
  class MockWebGLRenderer {
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
  }
  
  class MockGroup {
    children: any[] = [];
    rotation = { x: 0, y: 0 };
    position = { x: 0, y: 0, z: 0 };
    
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
    
    clear() {
      this.children = [];
    }
  }
  
  class MockMesh {
    geometry: any;
    material: any;
    position = { set: vi.fn(), copy: vi.fn() };
    userData = {};
    
    constructor(geometry: any, material: any) {
      this.geometry = geometry;
      this.material = material;
      createdMeshes.add(this);
    }
    
    setRotationFromQuaternion() {}
    add() {}
  }
  
  class MockGeometry {
    dispose = vi.fn(() => {
      createdGeometries.delete(this);
    });
    setAttribute = vi.fn();
    setIndex = vi.fn();
    computeVertexNormals = vi.fn();
    
    constructor() {
      createdGeometries.add(this);
    }
  }
  
  class MockMaterial {
    dispose = vi.fn(() => {
      createdMaterials.delete(this);
    });
    
    constructor() {
      createdMaterials.add(this);
    }
  }
  
  return {
    ...actualThree,
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
    DoubleSide: 2,
    // Export tracking utilities for tests
    __testUtils: {
      getCreatedGeometries: () => createdGeometries,
      getCreatedMaterials: () => createdMaterials,
      getCreatedMeshes: () => createdMeshes,
      clearTracking: () => {
        createdGeometries.clear();
        createdMaterials.clear();
        createdMeshes.clear();
      }
    }
  };
});

describe('GameRenderer Differential Updates', () => {
  let container: HTMLDivElement;
  let renderer: GameRenderer;
  let mockThree: any;
  
  const createTestPlayer = (id: string, color: string): Player => ({
    id,
    name: `Player ${id}`,
    color,
    score: 0,
    squareCount: 0
  });
  
  const createTestLine = (start: [number, number, number], end: [number, number, number], player: Player | null = null): Line => ({
    start: { x: start[0], y: start[1], z: start[2] },
    end: { x: end[0], y: end[1], z: end[2] },
    player
  });
  
  const createTestCube = (x: number, y: number, z: number, owner: Player | null = null): Cube => ({
    position: { x, y, z },
    faces: [],
    owner,
    claimedFaces: owner ? 6 : 0
  });
  
  const createBasicGameState = (): GameState => {
    const player1 = createTestPlayer('player1', '#ff0000');
    const player2 = createTestPlayer('player2', '#0000ff');
    
    return {
      gridSize: 3,
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
    mockThree = vi.mocked(THREE as any);
    mockThree.__testUtils.clearTracking();
    
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    renderer = new GameRenderer(container, 3);
  });
  
  afterEach(() => {
    if (renderer) {
      renderer.dispose();
    }
    document.body.removeChild(container);
  });

  describe('Element Tracking', () => {
    it('should track rendered lines and not recreate unchanged lines on subsequent updates', () => {
      // ARRANGE
      const player1 = createTestPlayer('player1', '#ff0000');
      const line1 = createTestLine([0, 0, 0], [1, 0, 0], player1);
      const line2 = createTestLine([0, 0, 0], [0, 1, 0], player1);
      
      const initialState = createBasicGameState();
      initialState.lines = [line1];
      
      const gridGroup = renderer['gridGroup'] as any;
      const drawnLines = renderer['drawnLines'] as Map<string, any>;
      
      // ACT - First update with one line
      renderer.updateFromGameState(initialState);
      const initialChildCount = gridGroup.children.length;
      const initialLineCount = drawnLines.size;
      
      // Second update with additional line (should only add new line, not recreate existing)
      const updatedState = { ...initialState };
      updatedState.lines = [line1, line2];
      
      const meshCreationSpy = vi.spyOn(renderer as any, 'createLineMesh');
      renderer.updateFromGameState(updatedState);
      
      // ASSERT
      expect(drawnLines.size).toBe(2); // Should have both lines tracked
      expect(gridGroup.children.length).toBeGreaterThan(initialChildCount); // Should have added elements
      // This test should FAIL initially because current implementation recreates all lines
      expect(meshCreationSpy).toHaveBeenCalledTimes(1); // Should only create mesh for new line
    });
    
    it('should track rendered squares and only update changed squares', () => {
      // ARRANGE  
      const player1 = createTestPlayer('player1', '#ff0000');
      const completedSquare: Square = {
        corners: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 }
        ],
        lines: [],
        player: player1
      };
      
      const cube1 = createTestCube(0, 0, 0, null);
      cube1.faces = [completedSquare];
      
      const cube2 = createTestCube(1, 0, 0, null);
      
      const initialState = createBasicGameState();
      initialState.cubes = [cube1];
      
      const completedSquares = renderer['completedSquares'] as any[];
      
      // ACT - First update with one completed square
      renderer.updateFromGameState(initialState);
      const initialSquareCount = completedSquares.length;
      
      // Second update with additional cube but no new squares
      const updatedState = { ...initialState };
      updatedState.cubes = [cube1, cube2];
      
      const squareCreationSpy = vi.spyOn(renderer as any, 'drawCompletedSquare');
      renderer.updateFromGameState(updatedState);
      
      // ASSERT
      expect(completedSquares.length).toBe(initialSquareCount); // Should not change
      // This test should FAIL initially because current implementation recreates all squares
      expect(squareCreationSpy).not.toHaveBeenCalled(); // Should not recreate existing squares
    });
    
    it('should track rendered spheres and only update changed cube ownership', () => {
      // ARRANGE
      const player1 = createTestPlayer('player1', '#ff0000');
      const cube1 = createTestCube(0, 0, 0, player1);
      const cube2 = createTestCube(1, 0, 0, null);
      
      const initialState = createBasicGameState();
      initialState.cubes = [cube1, cube2];
      
      const cubeSpheres = renderer['cubeSpheres'] as any[];
      
      // ACT - First update with one owned cube
      renderer.updateFromGameState(initialState);
      const initialSphereCount = cubeSpheres.length;
      
      // Second update where second cube becomes owned
      const updatedState = { ...initialState };
      updatedState.cubes = [cube1, { ...cube2, owner: player1 }];
      
      const sphereCreationSpy = vi.spyOn(renderer as any, 'drawCubeSphere');
      renderer.updateFromGameState(updatedState);
      
      // ASSERT
      expect(cubeSpheres.length).toBe(initialSphereCount + 1); // Should add one sphere
      // This test should FAIL initially because current implementation recreates all spheres
      expect(sphereCreationSpy).toHaveBeenCalledTimes(1); // Should only create sphere for newly owned cube
    });
  });

  describe('Performance Optimization', () => {
    it('should not clear and recreate all elements when only one line is added', () => {
      // ARRANGE
      const player1 = createTestPlayer('player1', '#ff0000');
      const initialLines = [
        createTestLine([0, 0, 0], [1, 0, 0], player1),
        createTestLine([1, 0, 0], [2, 0, 0], player1),
        createTestLine([0, 1, 0], [1, 1, 0], player1)
      ];
      
      const initialState = createBasicGameState();
      initialState.lines = initialLines;
      
      const gridGroup = renderer['gridGroup'] as any;
      const drawnLines = renderer['drawnLines'] as Map<string, any>;
      
      // ACT - Initial render
      renderer.updateFromGameState(initialState);
      const renderedMeshes = Array.from(drawnLines.values());
      
      // Spy on remove method to detect if elements are being cleared
      const removeSpy = vi.spyOn(gridGroup, 'remove');
      const clearSpy = vi.spyOn(drawnLines, 'clear');
      
      // Add one new line
      const updatedState = { ...initialState };
      updatedState.lines = [...initialLines, createTestLine([0, 0, 1], [1, 0, 1], player1)];
      
      renderer.updateFromGameState(updatedState);
      
      // ASSERT
      // This test should FAIL initially because current implementation clears everything
      expect(clearSpy).not.toHaveBeenCalled(); // Should not clear existing lines
      expect(removeSpy).not.toHaveBeenCalledWith(renderedMeshes[0]); // Should not remove existing meshes
      expect(drawnLines.size).toBe(4); // Should now have 4 lines total
    });
    
    it('should efficiently handle large grid updates by only modifying changed elements', () => {
      // ARRANGE - Large grid with many elements
      const player1 = createTestPlayer('player1', '#ff0000');
      const player2 = createTestPlayer('player2', '#0000ff');
      
      // Create a large number of lines for a 5x5x5 grid
      const manyLines: Line[] = [];
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          for (let z = 0; z < 4; z++) {
            if (Math.random() > 0.7) { // Randomly add ~30% of possible lines
              manyLines.push(createTestLine([x, y, z], [x + 1, y, z], 
                Math.random() > 0.5 ? player1 : player2));
            }
          }
        }
      }
      
      const largeState = createBasicGameState();
      largeState.gridSize = 5;
      largeState.lines = manyLines;
      
      // ACT - Initial render
      const startTime = performance.now();
      renderer.updateFromGameState(largeState);
      const initialRenderTime = performance.now() - startTime;
      
      // Add just one line to the large state
      const updatedState = { ...largeState };
      updatedState.lines = [...manyLines, createTestLine([4, 4, 4], [4, 4, 3], player1)];
      
      const updateStartTime = performance.now();
      renderer.updateFromGameState(updatedState);
      const updateTime = performance.now() - updateStartTime;
      
      // ASSERT
      // This test should FAIL initially because current implementation is O(n) for every update
      // With differential rendering, update should be much faster than initial render
      expect(updateTime).toBeLessThan(initialRenderTime * 0.5); // Update should be <50% of initial render time
    });
  });

  describe('Functional Correctness', () => {
    it('should correctly handle line removal (when lines are modified)', () => {
      // ARRANGE
      const player1 = createTestPlayer('player1', '#ff0000');
      const line1 = createTestLine([0, 0, 0], [1, 0, 0], player1);
      const line2 = createTestLine([0, 0, 0], [0, 1, 0], player1);
      const line3 = createTestLine([1, 0, 0], [2, 0, 0], player1);
      
      const initialState = createBasicGameState();
      initialState.lines = [line1, line2, line3];
      
      const drawnLines = renderer['drawnLines'] as Map<string, any>;
      const gridGroup = renderer['gridGroup'] as any;
      
      // ACT - Initial render
      renderer.updateFromGameState(initialState);
      expect(drawnLines.size).toBe(3);
      const initialChildCount = gridGroup.children.length;
      
      // Remove middle line
      const updatedState = { ...initialState };
      updatedState.lines = [line1, line3]; // line2 removed
      
      renderer.updateFromGameState(updatedState);
      
      // ASSERT
      expect(drawnLines.size).toBe(2); // Should have 2 lines
      expect(gridGroup.children.length).toBeLessThan(initialChildCount); // Should have fewer children
    });
    
    it('should correctly handle line color changes (last move highlighting)', () => {
      // ARRANGE  
      const player1 = createTestPlayer('player1', '#ff0000');
      const line1 = createTestLine([0, 0, 0], [1, 0, 0], player1);
      const line2 = createTestLine([0, 0, 0], [0, 1, 0], player1);
      
      const initialState = createBasicGameState();
      initialState.lines = [line1, line2];
      
      // ACT - Initial render without last move
      renderer.updateFromGameState(initialState);
      
      // Clear spies and set up for the second update
      const createGlowingSpy = vi.spyOn(renderer as any, 'createGlowingLineMesh');
      const createRegularSpy = vi.spyOn(renderer as any, 'createLineMesh');
      
      // Update with last move highlighting
      const updatedState = { ...initialState };
      updatedState.lastMove = line1; // line1 should now glow
      
      renderer.updateFromGameState(updatedState);
      
      // ASSERT
      // Should recreate the line that changed from regular to glowing
      expect(createGlowingSpy).toHaveBeenCalled();
      // Should not recreate the unchanged line
      expect(createRegularSpy).toHaveBeenCalledTimes(0); // Only called for changed lines
    });
    
    it('should maintain all existing functionality after optimization', () => {
      // ARRANGE - Complex game state with all element types
      const player1 = createTestPlayer('player1', '#ff0000');
      const player2 = createTestPlayer('player2', '#0000ff');
      
      const lines = [
        createTestLine([0, 0, 0], [1, 0, 0], player1),
        createTestLine([0, 0, 0], [0, 1, 0], player2)
      ];
      
      const completedSquare: Square = {
        corners: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 }
        ],
        lines: [],
        player: player1
      };
      
      const cube = createTestCube(0, 0, 0, player1);
      cube.faces = [completedSquare];
      
      const complexState = createBasicGameState();
      complexState.lines = lines;
      complexState.cubes = [cube];
      complexState.lastMove = lines[0];
      
      const drawnLines = renderer['drawnLines'] as Map<string, any>;
      const completedSquares = renderer['completedSquares'] as any[];
      const cubeSpheres = renderer['cubeSpheres'] as any[];
      
      // ACT
      expect(() => renderer.updateFromGameState(complexState)).not.toThrow();
      
      // ASSERT - All elements should be rendered correctly
      expect(drawnLines.size).toBe(2); // Both lines rendered
      expect(completedSquares.length).toBe(1); // Square rendered
      expect(cubeSpheres.length).toBe(1); // Sphere rendered
    });
  });

  describe('Memory Management', () => {
    it('should properly dispose removed elements to prevent memory leaks', () => {
      // ARRANGE
      const player1 = createTestPlayer('player1', '#ff0000');
      const line1 = createTestLine([0, 0, 0], [1, 0, 0], player1);
      const line2 = createTestLine([0, 0, 0], [0, 1, 0], player1);
      
      const initialState = createBasicGameState();
      initialState.lines = [line1, line2];
      
      // ACT - Initial render
      renderer.updateFromGameState(initialState);
      const drawnLines = renderer['drawnLines'] as Map<string, any>;
      const removedLine = drawnLines.get(renderer['getLineKey'](line1));
      
      // Remove one line
      const updatedState = { ...initialState };
      updatedState.lines = [line2];
      
      renderer.updateFromGameState(updatedState);
      
      // ASSERT  
      // Should dispose geometry and material of removed elements
      expect(removedLine.geometry.dispose).toHaveBeenCalled();
      expect(removedLine.material.dispose).toHaveBeenCalled();
    });
  });
});