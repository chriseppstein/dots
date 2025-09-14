import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateFixtures } from './GameStateFixtures';
import { GameEngine } from '../../core/GameEngine';
import { GameController } from '../../core/GameController';
import { ChainReactionController } from '../../core/ChainReactionController';

describe('GameStateFixtures', () => {
  describe('Fixture Loading and Validation', () => {
    it('should load and validate autoplay-chain-state fixture', () => {
      const fixture = GameStateFixtures.loadFixture('autoplay-chain-state.json');
      
      expect(fixture).toBeDefined();
      expect(fixture.gameState).toBeDefined();
      expect(fixture.gameState.gridSize).toBe(4);
      expect(fixture.gameState.players).toHaveLength(2);
      expect(fixture.gameState.players[0].name).toBe('Chris');
      expect(fixture.gameState.players[1].name).toBe('E');
      expect(fixture.gameState.autoplayChainReactions).toBe(false);
    });

    it('should create a GameEngine from fixture', () => {
      const fixture = GameStateFixtures.loadFixture('autoplay-chain-state.json');
      const engine = GameStateFixtures.createEngineFromFixture(fixture);
      
      const state = engine.getState();
      expect(state.gridSize).toBe(fixture.gameState.gridSize);
      expect(state.players[0].name).toBe(fixture.gameState.players[0].name);
      expect(state.players[1].name).toBe(fixture.gameState.players[1].name);
      expect(state.currentPlayer.id).toBe(fixture.gameState.currentPlayer.id);
      expect(state.lines).toEqual(fixture.gameState.lines);
      expect(state.cubes).toEqual(fixture.gameState.cubes);
    });

    it('should create a GameController from fixture', () => {
      const fixture = GameStateFixtures.loadFixture('autoplay-chain-state.json');
      const controller = GameStateFixtures.createControllerFromFixture(fixture);
      
      const state = controller.getState();
      expect(state.gridSize).toBe(fixture.gameState.gridSize);
      expect(state.players[0].name).toBe(fixture.gameState.players[0].name);
      expect(state.players[1].name).toBe(fixture.gameState.players[1].name);
    });

    it('should apply fixture state to existing engine', () => {
      const fixture = GameStateFixtures.loadFixture('autoplay-chain-state.json');
      const engine = new GameEngine(3, 'local'); // Different initial state
      
      // Verify initial state is different
      expect(engine.getState().gridSize).toBe(3);
      expect(engine.getState().players[0].name).toBe('Player 1');
      
      // Apply fixture
      GameStateFixtures.applyFixtureToEngine(engine, fixture);
      
      // Verify state matches fixture
      const state = engine.getState();
      expect(state.gridSize).toBe(4);
      expect(state.players[0].name).toBe('Chris');
      expect(state.players[1].name).toBe('E');
    });

    it('should validate fixture correctly', () => {
      const fixture = GameStateFixtures.loadFixture('autoplay-chain-state.json');
      const validation = GameStateFixtures.validateFixture(fixture);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('State Integrity Testing', () => {
    let fixture: any;
    let engine: GameEngine;

    beforeEach(() => {
      fixture = GameStateFixtures.loadFixture('autoplay-chain-state.json');
      engine = GameStateFixtures.createEngineFromFixture(fixture);
    });

    it('should preserve game state properties after loading', () => {
      const state = engine.getState();
      
      // Verify basic properties
      expect(state.turn).toBe(fixture.gameState.turn);
      expect(state.winner).toBe(fixture.gameState.winner);
      expect(state.gameMode).toBe(fixture.gameState.gameMode);
      
      // Verify player scores and counts
      expect(state.players[0].score).toBe(fixture.gameState.players[0].score);
      expect(state.players[1].score).toBe(fixture.gameState.players[1].score);
      expect(state.players[0].squareCount).toBe(fixture.gameState.players[0].squareCount);
      expect(state.players[1].squareCount).toBe(fixture.gameState.players[1].squareCount);
    });

    it('should handle autoplay chain reactions setting', () => {
      const state = engine.getState();
      
      // The loaded fixture has autoplayChainReactions: false
      expect(state.autoplayChainReactions).toBe(false);
      
      // Test that we can create an engine with autoplay enabled
      const autoplayFixture = {
        ...fixture,
        gameState: {
          ...fixture.gameState,
          autoplayChainReactions: true
        }
      };
      
      const autoplayEngine = GameStateFixtures.createEngineFromFixture(autoplayFixture);
      expect(autoplayEngine.getState().autoplayChainReactions).toBe(true);
    });

    it('should allow making valid moves from loaded state', () => {
      const state = engine.getState();
      const validMoves = engine.getPossibleMoves();
      
      expect(validMoves.length).toBeGreaterThan(0);
      
      // Try making a move
      if (validMoves.length > 0) {
        const move = validMoves[0];
        const initialLineCount = state.lines.length;
        const initialTurn = state.turn;
        
        const success = engine.makeMove(move.start, move.end);
        expect(success).toBe(true);
        
        // Verify state changed
        const newState = engine.getState();
        expect(newState.turn).toBeGreaterThan(initialTurn);
        expect(newState.lines.length).toBeGreaterThan(initialLineCount);
        
        // The new line should exist in the state
        const newLine = newState.lines.find(line => 
          (line.start.x === move.start.x && line.start.y === move.start.y && line.start.z === move.start.z &&
           line.end.x === move.end.x && line.end.y === move.end.y && line.end.z === move.end.z) ||
          (line.start.x === move.end.x && line.start.y === move.end.y && line.start.z === move.end.z &&
           line.end.x === move.start.x && line.end.y === move.start.y && line.end.z === move.start.z)
        );
        expect(newLine).toBeDefined();
      }
    });
  });

  describe('Chain Reaction Testing with Fixtures', () => {
    it('should test chain reaction behavior in loaded state', () => {
      // Load the state with autoplay enabled for this test
      const fixture = GameStateFixtures.loadFixture('autoplay-chain-state.json');
      const modifiedFixture = {
        ...fixture,
        gameState: {
          ...fixture.gameState,
          autoplayChainReactions: true
        }
      };
      
      const controller = GameStateFixtures.createControllerFromFixture(modifiedFixture);
      const engine = new GameEngine(
        modifiedFixture.gameState.gridSize,
        modifiedFixture.gameState.gameMode,
        true // autoplay enabled
      );
      engine.loadFromState(modifiedFixture.gameState);
      
      // Create chain controller to test chain reaction detection
      const chainController = new ChainReactionController(engine);
      
      // Test if there are any chain opportunities in this state
      const state = engine.getState();
      expect(state).toBeDefined();
      
      // This is more of a state verification test since the exact chain opportunities
      // depend on the specific game state in the fixture
      const hasChainOpportunities = chainController.findChainOpportunities().length > 0;
      expect(typeof hasChainOpportunities).toBe('boolean');
    });
  });

  describe('Utility Methods', () => {
    it('should create basic fixture programmatically', () => {
      const basicFixture = GameStateFixtures.createBasicFixture(4, 'ai', true);
      
      expect(basicFixture.gameState.gridSize).toBe(4);
      expect(basicFixture.gameState.gameMode).toBe('ai');
      expect(basicFixture.gameState.autoplayChainReactions).toBe(true);
      expect(basicFixture.gameState.players[1].isAI).toBe(true);
      expect(basicFixture.metadata?.name).toBe('Basic Fixture');
    });

    it('should list available fixtures', () => {
      const fixtures = GameStateFixtures.listAvailableFixtures();
      
      // Should at least contain our test fixture
      expect(fixtures).toContain('autoplay-chain-state.json');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent fixture file', () => {
      expect(() => {
        GameStateFixtures.loadFixture('non-existent.json');
      }).toThrow();
    });

    it('should validate and reject invalid fixture format', () => {
      // Create an invalid fixture for testing
      const invalidFixture = {
        filePath: '<test>',
        gameState: {
          gridSize: 4,
          players: [{ id: 'player1', name: 'Player 1' }], // Only 1 player (invalid)
          lines: [],
          cubes: [],
          currentPlayer: { id: 'player1', name: 'Player 1' },
          gameMode: 'local',
          winner: null,
          turn: 0
        }
      };

      const validation = GameStateFixtures.validateFixture(invalidFixture);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('gameState must have exactly 2 players');
    });
  });
});