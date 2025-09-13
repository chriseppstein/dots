import { GameState } from '../types';
import { ValidationResult } from '../StateValidator';

/**
 * Base interface for all game commands.
 * Commands encapsulate state mutations and can be validated, executed, and potentially undone.
 */
export interface IGameCommand {
  /**
   * Unique identifier for the command type
   */
  readonly type: string;
  
  /**
   * Timestamp when the command was created
   */
  readonly timestamp: number;
  
  /**
   * Validates whether this command can be executed in the current state
   */
  validate(state: GameState): ValidationResult;
  
  /**
   * Executes the command and returns the new state.
   * Should be a pure function - no side effects.
   */
  execute(state: GameState): GameState;
  
  /**
   * Whether this command can be undone
   */
  readonly canUndo: boolean;
  
  /**
   * Undo the command if possible (optional)
   */
  undo?(state: GameState): GameState;
  
  /**
   * Serializes the command for network transmission or storage
   */
  serialize(): CommandData;
}

/**
 * Serializable command data for network/storage
 */
export interface CommandData {
  type: string;
  timestamp: number;
  payload: any;
}

/**
 * Result of command execution
 */
export interface CommandResult {
  success: boolean;
  state?: GameState;
  error?: string;
  validation?: ValidationResult;
}

/**
 * Abstract base class for game commands
 */
export abstract class BaseGameCommand implements IGameCommand {
  public readonly timestamp: number;
  
  constructor(public readonly type: string, public readonly canUndo: boolean = false) {
    this.timestamp = Date.now();
  }
  
  abstract validate(state: GameState): ValidationResult;
  abstract execute(state: GameState): GameState;
  
  serialize(): CommandData {
    return {
      type: this.type,
      timestamp: this.timestamp,
      payload: this.getPayload()
    };
  }
  
  /**
   * Get the payload for serialization (to be implemented by subclasses)
   */
  protected abstract getPayload(): any;
}

/**
 * Command types enum for type safety
 */
export enum CommandType {
  MAKE_MOVE = 'MAKE_MOVE',
  RESET_GAME = 'RESET_GAME',
  SYNC_STATE = 'SYNC_STATE',
  SET_WINNER = 'SET_WINNER',
  UPDATE_SCORES = 'UPDATE_SCORES'
}