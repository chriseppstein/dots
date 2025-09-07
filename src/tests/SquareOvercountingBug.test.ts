import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../core/GameEngine';

describe('Square Overcounting Bug', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(3, 'local');
  });

  it('should correctly count 4+2 squares as 4+2, not 7+2', () => {
    console.log('=== Testing specific overcounting scenario ===');
    
    // Let's simulate a scenario where one cube has 4 faces for player 1 and 2 for player 2
    // This should be counted as exactly 4+2=6 total squares
    
    const state = engine.getState();
    console.log('Initial state - cubes:', state.cubes.length);
    
    // Let's manually assign faces to reproduce your exact scenario
    if (state.cubes.length > 0) {
      const testCube = state.cubes[0];
      console.log('Test cube has', testCube.faces.length, 'faces');
      
      // Assign 4 faces to player 1, 2 faces to player 2
      testCube.faces[0].player = state.players[0]; // Player 1
      testCube.faces[1].player = state.players[0]; // Player 1
      testCube.faces[2].player = state.players[0]; // Player 1 
      testCube.faces[3].player = state.players[0]; // Player 1
      testCube.faces[4].player = state.players[1]; // Player 2
      testCube.faces[5].player = state.players[1]; // Player 2
      
      // Trigger score update
      engine.makeMove({ x: 2, y: 2, z: 2 }, { x: 2, y: 2, z: 1 }); // Any valid move to trigger update
      
      const updatedState = engine.getState();
      
      console.log('Player 1 reported squares:', updatedState.players[0].squareCount);
      console.log('Player 2 reported squares:', updatedState.players[1].squareCount);
      console.log('Expected: Player 1=4, Player 2=2');
      
      // Manual count to verify
      let manualCount = { player1: 0, player2: 0 };
      for (const cube of updatedState.cubes) {
        for (const face of cube.faces) {
          if (face.player?.id === 'player1') {
            manualCount.player1++;
          } else if (face.player?.id === 'player2') {
            manualCount.player2++;
          }
        }
      }
      
      console.log('Manual count - Player 1:', manualCount.player1, 'Player 2:', manualCount.player2);
      
      // The bug: Player 1 shows 7 instead of 4
      expect(updatedState.players[0].squareCount).toBe(4);
      expect(updatedState.players[1].squareCount).toBe(2);
    }
  });

  it('should debug face sharing between adjacent cubes', () => {
    console.log('=== Debugging face sharing ===');
    
    const state = engine.getState();
    
    // Check if faces are shared between cubes (which would cause double counting)
    const allFaces = new Map<string, number>();
    
    for (let cubeIndex = 0; cubeIndex < state.cubes.length; cubeIndex++) {
      const cube = state.cubes[cubeIndex];
      console.log(`Cube ${cubeIndex} at position (${cube.position.x}, ${cube.position.y}, ${cube.position.z})`);
      
      for (let faceIndex = 0; faceIndex < cube.faces.length; faceIndex++) {
        const face = cube.faces[faceIndex];
        
        // Create a unique key for this face based on its corners
        const faceKey = face.corners
          .map(corner => `${corner.x},${corner.y},${corner.z}`)
          .sort()
          .join('|');
        
        if (allFaces.has(faceKey)) {
          console.log(`🚨 DUPLICATE FACE FOUND! Face appears in multiple cubes:`);
          console.log(`  Previous occurrence: cube ${allFaces.get(faceKey)}`);
          console.log(`  Current occurrence: cube ${cubeIndex}`);
          console.log(`  Face corners:`, face.corners);
        } else {
          allFaces.set(faceKey, cubeIndex);
        }
      }
    }
    
    console.log('Total unique faces:', allFaces.size);
    console.log('Total face instances:', state.cubes.reduce((sum, cube) => sum + cube.faces.length, 0));
    
    // Adjacent cubes share faces, so unique faces < total face instances (this is expected)
    const totalFaceInstances = state.cubes.reduce((sum, cube) => sum + cube.faces.length, 0);
    expect(allFaces.size).toBeLessThan(totalFaceInstances); // Shared faces mean fewer unique faces
    expect(allFaces.size).toBe(36); // For 2x2x2 cubes, there are 36 unique faces total
  });

  it('should verify cube creation logic', () => {
    console.log('=== Debugging cube creation ===');
    
    const state = engine.getState();
    
    // For a 3x3x3 grid, we should have 2x2x2 = 8 cubes
    console.log('Grid size:', state.gridSize);
    console.log('Number of cubes:', state.cubes.length);
    console.log('Expected cubes:', Math.pow(state.gridSize - 1, 3));
    
    expect(state.cubes.length).toBe(Math.pow(state.gridSize - 1, 3));
    
    // Each cube should have exactly 6 faces
    for (let i = 0; i < state.cubes.length; i++) {
      const cube = state.cubes[i];
      console.log(`Cube ${i}: ${cube.faces.length} faces`);
      expect(cube.faces.length).toBe(6);
    }
    
    // Total faces in the grid
    const totalFaces = state.cubes.length * 6;
    console.log('Total face instances:', totalFaces);
    
    // For a 2x2x2 cube arrangement:
    // - 8 cubes × 6 faces = 48 face instances
    // - But adjacent cubes share faces, so some faces appear in multiple cubes
    // - This could be the source of the overcounting!
  });
});