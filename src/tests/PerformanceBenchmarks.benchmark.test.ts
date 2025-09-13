import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../core/GameEngine';
import { GameRenderer } from '../core/GameRenderer';
import { BrowserPerformanceTracker } from '../core/BrowserPerformanceTracker';
import { PerformanceMonitor } from '../core/PerformanceMonitor';
import { validateMove, calculateScore, applyMove } from '../domain/GameRules';
import { GameState } from '../core/types';

describe('Performance Benchmarks', () => {
  let performanceTracker: BrowserPerformanceTracker;
  let container: HTMLDivElement;

  beforeEach(() => {
    performanceTracker = new BrowserPerformanceTracker(false);
    
    // Create container for renderer tests
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    performanceTracker.dispose();
    if (container.parentElement) {
      document.body.removeChild(container);
    }
  });

  describe('Game Engine Performance', () => {
    it('should benchmark move validation performance', () => {
      const engine = new GameEngine(5, 'local'); // Larger grid for stress test
      const iterations = 10000;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        // Test various move validations
        const testMoves = [
          { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } },
          { start: { x: 2, y: 1, z: 3 }, end: { x: 2, y: 2, z: 3 } },
          { start: { x: 4, y: 4, z: 4 }, end: { x: 3, y: 4, z: 4 } }
        ];
        
        const move = testMoves[i % testMoves.length];
        engine.isValidLine(move);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`Move validation: ${avgTime.toFixed(4)}ms per validation (${iterations} iterations)`);
      
      // Move validation should be very fast (< 0.1ms per validation)
      expect(avgTime).toBeLessThan(0.1);
    });

    it('should benchmark score calculation performance', () => {
      const engine = new GameEngine(4, 'local');
      
      // Make some moves to create a complex state
      const moves = engine.getPossibleMoves().slice(0, 50);
      moves.forEach(move => engine.makeMove(move.start, move.end));
      
      const iterations = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        engine['updateScores']();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`Score calculation: ${avgTime.toFixed(4)}ms per calculation (${iterations} iterations)`);
      
      // Score calculation should be reasonably fast (< 5ms)
      expect(avgTime).toBeLessThan(5);
    });

    it('should benchmark face counting performance', () => {
      const engine = new GameEngine(5, 'local');
      
      // Create a complex state with many completed squares
      const moves = engine.getPossibleMoves().slice(0, 100);
      moves.forEach(move => engine.makeMove(move.start, move.end));
      
      const state = engine.getState();
      const iterations = 500;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        engine['countUniqueFacesForPlayer'](state.players[0], state.squares);
        engine['countUniqueFacesForPlayer'](state.players[1], state.squares);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / (iterations * 2); // 2 players per iteration
      
      console.log(`Face counting: ${avgTime.toFixed(4)}ms per player (${iterations * 2} calculations)`);
      
      // Face counting should be efficient (< 2ms per player)
      expect(avgTime).toBeLessThan(2);
    });

    it('should benchmark possible moves calculation', () => {
      const engine = new GameEngine(4, 'local');
      
      const iterations = 100;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        engine.getPossibleMoves();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`Possible moves calculation: ${avgTime.toFixed(4)}ms per calculation (${iterations} iterations)`);
      
      // Should be fast even for complex grids (< 10ms)
      expect(avgTime).toBeLessThan(10);
    });
  });

  describe('GameRules Performance', () => {
    function createTestState(): GameState {
      return {
        gridSize: 4,
        currentPlayer: { id: 'p1', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0 },
        players: [
          { id: 'p1', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0 },
          { id: 'p2', name: 'Player 2', color: '#0000FF', score: 0, squareCount: 0 }
        ],
        lines: [],
        squares: [],
        cubes: [],
        turn: 0,
        winner: null,
        gameMode: 'local'
      };
    }

    it('should benchmark pure function move validation', () => {
      const state = createTestState();
      const iterations = 10000;
      
      const testCases = [
        { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } },
        { start: { x: 1, y: 1, z: 1 }, end: { x: 2, y: 1, z: 1 } },
        { start: { x: 2, y: 2, z: 2 }, end: { x: 2, y: 3, z: 2 } }
      ];
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const testCase = testCases[i % testCases.length];
        validateMove(state, testCase.start, testCase.end);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`Pure function validation: ${avgTime.toFixed(4)}ms per validation (${iterations} iterations)`);
      
      // Pure functions should be very fast (< 0.05ms)
      expect(avgTime).toBeLessThan(0.05);
    });

    it('should benchmark score calculation with pure functions', () => {
      const state = createTestState();
      
      // Add some test data
      for (let i = 0; i < 20; i++) {
        state.cubes.push({
          position: { x: i % 3, y: Math.floor(i / 3) % 3, z: Math.floor(i / 9) },
          owner: i % 2 === 0 ? state.players[0] : state.players[1],
          faces: []
        });
      }
      
      const iterations = 5000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        calculateScore(state);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`Pure function scoring: ${avgTime.toFixed(4)}ms per calculation (${iterations} iterations)`);
      
      // Pure function scoring should be very fast (< 0.5ms)
      expect(avgTime).toBeLessThan(0.5);
    });

    it('should benchmark immutable state updates', () => {
      const state = createTestState();
      const iterations = 1000;
      
      const moves = [
        { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } },
        { start: { x: 1, y: 0, z: 0 }, end: { x: 1, y: 1, z: 0 } },
        { start: { x: 1, y: 1, z: 0 }, end: { x: 0, y: 1, z: 0 } }
      ];
      
      const startTime = performance.now();
      
      let currentState = state;
      for (let i = 0; i < iterations; i++) {
        const move = moves[i % moves.length];
        
        // Validate the move is still possible
        const validation = validateMove(currentState, move.start, move.end);
        if (validation.valid) {
          currentState = applyMove(currentState, move.start, move.end);
        } else {
          // Reset state if no valid moves
          currentState = createTestState();
        }
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`Immutable state updates: ${avgTime.toFixed(4)}ms per update (${iterations} iterations)`);
      
      // Immutable updates should be reasonably fast (< 2ms)
      expect(avgTime).toBeLessThan(2);
    });
  });

  describe('Rendering Performance', () => {
    it('should benchmark renderer creation and disposal', () => {
      const iterations = 20; // Fewer iterations for resource-intensive operations
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const renderer = new GameRenderer(container, 3);
        renderer.dispose();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`Renderer lifecycle: ${avgTime.toFixed(4)}ms per create/dispose (${iterations} iterations)`);
      
      // Renderer creation should be reasonable (< 50ms)
      expect(avgTime).toBeLessThan(50);
    });

    it('should benchmark state update rendering', () => {
      const renderer = new GameRenderer(container, 3);
      const engine = new GameEngine(3, 'local');
      
      // Make some moves to create complex state
      const moves = engine.getPossibleMoves().slice(0, 20);
      moves.forEach(move => engine.makeMove(move.start, move.end));
      
      const state = engine.getState();
      const iterations = 100;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        renderer.updateFromGameState(state);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`State update rendering: ${avgTime.toFixed(4)}ms per update (${iterations} iterations)`);
      
      renderer.dispose();
      
      // State updates should be fast (< 5ms)
      expect(avgTime).toBeLessThan(5);
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during repeated operations', async () => {
      if (!performance.memory) {
        console.log('Memory measurement not available in this browser');
        return;
      }
      
      const initialMemory = performance.memory.usedJSHeapSize;
      
      // Perform memory-intensive operations
      for (let i = 0; i < 100; i++) {
        const engine = new GameEngine(4, 'local');
        const moves = engine.getPossibleMoves().slice(0, 30);
        
        moves.forEach(move => {
          engine.makeMove(move.start, move.end);
        });
        
        // Force garbage collection hint
        if (i % 10 === 0) {
          // Create temporary objects to trigger GC
          const temp = new Array(1000).fill(0).map(() => ({ data: Math.random() }));
          temp.length = 0;
        }
      }
      
      // Allow time for garbage collection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = performance.memory.usedJSHeapSize;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      
      // Memory increase should be reasonable (< 10MB)
      expect(memoryIncreaseMB).toBeLessThan(10);
    });
  });

  describe('Network Performance Simulation', () => {
    it('should benchmark network latency simulation', async () => {
      const iterations = 100;
      const latencies: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2));
        
        const latency = performance.now() - startTime;
        latencies.push(latency);
      }
      
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      
      console.log(`Network simulation - Avg: ${avgLatency.toFixed(2)}ms, Min: ${minLatency.toFixed(2)}ms, Max: ${maxLatency.toFixed(2)}ms`);
      
      // Simulated latency should be in expected range
      expect(avgLatency).toBeGreaterThan(0);
      expect(avgLatency).toBeLessThan(10); // Reasonable for simulation
    });
  });

  describe('Performance Tracker Benchmarks', () => {
    it('should benchmark performance tracking overhead', () => {
      const iterations = 10000;
      
      // Benchmark without tracking
      const startTimeNoTracking = performance.now();
      for (let i = 0; i < iterations; i++) {
        Math.sqrt(i);
      }
      const timeNoTracking = performance.now() - startTimeNoTracking;
      
      // Benchmark with tracking
      const startTimeWithTracking = performance.now();
      for (let i = 0; i < iterations; i++) {
        performanceTracker.measureFunction(`math-${i}`, () => Math.sqrt(i));
      }
      const timeWithTracking = performance.now() - startTimeWithTracking;
      
      const overhead = timeWithTracking - timeNoTracking;
      const overheadPerOperation = overhead / iterations;
      
      console.log(`Performance tracking overhead: ${overheadPerOperation.toFixed(6)}ms per operation`);
      
      // Tracking overhead should be minimal (< 0.01ms per operation)
      expect(overheadPerOperation).toBeLessThan(0.01);
    });
  });
});