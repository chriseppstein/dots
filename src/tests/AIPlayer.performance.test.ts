import { describe, it, expect, beforeEach } from 'vitest';
import { AIPlayer } from '../ai/AIPlayer';
import { GameEngine } from '../core/GameEngine';
import { GridSize } from '../core/types';

describe('AIPlayer Performance Tests', () => {
  const measureAIPerformance = (gridSize: GridSize, moveCount: number = 10) => {
    const engine = new GameEngine(gridSize, 'ai');
    const aiPlayer = new AIPlayer(engine);
    
    // Make some initial moves to create a mid-game state
    const possibleMoves = engine.getPossibleMoves();
    for (let i = 0; i < Math.min(moveCount, possibleMoves.length); i++) {
      if (i % 2 === 0) {
        engine.makeMove(possibleMoves[i].start, possibleMoves[i].end);
      }
    }
    
    // Measure AI move calculation time
    const startTime = performance.now();
    const move = aiPlayer.getNextMove();
    const endTime = performance.now();
    
    return {
      time: endTime - startTime,
      moveFound: move !== null,
      gridSize,
      possibleMovesCount: engine.getPossibleMoves().length
    };
  };

  it('should calculate moves quickly for 3x3x3 grid', () => {
    const result = measureAIPerformance(3);
    expect(result.moveFound).toBe(true);
    expect(result.time).toBeLessThan(50); // Should be under 50ms
    console.log(`3x3x3 AI move time: ${result.time.toFixed(2)}ms (${result.possibleMovesCount} possible moves)`);
  });

  it('should calculate moves quickly for 4x4x4 grid', () => {
    const result = measureAIPerformance(4);
    expect(result.moveFound).toBe(true);
    expect(result.time).toBeLessThan(100); // Should be under 100ms
    console.log(`4x4x4 AI move time: ${result.time.toFixed(2)}ms (${result.possibleMovesCount} possible moves)`);
  });

  it('should calculate moves quickly for 5x5x5 grid', () => {
    const result = measureAIPerformance(5);
    expect(result.moveFound).toBe(true);
    expect(result.time).toBeLessThan(200); // Should be under 200ms
    console.log(`5x5x5 AI move time: ${result.time.toFixed(2)}ms (${result.possibleMovesCount} possible moves)`);
  });

  it('should handle late-game scenarios efficiently', () => {
    const gridSize = 4;
    const engine = new GameEngine(gridSize, 'ai');
    const aiPlayer = new AIPlayer(engine);
    
    // Simulate late game by making many moves
    const possibleMoves = engine.getPossibleMoves();
    const movesToMake = Math.floor(possibleMoves.length * 0.7); // 70% of moves
    
    for (let i = 0; i < movesToMake && i < possibleMoves.length; i++) {
      const move = possibleMoves[i];
      engine.makeMove(move.start, move.end);
    }
    
    // Measure AI performance in late game
    const startTime = performance.now();
    const move = aiPlayer.getNextMove();
    const endTime = performance.now();
    const time = endTime - startTime;
    
    expect(move).toBeDefined();
    expect(time).toBeLessThan(150); // Should still be responsive
    console.log(`Late-game AI move time: ${time.toFixed(2)}ms (${engine.getPossibleMoves().length} remaining moves)`);
  });

  it('should benchmark move evaluation performance', () => {
    const results: any[] = [];
    
    for (const gridSize of [3, 4, 5] as GridSize[]) {
      const engine = new GameEngine(gridSize, 'ai');
      const aiPlayer = new AIPlayer(engine);
      
      // Warm up
      aiPlayer.getNextMove();
      
      // Measure multiple iterations
      const iterations = 10;
      let totalTime = 0;
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        aiPlayer.getNextMove();
        const endTime = performance.now();
        totalTime += endTime - startTime;
      }
      
      const avgTime = totalTime / iterations;
      results.push({
        gridSize,
        avgTime,
        totalPossibleMoves: engine.getPossibleMoves().length
      });
      
      console.log(`${gridSize}x${gridSize}x${gridSize}: avg ${avgTime.toFixed(2)}ms for ${engine.getPossibleMoves().length} possible moves`);
    }
    
    // Verify performance doesn't degrade too much with grid size
    const smallGridTime = results[0].avgTime;
    const largeGridTime = results[2].avgTime;
    const scalingFactor = largeGridTime / smallGridTime;
    
    expect(scalingFactor).toBeLessThan(15); // Should not scale worse than 15x
    console.log(`Performance scaling factor: ${scalingFactor.toFixed(2)}x from 3x3x3 to 5x5x5`);
  });
});