import { BaseGameCommand, CommandType } from './Command';
import { GameState, Point3D, Line } from '../types';
import { ValidationResult } from '../StateValidator';

/**
 * Simplified MakeMoveCommand that delegates to existing game logic.
 * This ensures backward compatibility while introducing the command pattern.
 */
export class SimpleMakeMoveCommand extends BaseGameCommand {
  constructor(
    private readonly start: Point3D,
    private readonly end: Point3D
  ) {
    super(CommandType.MAKE_MOVE, false); // Undo not implemented yet
  }
  
  validate(state: GameState): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    // Check if game is over
    if (state.winner) {
      errors.push({
        code: 'GAME_OVER',
        message: 'Cannot make moves after game has ended'
      });
    }
    
    // Check if it's a valid line
    const dx = Math.abs(this.end.x - this.start.x);
    const dy = Math.abs(this.end.y - this.start.y);
    const dz = Math.abs(this.end.z - this.start.z);
    const distance = dx + dy + dz;
    
    if (distance !== 1) {
      errors.push({
        code: 'INVALID_MOVE',
        message: 'Move must be between adjacent dots'
      });
    }
    
    // Check bounds
    const maxCoord = state.gridSize - 1;
    if (this.start.x < 0 || this.start.x > maxCoord ||
        this.start.y < 0 || this.start.y > maxCoord ||
        this.start.z < 0 || this.start.z > maxCoord ||
        this.end.x < 0 || this.end.x > maxCoord ||
        this.end.y < 0 || this.end.y > maxCoord ||
        this.end.z < 0 || this.end.z > maxCoord) {
      errors.push({
        code: 'OUT_OF_BOUNDS',
        message: 'Move is out of grid bounds'
      });
    }
    
    // Check if line already exists
    const line: Line = { start: this.start, end: this.end, player: state.currentPlayer };
    const lineExists = state.lines.some(existingLine =>
      (this.isSamePoint(existingLine.start, this.start) && this.isSamePoint(existingLine.end, this.end)) ||
      (this.isSamePoint(existingLine.start, this.end) && this.isSamePoint(existingLine.end, this.start))
    );
    
    if (lineExists) {
      errors.push({
        code: 'LINE_EXISTS',
        message: 'Line has already been drawn'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  execute(state: GameState): GameState {
    // This will be replaced by the GameEngine's actual makeMove logic
    // For now, just return the state as-is
    // The GameEngine will handle the actual move execution
    return state;
  }
  
  protected getPayload(): any {
    return {
      start: this.start,
      end: this.end
    };
  }
  
  private isSamePoint(p1: Point3D, p2: Point3D): boolean {
    return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z;
  }
}