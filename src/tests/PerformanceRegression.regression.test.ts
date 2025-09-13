import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../core/GameEngine';
import { GameRenderer } from '../core/GameRenderer';
import { BrowserPerformanceTracker } from '../core/BrowserPerformanceTracker';
import { PerformanceMonitor, PerformanceMetrics } from '../core/PerformanceMonitor';

/**
 * Performance regression tests to ensure optimizations don't degrade performance
 * These tests establish baseline performance metrics that should not regress
 */
describe('Performance Regression Tests', () => {
  let container: HTMLDivElement;
  let performanceTracker: BrowserPerformanceTracker;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    performanceTracker = new BrowserPerformanceTracker(false);
  });

  afterEach(() => {
    performanceTracker?.dispose();
    if (container.parentElement) {
      document.body.removeChild(container);
    }
  });

  describe('Game Engine Regression Tests', () => {
    it('should maintain move processing performance', () => {
      const engine = new GameEngine(4, 'local');
      const moves = engine.getPossibleMoves().slice(0, 100);
      
      const PERFORMANCE_THRESHOLD = 1000; // 100 moves should complete within 1 second
      
      const startTime = performance.now();
      
      moves.forEach(move => {
        engine.makeMove(move.start, move.end);
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`Move processing regression test: ${totalTime.toFixed(2)}ms for ${moves.length} moves`);
      
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      
      // Average time per move should be reasonable
      const avgTimePerMove = totalTime / moves.length;
      expect(avgTimePerMove).toBeLessThan(10); // 10ms per move
    });

    it('should maintain score calculation performance under load', () => {
      const engine = new GameEngine(5, 'local'); // Larger grid for stress test
      
      // Create a complex game state
      const moves = engine.getPossibleMoves().slice(0, 150);
      moves.forEach(move => engine.makeMove(move.start, move.end));
      
      const SCORE_CALC_THRESHOLD = 100; // 50 calculations should complete within 100ms
      const iterations = 50;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        engine['updateScores']();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`Score calculation regression test: ${totalTime.toFixed(2)}ms for ${iterations} calculations`);
      
      expect(totalTime).toBeLessThan(SCORE_CALC_THRESHOLD);
    });

    it('should maintain state synchronization performance', () => {
      const engine = new GameEngine(4, 'local');
      
      // Create test server state
      const serverState = {
        gridSize: 4,
        currentPlayer: { id: 'server-player-1' },
        players: [
          { id: 'server-player-1', name: 'Server Player 1' },
          { id: 'server-player-2', name: 'Server Player 2' }
        ],
        lines: [
          { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 }, player: { id: 'server-player-1' } },
          { start: { x: 1, y: 0, z: 0 }, end: { x: 1, y: 1, z: 0 }, player: { id: 'server-player-2' } }
        ],
        squares: [],
        cubes: [],
        turn: 2,
        winner: null,
        gameMode: 'online'
      };
      
      const SYNC_THRESHOLD = 50; // Synchronization should be fast
      const iterations = 100;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        engine.syncWithServerState(serverState);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`State sync regression test: ${totalTime.toFixed(2)}ms for ${iterations} syncs`);
      
      expect(totalTime).toBeLessThan(SYNC_THRESHOLD);
    });
  });

  describe('Renderer Regression Tests', () => {
    it('should maintain rendering update performance', () => {
      const renderer = new GameRenderer(container, 4);
      const engine = new GameEngine(4, 'local');
      
      // Create complex state
      const moves = engine.getPossibleMoves().slice(0, 50);
      moves.forEach(move => engine.makeMove(move.start, move.end));
      
      const state = engine.getState();
      const RENDER_UPDATE_THRESHOLD = 500; // 50 updates within 500ms
      const iterations = 50;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        renderer.updateFromGameState(state);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`Render update regression test: ${totalTime.toFixed(2)}ms for ${iterations} updates`);
      
      renderer.dispose();
      
      expect(totalTime).toBeLessThan(RENDER_UPDATE_THRESHOLD);
      
      // Average time per update should be reasonable
      const avgTimePerUpdate = totalTime / iterations;
      expect(avgTimePerUpdate).toBeLessThan(10); // 10ms per update
    });

    it('should maintain renderer lifecycle performance', () => {
      const LIFECYCLE_THRESHOLD = 2000; // 10 create/dispose cycles within 2 seconds
      const iterations = 10;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const renderer = new GameRenderer(container, 3);
        const engine = new GameEngine(3, 'local');
        
        // Do some work
        const moves = engine.getPossibleMoves().slice(0, 5);
        moves.forEach(move => {
          engine.makeMove(move.start, move.end);
          renderer.updateFromGameState(engine.getState());
        });
        
        renderer.dispose();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`Renderer lifecycle regression test: ${totalTime.toFixed(2)}ms for ${iterations} cycles`);
      
      expect(totalTime).toBeLessThan(LIFECYCLE_THRESHOLD);
    });

    it('should maintain differential rendering performance', () => {
      const renderer = new GameRenderer(container, 4);
      const engine = new GameEngine(4, 'local');
      
      // Initial render
      renderer.updateFromGameState(engine.getState());
      
      const DIFFERENTIAL_UPDATE_THRESHOLD = 200; // Small updates should be very fast
      const iterations = 20;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const moves = engine.getPossibleMoves();
        if (moves.length > 0) {
          engine.makeMove(moves[0].start, moves[0].end);
          renderer.updateFromGameState(engine.getState());
        }
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`Differential rendering regression test: ${totalTime.toFixed(2)}ms for ${iterations} incremental updates`);
      
      renderer.dispose();
      
      expect(totalTime).toBeLessThan(DIFFERENTIAL_UPDATE_THRESHOLD);
    });
  });

  describe('Memory Regression Tests', () => {
    it('should not regress memory usage during gameplay', async () => {
      if (!performance.memory) {
        console.log('Memory measurement not available - skipping memory regression test');
        return;
      }
      
      const initialMemory = performance.memory.usedJSHeapSize;
      
      // Simulate extended gameplay
      for (let gameRound = 0; gameRound < 10; gameRound++) {
        const engine = new GameEngine(4, 'local');
        const renderer = new GameRenderer(container, 4);
        
        // Play a short game
        const moves = engine.getPossibleMoves().slice(0, 20);
        moves.forEach(move => {
          engine.makeMove(move.start, move.end);
          renderer.updateFromGameState(engine.getState());
        });
        
        renderer.dispose();
      }
      
      // Allow garbage collection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = performance.memory.usedJSHeapSize;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      console.log(`Memory regression test: ${memoryIncreaseMB.toFixed(2)}MB increase after 10 game rounds`);
      
      // Memory increase should be reasonable (less than 10MB for 10 games)
      expect(memoryIncreaseMB).toBeLessThan(10);
    });

    it('should maintain stable memory usage during state updates', async () => {
      if (!performance.memory) {
        console.log('Memory measurement not available - skipping memory stability test');
        return;
      }
      
      const engine = new GameEngine(4, 'local');
      const renderer = new GameRenderer(container, 4);
      
      const initialMemory = performance.memory.usedJSHeapSize;
      
      // Perform many state updates
      for (let i = 0; i < 100; i++) {
        const moves = engine.getPossibleMoves();
        if (moves.length > 0) {
          engine.makeMove(moves[0].start, moves[0].end);
          renderer.updateFromGameState(engine.getState());
        }
        
        // Reset game occasionally to prevent it from ending
        if (i % 30 === 0) {
          engine.reset();
        }
      }
      
      renderer.dispose();
      
      // Allow garbage collection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = performance.memory.usedJSHeapSize;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      console.log(`Memory stability test: ${memoryIncreaseMB.toFixed(2)}MB increase after 100 state updates`);
      
      // Memory should remain stable during repeated operations
      expect(memoryIncreaseMB).toBeLessThan(5);
    });
  });

  describe('Performance Monitor Regression Tests', () => {
    it('should maintain performance monitoring overhead', () => {
      const renderer = new GameRenderer(container, 3);
      const performanceMonitor = new PerformanceMonitor(renderer.getRenderer(), container);
      
      const MONITORING_OVERHEAD_THRESHOLD = 100; // Monitoring should add minimal overhead
      const iterations = 100;
      
      // Test with monitoring enabled
      const startTimeWithMonitoring = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        performanceMonitor.startFrame();
        
        // Simulate some work
        Math.sqrt(Math.random() * 1000);
        
        performanceMonitor.endFrame();
      }
      
      const timeWithMonitoring = performance.now() - startTimeWithMonitoring;
      
      // Test without monitoring
      const startTimeWithoutMonitoring = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        // Same work without monitoring
        Math.sqrt(Math.random() * 1000);
      }
      
      const timeWithoutMonitoring = performance.now() - startTimeWithoutMonitoring;
      
      const monitoringOverhead = timeWithMonitoring - timeWithoutMonitoring;
      
      console.log(`Performance monitoring overhead regression test: ${monitoringOverhead.toFixed(2)}ms overhead for ${iterations} frames`);
      
      performanceMonitor.dispose();
      renderer.dispose();
      
      expect(monitoringOverhead).toBeLessThan(MONITORING_OVERHEAD_THRESHOLD);
    });
  });

  describe('Integration Performance Regression', () => {
    it('should maintain end-to-end performance', () => {
      const engine = new GameEngine(4, 'local');
      const renderer = new GameRenderer(container, 4);
      const monitor = new PerformanceMonitor(renderer.getRenderer());
      
      const END_TO_END_THRESHOLD = 2000; // Complete game simulation within 2 seconds
      
      const startTime = performance.now();
      
      // Simulate a complete game
      let moveCount = 0;
      while (!engine.getState().winner && moveCount < 100) {
        monitor.startFrame();
        
        const moves = engine.getPossibleMoves();
        if (moves.length > 0) {
          engine.makeMove(moves[0].start, moves[0].end);
          renderer.updateFromGameState(engine.getState());
          moveCount++;
        }
        
        monitor.endFrame();
        
        if (moves.length === 0) break;
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const metrics = monitor.getMetrics();
      
      console.log(`End-to-end regression test: ${totalTime.toFixed(2)}ms for ${moveCount} moves`);
      console.log(`Final metrics - FPS: ${metrics.fps}, Avg Frame Time: ${metrics.frameTime.toFixed(2)}ms`);
      
      monitor.dispose();
      renderer.dispose();
      
      expect(totalTime).toBeLessThan(END_TO_END_THRESHOLD);
      
      // Ensure we maintained reasonable performance throughout
      if (metrics.frameTime > 0) {
        expect(metrics.frameTime).toBeLessThan(50); // Average frame time under 50ms
      }
    });
  });
});