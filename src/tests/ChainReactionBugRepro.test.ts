import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateFixtures } from './fixtures/GameStateFixtures';
import { GameController } from '../core/GameController';
import { ChainReactionController } from '../core/ChainReactionController';
import { GameEngine } from '../core/GameEngine';

describe('Chain Reaction Bug Reproduction', () => {
  describe('Autoplay Chain Reaction Failed to Execute', () => {
    it('should execute chain reaction after the trigger move (BUG REPRODUCTION)', async () => {
      // Load the exact game state where autoplay failed to occur
      const fixture = GameStateFixtures.loadFixture('autoplay-didnt-occur.json');
      
      // Verify this is the correct state
      expect(fixture.gameState.autoplayChainReactions).toBe(true);
      expect(fixture.gameState.turn).toBe(23);
      expect(fixture.gameState.currentPlayer.name).toBe('Player 1');
      expect(fixture.gameState.currentPlayer.squareCount).toBe(7);
      
      // The actual last move from the fixture was:
      const actualLastMove = fixture.gameState.lastMove;
      console.log('Actual last move from fixture:', actualLastMove);
      
      // Create engine and controller with autoplay enabled
      const controller = GameStateFixtures.createControllerFromFixture(fixture);
      const engine = GameStateFixtures.createEngineFromFixture(fixture);
      
      // Verify initial state
      const initialState = engine.getState();
      console.log('Initial state - Turn:', initialState.turn, 'Lines:', initialState.lines.length);
      
      // Create chain reaction controller to verify chain opportunities exist
      const chainController = new ChainReactionController(engine);
      const initialChainOpportunities = chainController.findChainOpportunities();
      console.log('Chain opportunities in current state:', initialChainOpportunities.length);
      
      // The issue: This state should have chain opportunities from the last move!
      // If the last move was part of a chain reaction sequence, there might be more moves available
      
      // Check if there are chain opportunities from the last move that was made
      if (actualLastMove) {
        const hasChainFromLastMove = chainController.hasChainOpportunity(actualLastMove.start, actualLastMove.end);
        console.log('Chain opportunity from last move:', hasChainFromLastMove);
      }
      
      // Check what chain moves are actually available
      if (initialChainOpportunities.length > 0) {
        console.log('Available chain moves:');
        initialChainOpportunities.forEach((move, index) => {
          console.log(`  ${index + 1}:`, { start: move.start, end: move.end });
        });
        
        // BUG: If there are chain opportunities in the current state and autoplay is enabled,
        // the system should have automatically executed them when the state was saved!
        console.log('🐛 BUG DETECTED: Chain opportunities exist but autoplay did not execute them');
      } else {
        // If no current chain opportunities, let's try making the move that should have triggered them
        const triggerMove = { start: { x: 2, y: 2, z: 2 }, end: { x: 3, y: 2, z: 2 } };
        
        console.log('Testing potential trigger move:', triggerMove);
        const isValid = engine.isValidMove(triggerMove.start, triggerMove.end);
        console.log('Trigger move is valid:', isValid);
        
        if (isValid) {
          const moveSuccess = engine.makeMove(triggerMove.start, triggerMove.end);
          console.log('Trigger move success:', moveSuccess);
          
          if (moveSuccess) {
            const postMoveOpportunities = chainController.findChainOpportunities();
            console.log('Chain opportunities after trigger:', postMoveOpportunities.length);
            
            if (postMoveOpportunities.length > 0) {
              console.log('🐛 BUG CONFIRMED: Chain opportunities exist after trigger move but were not auto-executed');
            }
          }
        }
      }
      
      // The bug exists if:
      // 1. Autoplay is enabled AND
      // 2. Chain opportunities exist in the current state OR after the next logical move
      const bugExists = fixture.gameState.autoplayChainReactions && 
                        (initialChainOpportunities.length > 0);
      
      if (bugExists) {
        console.log('🔴 AUTOPLAY BUG CONFIRMED: Chain opportunities available but not auto-executed');
      }
      
      // This test documents the bug - it should pass when the bug exists, fail when fixed
      expect(bugExists).toBe(true); // Bug exists in current state
    });

    it('should detect chain opportunities in the problematic state', () => {
      // Load the state and verify chain opportunities exist
      const fixture = GameStateFixtures.loadFixture('autoplay-didnt-occur.json');
      const engine = GameStateFixtures.createEngineFromFixture(fixture);
      const chainController = new ChainReactionController(engine);
      
      // Check for existing chain opportunities in the loaded state
      const initialChainOpportunities = chainController.findChainOpportunities();
      console.log('Chain opportunities in initial state:', initialChainOpportunities.length);
      
      // Make the trigger move
      const triggerMove = { start: { x: 2, y: 2, z: 2 }, end: { x: 3, y: 2, z: 2 } };
      const moveSuccess = engine.makeMove(triggerMove.start, triggerMove.end);
      expect(moveSuccess).toBe(true);
      
      // Check if this move creates new chain opportunities
      const postMoveOpportunities = chainController.findChainOpportunities();
      console.log('Chain opportunities after trigger move:', postMoveOpportunities.length);
      
      // The bug: chain opportunities should exist after the trigger move
      expect(postMoveOpportunities.length).toBeGreaterThan(0);
    });
  });
});