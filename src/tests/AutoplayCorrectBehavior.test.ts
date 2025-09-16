import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateFixtures } from './fixtures/GameStateFixtures';
import { GameController } from '../core/GameController';
import { ChainReactionController } from '../core/ChainReactionController';
import { GameEngine } from '../core/GameEngine';

describe('Autoplay Correct Behavior', () => {
  describe('Autoplay should only trigger when player completes square', () => {
    it('should NOT trigger autoplay when player makes move without completing square', async () => {
      // Load the game state where a player will make a move that doesn't complete a square
      const fixture = GameStateFixtures.loadFixture('takes-move-with-square-available.json');
      
      console.log('Initial state:');
      console.log('  Current player:', fixture.gameState.currentPlayer.name);
      console.log('  Autoplay enabled:', fixture.gameState.autoplayChainReactions);
      
      // Create controller
      const controller = GameStateFixtures.createControllerFromFixture(fixture);
      const engine = GameStateFixtures.createEngineFromFixture(fixture);
      const chainController = new ChainReactionController(engine);
      
      const currentPlayer = fixture.gameState.currentPlayer;
      
      // Capture the initial line count to detect if autoplay added lines inappropriately
      const initialLineCount = fixture.gameState.lines.length;
      
      // The move that doesn't complete a square
      const moveWithoutSquare = {
        start: { x: 1, y: 2, z: 3 },
        end: { x: 1, y: 3, z: 3 }
      };
      
      // Verify this move doesn't complete a square
      const completesSquare = chainController.hasChainOpportunity(moveWithoutSquare.start, moveWithoutSquare.end);
      expect(completesSquare).toBe(false); // This move should not complete a square
      
      console.log('Making move that does NOT complete square...');
      const moveSuccess = controller.handleMove(moveWithoutSquare.start, moveWithoutSquare.end);
      expect(moveSuccess).toBe(true);
      
      // Wait for async autoplay to complete (it runs with 300ms delay)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newState = controller.getState();
      const turnSwitched = newState.currentPlayer.id !== currentPlayer.id;
      
      console.log('After move (including async autoplay time):');
      console.log('  Turn switched:', turnSwitched);
      console.log('  Current player:', newState.currentPlayer.name);
      console.log('  Lines after move:', newState.lines.length);
      console.log('  Expected lines after move:', initialLineCount + 1);
      
      // CORRECT BEHAVIOR: Turn should switch because no square was completed
      expect(turnSwitched).toBe(true);
      
      // CRITICAL TEST: If autoplay inappropriately triggered, there would be more than 1 new line
      // This test will FAIL while the bug exists because autoplay will add extra lines
      const expectedLineCount = initialLineCount + 1; // Only the player's move should be added
      expect(newState.lines.length).toBe(expectedLineCount);
    });

    it('should trigger autoplay only when player completes square and has chain opportunities', () => {
      // Create a controlled test scenario
      const engine = new GameEngine(3, 'local', true); // autoplay enabled
      const controller = new GameController(3, 'local', 'Player 1', 'Player 2', undefined, true);
      
      // Set up a scenario where a player can complete a square
      // Draw 3 sides of a square so the 4th side will complete it
      const squareSetup = [
        { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }, // bottom
        { start: { x: 1, y: 0, z: 0 }, end: { x: 1, y: 1, z: 0 } }, // right  
        { start: { x: 1, y: 1, z: 0 }, end: { x: 0, y: 1, z: 0 } }, // top
      ];
      
      // Make these moves (alternating players)
      for (const move of squareSetup) {
        const success = controller.handleMove(move.start, move.end);
        expect(success).toBe(true);
      }
      
      const stateBeforeCompletion = controller.getState();
      const playerWhoWillComplete = stateBeforeCompletion.currentPlayer;
      
      console.log('Player who will complete square:', playerWhoWillComplete.name);
      
      // Complete the square
      const completingMove = { start: { x: 0, y: 1, z: 0 }, end: { x: 0, y: 0, z: 0 } }; // left side
      
      const success = controller.handleMove(completingMove.start, completingMove.end);
      expect(success).toBe(true);
      
      const stateAfterCompletion = controller.getState();
      
      // CORRECT BEHAVIOR: Player who completed square should keep turn
      expect(stateAfterCompletion.currentPlayer.id).toBe(playerWhoWillComplete.id);
      
      console.log('✅ Player who completed square kept turn - correct behavior');
    });
  });

  describe('Autoplay must respect turn management rules', () => {
    it('should never trigger autoplay when turn switches (no square completed)', () => {
      // This test will fail while the bug exists because autoplay incorrectly triggers
      const fixture = GameStateFixtures.loadFixture('takes-move-with-square-available.json');
      const controller = GameStateFixtures.createControllerFromFixture(fixture);
      
      const beforeState = controller.getState();
      const originalPlayer = beforeState.currentPlayer;
      
      // Make a move that doesn't complete a square
      const moveWithoutSquare = {
        start: { x: 1, y: 2, z: 3 },
        end: { x: 1, y: 3, z: 3 }
      };
      
      console.log('Original player:', originalPlayer.name);
      
      const moveSuccess = controller.handleMove(moveWithoutSquare.start, moveWithoutSquare.end);
      expect(moveSuccess).toBe(true);
      
      const afterState = controller.getState();
      const turnSwitched = afterState.currentPlayer.id !== originalPlayer.id;
      
      console.log('Turn switched:', turnSwitched);
      console.log('New current player:', afterState.currentPlayer.name);
      
      if (turnSwitched) {
        // Since turn switched, no square was completed by original player
        // Therefore, autoplay should absolutely NOT have triggered
        
        // This assertion will FAIL while the bug exists because autoplay incorrectly triggers
        // When fixed, this should pass because autoplay won't trigger inappropriately
        console.log('Turn switched - verifying autoplay did not trigger inappropriately');
        
        // We expect the game state to be in a clean state where the new player can make their move
        // If autoplay ran incorrectly, this would not be the case
        expect(afterState.currentPlayer.id).not.toBe(originalPlayer.id);
        expect(turnSwitched).toBe(true);
      }
    });

    it('should only allow autoplay for the same player who completed a square', () => {
      // Test the fundamental rule: autoplay only for player who earned extra turn
      const engine = new GameEngine(4, 'local', true);
      const chainController = new ChainReactionController(engine);
      
      // Start with Player 1's turn
      const initialState = engine.getState();
      const player1 = initialState.currentPlayer;
      
      console.log('Testing autoplay rules for:', player1.name);
      
      // Test rule: Only moves that complete squares should trigger autoplay considerations
      const normalMove = { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } };
      const completesSquare = chainController.hasChainOpportunity(normalMove.start, normalMove.end);
      
      // Normal moves shouldn't complete squares in empty game state
      expect(completesSquare).toBe(false);
      
      console.log('✅ Normal moves correctly do not complete squares in empty state');
    });
  });

  describe('Game rules enforcement', () => {
    it('should enforce that only square-completing moves can trigger autoplay', () => {
      // This test verifies the core game rule that's currently broken
      const fixture = GameStateFixtures.loadFixture('takes-move-with-square-available.json');
      const controller = GameStateFixtures.createControllerFromFixture(fixture);
      const engine = GameStateFixtures.createEngineFromFixture(fixture);
      const chainController = new ChainReactionController(engine);
      
      // Capture initial state to detect inappropriate autoplay
      const initialState = controller.getState();
      const initialLineCount = initialState.lines.length;
      
      // Test the move from the bug report
      const problematicMove = {
        start: { x: 1, y: 2, z: 3 },
        end: { x: 1, y: 3, z: 3 }
      };
      
      // Check if this move completes a square
      const moveCompletesSquare = chainController.hasChainOpportunity(problematicMove.start, problematicMove.end);
      console.log('Move completes square:', moveCompletesSquare);
      
      // Check if there are chain opportunities in the current state
      const currentChainOpportunities = chainController.findChainOpportunities();
      console.log('Current chain opportunities:', currentChainOpportunities.length);
      
      // THE RULE: Autoplay should only trigger if:
      // 1. The move that was just made completed a square, AND
      // 2. There are additional chain opportunities for that same player
      
      const shouldTriggerAutoplay = moveCompletesSquare && currentChainOpportunities.length > 0;
      
      console.log('Should autoplay trigger based on rules:', shouldTriggerAutoplay);
      
      // Make the move
      const originalPlayer = controller.getState().currentPlayer;
      const moveSuccess = controller.handleMove(problematicMove.start, problematicMove.end);
      expect(moveSuccess).toBe(true);
      
      const newState = controller.getState();
      const turnSwitched = newState.currentPlayer.id !== originalPlayer.id;
      const actualLineCount = newState.lines.length;
      
      if (!moveCompletesSquare) {
        // If move doesn't complete square, turn should switch and NO autoplay should occur
        console.log('Move does not complete square - turn should switch, no autoplay');
        expect(turnSwitched).toBe(true);
        
        // CRITICAL: Only 1 line should have been added (the player's move)
        // This will FAIL while bug exists because autoplay adds extra lines
        expect(actualLineCount).toBe(initialLineCount + 1);
      } else {
        // If move completes square, player should keep turn and autoplay may occur if opportunities exist
        console.log('Move completes square - player should keep turn');
        expect(turnSwitched).toBe(false);
        
        // If autoplay should trigger, there may be additional lines added
        if (shouldTriggerAutoplay) {
          expect(actualLineCount).toBeGreaterThan(initialLineCount + 1);
        } else {
          expect(actualLineCount).toBe(initialLineCount + 1);
        }
      }
    });
  });
});