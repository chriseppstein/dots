import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../core/GameEngine';
import { GameRenderer } from '../core/GameRenderer';

/**
 * Integration tests for real WebGL rendering performance
 * These tests measure actual frame rates and rendering performance
 * in a real browser environment with WebGL context
 */
describe('WebGL Performance Integration Tests', () => {
  let container: HTMLDivElement;
  let renderer: GameRenderer;
  let engine: GameEngine;

  beforeEach(() => {
    // Create a real DOM container for WebGL context
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    container.style.position = 'absolute';
    container.style.top = '0px';
    container.style.left = '0px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (renderer) {
      renderer.dispose();
    }
    if (container.parentElement) {
      document.body.removeChild(container);
    }
  });

  describe('Baseline Performance Tests', () => {
    it('should maintain 60fps during idle rendering (3x3x3 grid)', async () => {
      renderer = new GameRenderer(container, 3);
      
      // Measure frame rate during idle rendering
      const frameRates: number[] = [];
      const startTime = performance.now();
      let frameCount = 0;
      let lastFrameTime = startTime;
      
      // Run for 1 second to get stable frame rate measurement
      await new Promise<void>((resolve) => {
        function measureFrame() {
          const now = performance.now();
          frameCount++;
          
          // Calculate instantaneous frame rate
          if (frameCount > 10) { // Skip first few frames for stability
            const frameTime = now - lastFrameTime;
            const fps = 1000 / frameTime;
            frameRates.push(fps);
          }
          
          lastFrameTime = now;
          
          if (now - startTime < 1000) {
            requestAnimationFrame(measureFrame);
          } else {
            resolve();
          }
        }
        
        requestAnimationFrame(measureFrame);
      });
      
      const averageFps = frameRates.reduce((sum, fps) => sum + fps, 0) / frameRates.length;
      const minFps = Math.min(...frameRates);
      
      console.log(`Idle rendering - Average FPS: ${averageFps.toFixed(1)}, Min FPS: ${minFps.toFixed(1)}`);
      
      // Should maintain near 60fps during idle rendering
      expect(averageFps).toBeGreaterThan(58); // Allow some margin for test environment
      expect(minFps).toBeGreaterThan(50); // No major frame drops
    });

    it('should maintain good performance during mouse movement simulation', async () => {
      renderer = new GameRenderer(container, 3);
      
      const frameRates: number[] = [];
      let frameCount = 0;
      const startTime = performance.now();
      let lastFrameTime = startTime;
      
      // Simulate mouse movement by dispatching events
      const simulateMouseMovement = () => {
        const mouseEvent = new MouseEvent('mousemove', {
          clientX: Math.random() * 800,
          clientY: Math.random() * 600,
          bubbles: true
        });
        
        container.firstChild?.dispatchEvent?.(mouseEvent);
      };
      
      await new Promise<void>((resolve) => {
        function measureFrameWithMouse() {
          const now = performance.now();
          frameCount++;
          
          // Simulate mouse movement every few frames
          if (frameCount % 3 === 0) {
            simulateMouseMovement();
          }
          
          if (frameCount > 10) {
            const frameTime = now - lastFrameTime;
            const fps = 1000 / frameTime;
            frameRates.push(fps);
          }
          
          lastFrameTime = now;
          
          if (now - startTime < 1000) {
            requestAnimationFrame(measureFrameWithMouse);
          } else {
            resolve();
          }
        }
        
        requestAnimationFrame(measureFrameWithMouse);
      });
      
      const averageFps = frameRates.reduce((sum, fps) => sum + fps, 0) / frameRates.length;
      const minFps = Math.min(...frameRates);
      
      console.log(`Mouse movement simulation - Average FPS: ${averageFps.toFixed(1)}, Min FPS: ${minFps.toFixed(1)}`);
      
      // Should maintain reasonable performance during mouse interaction
      expect(averageFps).toBeGreaterThan(45); // Allow more margin during interaction
      expect(minFps).toBeGreaterThan(30); // Should not drop below 30fps
    });

    it('should handle state updates efficiently', async () => {
      renderer = new GameRenderer(container, 4);
      engine = new GameEngine(4, 'local');
      
      // Make several moves to create complex state
      const moves = engine.getPossibleMoves().slice(0, 20);
      
      const updateTimes: number[] = [];
      
      // Measure time for each state update
      for (const move of moves) {
        engine.makeMove(move.start, move.end);
        
        const startTime = performance.now();
        renderer.updateFromGameState(engine.getState());
        const endTime = performance.now();
        
        updateTimes.push(endTime - startTime);
        
        // Small delay to allow rendering to complete
        await new Promise(resolve => setTimeout(resolve, 16));
      }
      
      const averageUpdateTime = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
      const maxUpdateTime = Math.max(...updateTimes);
      
      console.log(`State updates - Average: ${averageUpdateTime.toFixed(2)}ms, Max: ${maxUpdateTime.toFixed(2)}ms`);
      
      // State updates should be fast to maintain smooth gameplay
      expect(averageUpdateTime).toBeLessThan(5); // Under 5ms average
      expect(maxUpdateTime).toBeLessThan(16); // Never block a frame (16.67ms)
    });
  });

  describe('Scaling Performance Tests', () => {
    it('should compare performance across different grid sizes', async () => {
      const gridSizes = [3, 4, 5] as const;
      const results: Record<number, { fps: number; updateTime: number }> = {};
      
      for (const size of gridSizes) {
        // Clean up previous renderer
        if (renderer) {
          renderer.dispose();
        }
        
        renderer = new GameRenderer(container, size);
        engine = new GameEngine(size, 'local');
        
        // Measure frame rate
        const frameRates: number[] = [];
        const startTime = performance.now();
        let frameCount = 0;
        let lastFrameTime = startTime;
        
        await new Promise<void>((resolve) => {
          function measureFrame() {
            const now = performance.now();
            frameCount++;
            
            if (frameCount > 10 && frameCount < 60) { // Sample middle frames
              const frameTime = now - lastFrameTime;
              const fps = 1000 / frameTime;
              frameRates.push(fps);
            }
            
            lastFrameTime = now;
            
            if (frameCount < 70) {
              requestAnimationFrame(measureFrame);
            } else {
              resolve();
            }
          }
          
          requestAnimationFrame(measureFrame);
        });
        
        const averageFps = frameRates.reduce((sum, fps) => sum + fps, 0) / frameRates.length;
        
        // Measure state update performance
        const moves = engine.getPossibleMoves().slice(0, 10);
        const updateTimes: number[] = [];
        
        for (const move of moves) {
          engine.makeMove(move.start, move.end);
          
          const startTime = performance.now();
          renderer.updateFromGameState(engine.getState());
          const endTime = performance.now();
          
          updateTimes.push(endTime - startTime);
        }
        
        const averageUpdateTime = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
        
        results[size] = {
          fps: averageFps,
          updateTime: averageUpdateTime
        };
        
        console.log(`Grid ${size}x${size}x${size} - FPS: ${averageFps.toFixed(1)}, Update: ${averageUpdateTime.toFixed(2)}ms`);
      }
      
      // Performance should degrade gracefully with size
      expect(results[3].fps).toBeGreaterThan(55); // 3x3x3 should be excellent
      expect(results[4].fps).toBeGreaterThan(45); // 4x4x4 should be good
      expect(results[5].fps).toBeGreaterThan(30); // 5x5x5 should be acceptable
      
      // Update times should remain reasonable
      expect(results[3].updateTime).toBeLessThan(2);
      expect(results[4].updateTime).toBeLessThan(5);
      expect(results[5].updateTime).toBeLessThan(10);
    });
  });

  describe('Memory Performance Tests', () => {
    it('should not leak memory during extended gameplay', async () => {
      if (!(performance as any).memory) {
        console.log('Memory measurement not available - skipping memory test');
        return;
      }
      
      renderer = new GameRenderer(container, 4);
      engine = new GameEngine(4, 'local');
      
      const initialMemory = (performance as any).memory.usedJSHeapSize;
      
      // Simulate extended gameplay with many state changes
      for (let round = 0; round < 50; round++) {
        const moves = engine.getPossibleMoves().slice(0, 5);
        
        for (const move of moves) {
          engine.makeMove(move.start, move.end);
          renderer.updateFromGameState(engine.getState());
        }
        
        // Reset game occasionally to prevent it from ending
        if (round % 10 === 0) {
          engine.reset();
        }
        
        // Allow some processing time
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      // Force garbage collection hint
      const tempArray = new Array(1000).fill(0);
      tempArray.length = 0;
      
      // Allow garbage collection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = (performance as any).memory.usedJSHeapSize;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024);
      
      console.log(`Memory usage after extended gameplay: +${memoryIncrease.toFixed(2)}MB`);
      
      // Should not leak significant memory during gameplay
      expect(memoryIncrease).toBeLessThan(10); // Less than 10MB increase
    });
  });

  describe('Performance Regression Detection', () => {
    it('should establish baseline metrics for regression testing', async () => {
      renderer = new GameRenderer(container, 4);
      engine = new GameEngine(4, 'local');
      
      // Comprehensive performance measurement
      const metrics = {
        idleFps: 0,
        interactiveFps: 0,
        stateUpdateTime: 0,
        memoryUsage: 0
      };
      
      // 1. Measure idle FPS
      const idleFrameRates: number[] = [];
      let frameCount = 0;
      const startTime = performance.now();
      let lastFrameTime = startTime;
      
      await new Promise<void>((resolve) => {
        function measureFrame() {
          const now = performance.now();
          frameCount++;
          
          if (frameCount > 10 && frameCount < 40) {
            const frameTime = now - lastFrameTime;
            const fps = 1000 / frameTime;
            idleFrameRates.push(fps);
          }
          
          lastFrameTime = now;
          
          if (frameCount < 50) {
            requestAnimationFrame(measureFrame);
          } else {
            resolve();
          }
        }
        
        requestAnimationFrame(measureFrame);
      });
      
      metrics.idleFps = idleFrameRates.reduce((sum, fps) => sum + fps, 0) / idleFrameRates.length;
      
      // 2. Measure state update performance
      const moves = engine.getPossibleMoves().slice(0, 10);
      const updateTimes: number[] = [];
      
      for (const move of moves) {
        engine.makeMove(move.start, move.end);
        
        const startTime = performance.now();
        renderer.updateFromGameState(engine.getState());
        const endTime = performance.now();
        
        updateTimes.push(endTime - startTime);
      }
      
      metrics.stateUpdateTime = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
      
      // 3. Memory usage
      if ((performance as any).memory) {
        metrics.memoryUsage = (performance as any).memory.usedJSHeapSize / (1024 * 1024);
      }
      
      // Log baseline metrics for reference
      console.log('=== BASELINE PERFORMANCE METRICS ===');
      console.log(`Idle FPS: ${metrics.idleFps.toFixed(1)}`);
      console.log(`State Update Time: ${metrics.stateUpdateTime.toFixed(2)}ms`);
      console.log(`Memory Usage: ${metrics.memoryUsage.toFixed(1)}MB`);
      console.log('====================================');
      
      // Store metrics for future regression testing
      (globalThis as any).__performanceBaseline = metrics;
      
      // Assertions for baseline expectations
      expect(metrics.idleFps).toBeGreaterThan(45); // Should maintain good FPS
      expect(metrics.stateUpdateTime).toBeLessThan(10); // Updates should be fast
      expect(metrics.memoryUsage).toBeLessThan(50); // Reasonable memory usage
    });
  });
});