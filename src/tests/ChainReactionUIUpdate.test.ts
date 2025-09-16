import { describe, it, expect, vi } from 'vitest';
import { GameStateFixtures } from './fixtures/GameStateFixtures';
import { ChainReactionController, ChainEvent } from '../core/ChainReactionController';
import { GameBoard } from '../components/GameBoard';

describe('Chain Reaction UI Updates', () => {
  it('should notify UI listeners during chain reaction execution', async () => {
    // Load a game state where chain reactions will occur
    const fixture = GameStateFixtures.loadFixture('autoplay-didnt-occur-2.json');
    
    console.log('Setting up chain reaction UI update test');
    console.log('  Autoplay enabled:', fixture.gameState.autoplayChainReactions);
    
    // Create controller 
    const controller = GameStateFixtures.createControllerFromFixture(fixture);
    
    // Get the internal chain controller from GameController 
    const chainController = controller.getChainController();
    expect(chainController).toBeDefined();
    
    // Create spy functions to track UI update calls
    const chainMoveSpy = vi.fn();
    const chainCompleteSpy = vi.fn();
    
    // Register listeners for chain events on the GameController's internal chain controller
    console.log('Registering UI update listeners...');
    chainController!.onChainMove(chainMoveSpy);
    chainController!.onChainComplete(chainCompleteSpy);
    
    // The move that will trigger a chain reaction
    const triggerMove = {
      start: { x: 0, y: 3, z: 1 },
      end: { x: 1, y: 3, z: 1 }
    };
    
    console.log('Making trigger move:', triggerMove);
    
    // Verify this move will complete a square
    const completesSquare = chainController.hasChainOpportunity(triggerMove.start, triggerMove.end);
    expect(completesSquare).toBe(true);
    
    const initialLineCount = fixture.gameState.lines.length;
    console.log('Initial line count:', initialLineCount);
    
    // Make the move through the controller (this should trigger autoplay)
    const moveSuccess = controller.handleMove(triggerMove.start, triggerMove.end);
    expect(moveSuccess).toBe(true);
    
    // Wait for async chain reaction to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalState = controller.getState();
    const finalLineCount = finalState.lines.length;
    const linesAdded = finalLineCount - initialLineCount;
    
    console.log('After chain reaction:');
    console.log('  Final line count:', finalLineCount);
    console.log('  Total lines added:', linesAdded);
    console.log('  Chain move events fired:', chainMoveSpy.mock.calls.length);
    console.log('  Chain complete events fired:', chainCompleteSpy.mock.calls.length);
    
    // Verify chain reaction occurred
    expect(linesAdded).toBeGreaterThan(1); // Should have added player move + autoplay moves
    
    // BUG CHECK: UI listeners should have been called during chain execution
    // This will FAIL while the bug exists because no listeners are registered by GameController
    expect(chainMoveSpy).toHaveBeenCalled();
    expect(chainCompleteSpy).toHaveBeenCalled();
    
    // Verify the chain events contain proper move information
    if (chainMoveSpy.mock.calls.length > 0) {
      const firstChainEvent: ChainEvent = chainMoveSpy.mock.calls[0][0];
      expect(firstChainEvent).toHaveProperty('move');
      expect(firstChainEvent).toHaveProperty('player');
      expect(firstChainEvent).toHaveProperty('isAutomated');
      expect(firstChainEvent.isAutomated).toBe(true);
      
      console.log('✅ Chain move events contain proper structure');
    }
  });
  
  it('should expose chain controller for UI components to register listeners', () => {
    // This test demonstrates that the fix is working
    const fixture = GameStateFixtures.loadFixture('autoplay-didnt-occur-2.json');
    const controller = GameStateFixtures.createControllerFromFixture(fixture);
    
    // GameController now exposes its internal ChainReactionController
    const chainController = controller.getChainController();
    
    console.log('Testing that GameController exposes chain controller for UI registration');
    
    // Verify that we can access the chain controller
    expect(chainController).toBeDefined();
    
    if (chainController) {
      // Create a spy that tracks if it gets called
      const listenerSpy = vi.fn();
      
      // Register our spy as a listener on the GameController's internal chain controller
      chainController.onChainMove(listenerSpy);
      
      console.log('✅ Chain controller is accessible for UI listener registration');
      console.log('✅ UI components can now register for chain reaction events');
    }
  });

  it('should integrate chain reaction events with GameBoard UI updates', async () => {
    // Create a GameBoard component (this simulates the real UI integration)
    const gameBoard = new GameBoard();
    document.body.appendChild(gameBoard);
    
    // Mock the render container to avoid WebGL issues in test environment
    const mockContainer = document.createElement('div');
    (gameBoard as any).renderContainer = undefined; // Disable WebGL renderer creation
    
    try {
      // Load the fixture and start a game with autoplay
      const fixture = GameStateFixtures.loadFixture('autoplay-didnt-occur-2.json');
      
      console.log('Starting game through GameBoard with autoplay enabled (no renderer)');
      
      // Start game with autoplay enabled (this should register chain listeners)
      gameBoard.startGame(
        fixture.gameState.gridSize,
        'local',
        fixture.gameState.players[0].name,
        fixture.gameState.players[1].name,
        undefined, // no network manager
        undefined, // no game state override
        true // enable autoplay
      );
      
      // Spy on console.log to capture chain reaction messages
      const consoleSpy = vi.spyOn(console, 'log');
      
      // Get the controller from GameBoard (access its internal controller)
      const controller = (gameBoard as any).controller;
      expect(controller).toBeDefined();
      
      // Load the fixture state into the game
      controller.initializeWithState(fixture.gameState);
      
      // The trigger move that should cause chain reactions
      const triggerMove = {
        start: { x: 0, y: 3, z: 1 },
        end: { x: 1, y: 3, z: 1 }
      };
      
      console.log('Making trigger move through GameBoard UI integration...');
      
      const initialLineCount = fixture.gameState.lines.length;
      const moveSuccess = controller.handleMove(triggerMove.start, triggerMove.end);
      expect(moveSuccess).toBe(true);
      
      // Wait for async chain reactions
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalState = controller.getState();
      const linesAdded = finalState.lines.length - initialLineCount;
      
      console.log('Chain reaction completed:', linesAdded, 'lines added');
      
      // Verify chain reaction occurred
      expect(linesAdded).toBeGreaterThan(1);
      
      // Verify that chain reaction console messages were logged by GameBoard
      const chainMoveLogs = consoleSpy.mock.calls.filter(call => 
        call[0] && call[0].includes('🔗 Chain move:')
      );
      const chainCompleteLogs = consoleSpy.mock.calls.filter(call => 
        call[0] && call[0].includes('✅ Chain complete:')
      );
      
      console.log('Chain move logs captured:', chainMoveLogs.length);
      console.log('Chain complete logs captured:', chainCompleteLogs.length);
      
      // These should now pass - GameBoard registered the listeners and logged the events
      expect(chainMoveLogs.length).toBeGreaterThan(0);
      expect(chainCompleteLogs.length).toBe(1);
      
      consoleSpy.mockRestore();
      
    } finally {
      // Clean up
      document.body.removeChild(gameBoard);
    }
  });
});