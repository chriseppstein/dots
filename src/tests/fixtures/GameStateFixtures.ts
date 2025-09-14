import { readFileSync } from 'fs';
import { join } from 'path';
import { GameState, GameMode, GridSize } from '../../core/types';
import { GameEngine } from '../../core/GameEngine';
import { GameController } from '../../core/GameController';
import { GameStateFixtureFile, LoadedFixture, FixtureValidationResult } from './types';

export class GameStateFixtures {
  static loadFixture(fileName: string, fixturesDir?: string): LoadedFixture {
    const baseDir = fixturesDir || join(process.cwd(), 'src/tests/fixtures/data');
    const filePath = join(baseDir, fileName);
    
    try {
      const fileContent = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(fileContent) as GameStateFixtureFile;
      
      const fixture: LoadedFixture = {
        filePath,
        gameState: parsed.gameState,
        metadata: parsed.metadata,
        timestamp: parsed.timestamp
      };

      const validation = this.validateFixture(fixture);
      if (!validation.valid) {
        throw new Error(`Invalid fixture file: ${validation.errors.join(', ')}`);
      }

      return fixture;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load fixture from ${fileName}: ${error.message}`);
      }
      throw new Error(`Failed to load fixture from ${fileName}: Unknown error`);
    }
  }

  static validateFixture(fixture: LoadedFixture): FixtureValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { gameState } = fixture;

    if (!gameState) {
      errors.push('Missing gameState property');
      return { valid: false, errors, warnings };
    }

    if (!gameState.players || !Array.isArray(gameState.players) || gameState.players.length !== 2) {
      errors.push('gameState must have exactly 2 players');
    }

    if (!gameState.currentPlayer) {
      errors.push('gameState must have a currentPlayer');
    }

    if (!gameState.lines || !Array.isArray(gameState.lines)) {
      errors.push('gameState must have a lines array');
    }

    if (!gameState.cubes || !Array.isArray(gameState.cubes)) {
      errors.push('gameState must have a cubes array');
    }

    if (typeof gameState.gridSize !== 'number' || ![3, 4, 5, 6].includes(gameState.gridSize)) {
      errors.push('gridSize must be 3, 4, 5, or 6');
    }

    if (!['local', 'online', 'ai'].includes(gameState.gameMode)) {
      errors.push('gameMode must be local, online, or ai');
    }

    if (typeof gameState.turn !== 'number' || gameState.turn < 0) {
      errors.push('turn must be a non-negative number');
    }

    if (gameState.players?.length === 2) {
      const player1 = gameState.players[0];
      const player2 = gameState.players[1];

      if (!player1.id || !player2.id) {
        errors.push('All players must have an id');
      }

      if (player1.id === player2.id) {
        errors.push('Players must have unique ids');
      }

      if (gameState.currentPlayer && 
          gameState.currentPlayer.id !== player1.id && 
          gameState.currentPlayer.id !== player2.id) {
        errors.push('currentPlayer must match one of the players');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  static createEngineFromFixture(fixture: LoadedFixture): GameEngine {
    const { gameState } = fixture;
    const engine = new GameEngine(
      gameState.gridSize as GridSize,
      gameState.gameMode as GameMode,
      gameState.autoplayChainReactions
    );
    
    engine.loadFromState(gameState);
    return engine;
  }

  static createControllerFromFixture(fixture: LoadedFixture): GameController {
    const { gameState } = fixture;
    
    const controller = new GameController(
      gameState.gridSize as GridSize,
      gameState.gameMode as GameMode,
      gameState.players[0].name,
      gameState.players[1].name,
      undefined, // networkManager - not needed for fixtures
      gameState.autoplayChainReactions
    );

    controller.initializeWithState(gameState);
    return controller;
  }

  static applyFixtureToEngine(engine: GameEngine, fixture: LoadedFixture): void {
    engine.loadFromState(fixture.gameState);
  }

  static listAvailableFixtures(fixturesDir?: string): string[] {
    try {
      const fs = require('fs');
      const baseDir = fixturesDir || join(process.cwd(), 'src/tests/fixtures/data');
      const files = fs.readdirSync(baseDir);
      return files.filter((file: string) => file.endsWith('.json'));
    } catch (error) {
      return [];
    }
  }

  static createBasicFixture(
    gridSize: GridSize = 3,
    gameMode: GameMode = 'local',
    autoplayChainReactions: boolean = false
  ): LoadedFixture {
    const engine = new GameEngine(gridSize, gameMode, autoplayChainReactions);
    const gameState = engine.getState();

    return {
      filePath: '<generated>',
      gameState,
      metadata: {
        name: 'Basic Fixture',
        description: `Generated ${gridSize}x${gridSize} ${gameMode} game`,
        scenario: 'initial_state'
      }
    };
  }
}