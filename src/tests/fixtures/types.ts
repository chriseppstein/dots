import { GameState } from '../../core/types';

export interface FixtureMetadata {
  name: string;
  description?: string;
  scenario?: string;
  expectedBehavior?: string;
  tags?: string[];
}

export interface GameStateFixtureFile {
  timestamp?: string;
  metadata?: FixtureMetadata;
  gameState: GameState;
}

export interface LoadedFixture {
  filePath: string;
  metadata?: FixtureMetadata;
  gameState: GameState;
  timestamp?: string;
}

export interface FixtureValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}