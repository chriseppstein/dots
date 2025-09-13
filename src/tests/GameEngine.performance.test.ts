import { describe, it, expect } from 'vitest';
import { GameEngine } from '../core/GameEngine';
import { GridSize, Line } from '../core/types';

describe('GameEngine Performance Tests', () => {
  const measureLineCheckingPerformance = (gridSize: GridSize) => {
    const engine = new GameEngine(gridSize, 'local');
    
    // Make some moves to populate the lines array
    const possibleMoves = engine.getPossibleMoves();
    const movesToMake = Math.min(50, possibleMoves.length);
    
    for (let i = 0; i < movesToMake; i++) {
      const move = possibleMoves[i];
      engine.makeMove(move.start, move.end);
    }
    
    const state = engine.getState();
    const drawnLinesCount = state.lines.length;
    
    // Measure time to check many lines
    const testLines: Line[] = [];
    for (let i = 0; i < 100; i++) {
      const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      testLines.push(randomMove);
    }
    
    const startTime = performance.now();
    
    // Simulate what happens during move validation
    for (const line of testLines) {
      // This simulates isLineAlreadyDrawn check
      const isDrawn = state.lines.some(drawnLine => 
        (drawnLine.start.x === line.start.x && drawnLine.start.y === line.start.y && drawnLine.start.z === line.start.z &&
         drawnLine.end.x === line.end.x && drawnLine.end.y === line.end.y && drawnLine.end.z === line.end.z) ||
        (drawnLine.start.x === line.end.x && drawnLine.start.y === line.end.y && drawnLine.start.z === line.end.z &&
         drawnLine.end.x === line.start.x && drawnLine.end.y === line.start.y && drawnLine.end.z === line.start.z)
      );
    }
    
    const endTime = performance.now();
    
    return {
      time: endTime - startTime,
      drawnLinesCount,
      checksPerformed: testLines.length,
      gridSize
    };
  };

  it('should check lines quickly for 3x3x3 grid', () => {
    const result = measureLineCheckingPerformance(3);
    console.log(`3x3x3: ${result.time.toFixed(2)}ms for ${result.checksPerformed} checks against ${result.drawnLinesCount} drawn lines`);
    expect(result.time).toBeLessThan(10);
  });

  it('should check lines quickly for 4x4x4 grid', () => {
    const result = measureLineCheckingPerformance(4);
    console.log(`4x4x4: ${result.time.toFixed(2)}ms for ${result.checksPerformed} checks against ${result.drawnLinesCount} drawn lines`);
    expect(result.time).toBeLessThan(20);
  });

  it('should check lines quickly for 5x5x5 grid', () => {
    const result = measureLineCheckingPerformance(5);
    console.log(`5x5x5: ${result.time.toFixed(2)}ms for ${result.checksPerformed} checks against ${result.drawnLinesCount} drawn lines`);
    expect(result.time).toBeLessThan(30);
  });

  it('should measure getPossibleMoves performance', () => {
    const results: any[] = [];
    
    for (const gridSize of [3, 4, 5] as GridSize[]) {
      const engine = new GameEngine(gridSize, 'local');
      
      // Make some moves to create a mid-game state
      const initialMoves = engine.getPossibleMoves();
      const movesToMake = Math.min(30, initialMoves.length);
      
      for (let i = 0; i < movesToMake; i++) {
        const move = initialMoves[i];
        engine.makeMove(move.start, move.end);
      }
      
      // Measure getPossibleMoves performance
      const startTime = performance.now();
      const possibleMoves = engine.getPossibleMoves();
      const endTime = performance.now();
      
      const time = endTime - startTime;
      results.push({
        gridSize,
        time,
        movesFound: possibleMoves.length,
        drawnLines: engine.getState().lines.length
      });
      
      console.log(`${gridSize}x${gridSize}x${gridSize}: ${time.toFixed(2)}ms to find ${possibleMoves.length} possible moves (${engine.getState().lines.length} lines drawn)`);
    }
    
    // Check that performance doesn't degrade too badly
    const smallGridTime = results[0].time;
    const largeGridTime = results[2].time;
    const scalingFactor = largeGridTime / smallGridTime;
    
    expect(scalingFactor).toBeLessThan(20);
    console.log(`getPossibleMoves scaling factor: ${scalingFactor.toFixed(2)}x from 3x3x3 to 5x5x5`);
  });

  it('should benchmark makeMove performance', () => {
    const gridSize: GridSize = 4;
    const engine = new GameEngine(gridSize, 'local');
    const possibleMoves = engine.getPossibleMoves();
    
    // Measure time for multiple moves
    const movesToTest = Math.min(20, possibleMoves.length);
    const times: number[] = [];
    
    for (let i = 0; i < movesToTest; i++) {
      const move = possibleMoves[i];
      const startTime = performance.now();
      const success = engine.makeMove(move.start, move.end);
      const endTime = performance.now();
      
      if (success) {
        times.push(endTime - startTime);
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    
    console.log(`makeMove avg: ${avgTime.toFixed(2)}ms, max: ${maxTime.toFixed(2)}ms (${times.length} moves)`);
    expect(avgTime).toBeLessThan(5);
    expect(maxTime).toBeLessThan(10);
  });
});