import { describe, it, expect, beforeEach } from 'vitest';
import { GameRenderer } from '../core/GameRenderer';
import { Line, Point3D } from '../core/types';

/**
 * Performance test for mouse hover detection
 * Current implementation: O(n³) iteration through all possible lines
 * Target: <1ms per hover detection
 */
describe('Mouse Hover Performance', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  describe('Baseline Performance', () => {
    it('should measure getHoveredLine performance on different grid sizes', () => {
      const gridSizes = [3, 4, 5] as const;
      const results: Record<number, { avgTime: number; maxTime: number; iterations: number }> = {};
      
      for (const gridSize of gridSizes) {
        const renderer = new GameRenderer(container, gridSize);
        
        // Access private method via any cast for testing
        const getHoveredLine = (renderer as any).getHoveredLine.bind(renderer);
        
        // Warm up to ensure JIT optimization
        for (let i = 0; i < 10; i++) {
          getHoveredLine();
        }
        
        // Measure performance
        const times: number[] = [];
        const iterations = 100;
        
        for (let i = 0; i < iterations; i++) {
          // Simulate different mouse positions
          (renderer as any).mouse.x = (Math.random() - 0.5) * 2;
          (renderer as any).mouse.y = (Math.random() - 0.5) * 2;
          
          const startTime = performance.now();
          getHoveredLine();
          const endTime = performance.now();
          
          times.push(endTime - startTime);
        }
        
        const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
        const maxTime = Math.max(...times);
        
        // Calculate theoretical iterations
        const theoreticalIterations = gridSize * gridSize * gridSize * 3; // O(n³)
        
        results[gridSize] = { avgTime, maxTime, iterations: theoreticalIterations };
        
        console.log(`Grid ${gridSize}x${gridSize}x${gridSize}:`);
        console.log(`  Theoretical iterations: ${theoreticalIterations}`);
        console.log(`  Average time: ${avgTime.toFixed(3)}ms`);
        console.log(`  Max time: ${maxTime.toFixed(3)}ms`);
        console.log(`  Time per iteration: ${(avgTime / theoreticalIterations * 1000).toFixed(3)}µs`);
        
        renderer.dispose();
      }
      
      // Performance assertions
      expect(results[3].avgTime).toBeLessThan(5); // 3x3x3 should be fast
      expect(results[4].avgTime).toBeLessThan(10); // 4x4x4 should be reasonable
      expect(results[5].avgTime).toBeLessThan(20); // 5x5x5 current implementation may be slow
      
      // Check scaling - should be roughly O(n³)
      const scalingFactor = results[5].avgTime / results[3].avgTime;
      const theoreticalScaling = (5 * 5 * 5 * 3) / (3 * 3 * 3 * 3);
      console.log(`\nScaling factor (5x5x5 vs 3x3x3): ${scalingFactor.toFixed(2)}x`);
      console.log(`Theoretical scaling: ${theoreticalScaling.toFixed(2)}x`);
    });

    it('should measure impact of mouse hover on frame rate', () => {
      const renderer = new GameRenderer(container, 4);
      
      // Measure time for multiple hover detections (simulating mouse movement)
      const startTime = performance.now();
      const movements = 60; // Simulate 1 second of 60fps mouse movement
      
      for (let i = 0; i < movements; i++) {
        // Simulate mouse movement
        (renderer as any).mouse.x = Math.sin(i / 10) * 0.8;
        (renderer as any).mouse.y = Math.cos(i / 10) * 0.8;
        
        // Call the expensive hover detection
        (renderer as any).getHoveredLine();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerFrame = totalTime / movements;
      
      console.log(`\nFrame impact test (4x4x4 grid):`);
      console.log(`  Total time for ${movements} frames: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time per frame: ${avgTimePerFrame.toFixed(3)}ms`);
      console.log(`  Theoretical max FPS with hover: ${(1000 / avgTimePerFrame).toFixed(1)}fps`);
      
      // Should not consume more than 8ms per frame to maintain 60fps with overhead
      expect(avgTimePerFrame).toBeLessThan(8);
      
      renderer.dispose();
    });

    it('should profile individual operations in getHoveredLine', () => {
      const renderer = new GameRenderer(container, 3);
      
      // Profile different parts of the operation
      const raycasterTime: number[] = [];
      const iterationTime: number[] = [];
      const distanceCalcTime: number[] = [];
      
      // We'll need to temporarily modify the method to measure parts
      // For now, measure the whole operation and estimate
      
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        (renderer as any).mouse.x = (Math.random() - 0.5) * 2;
        (renderer as any).mouse.y = (Math.random() - 0.5) * 2;
        
        // Measure raycaster setup
        const t1 = performance.now();
        (renderer as any).raycaster.setFromCamera((renderer as any).mouse, (renderer as any).camera);
        const t2 = performance.now();
        raycasterTime.push(t2 - t1);
        
        // Measure full operation to get iteration time
        const t3 = performance.now();
        (renderer as any).getHoveredLine();
        const t4 = performance.now();
        iterationTime.push(t4 - t3 - (t2 - t1)); // Subtract raycaster time
      }
      
      const avgRaycasterTime = raycasterTime.reduce((sum, t) => sum + t, 0) / raycasterTime.length;
      const avgIterationTime = iterationTime.reduce((sum, t) => sum + t, 0) / iterationTime.length;
      
      console.log(`\nOperation profiling (3x3x3 grid):`);
      console.log(`  Raycaster setup: ${avgRaycasterTime.toFixed(3)}ms`);
      console.log(`  Line iteration & distance calc: ${avgIterationTime.toFixed(3)}ms`);
      console.log(`  Raycaster %: ${((avgRaycasterTime / (avgRaycasterTime + avgIterationTime)) * 100).toFixed(1)}%`);
      console.log(`  Iteration %: ${((avgIterationTime / (avgRaycasterTime + avgIterationTime)) * 100).toFixed(1)}%`);
      
      renderer.dispose();
    });
  });

  describe('Optimization Targets', () => {
    it('should establish performance targets for optimization', () => {
      const targets = {
        '3x3x3': { target: 0.5, acceptable: 1.0 },  // Target <0.5ms, acceptable <1ms
        '4x4x4': { target: 0.8, acceptable: 2.0 },  // Target <0.8ms, acceptable <2ms
        '5x5x5': { target: 1.0, acceptable: 3.0 },  // Target <1ms, acceptable <3ms
      };
      
      console.log('\n=== PERFORMANCE TARGETS ===');
      console.log('Grid Size | Target | Acceptable | Current (estimate)');
      console.log('----------|--------|------------|------------------');
      
      for (const [grid, values] of Object.entries(targets)) {
        const size = parseInt(grid[0]);
        const currentEstimate = size * size * size * 0.001; // Rough estimate
        console.log(`${grid}    | ${values.target}ms  | ${values.acceptable}ms      | ~${currentEstimate.toFixed(1)}ms`);
      }
      
      console.log('\nOptimization approaches:');
      console.log('1. Pre-compute all possible lines during initialization');
      console.log('2. Use spatial hashing for line lookup');
      console.log('3. Cache line-ray distances between frames');
      console.log('4. Use bounding volume hierarchy (BVH)');
      console.log('5. Implement early exit when close line found');
    });
  });
});