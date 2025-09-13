import { BaseGameCommand, CommandType } from './Command';
import { GameState, GridSize, GameMode, Cube } from '../types';
import { ValidationResult } from '../StateValidator';

/**
 * Command for resetting the game to initial state
 */
export class ResetGameCommand extends BaseGameCommand {
  constructor(
    private readonly gridSize: GridSize,
    private readonly gameMode: GameMode,
    private readonly players?: Array<{ id: string; name: string; color: string; isAI?: boolean }>
  ) {
    super(CommandType.RESET_GAME, false); // Cannot be undone
  }
  
  validate(_state: GameState): ValidationResult {
    // Reset is always valid
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }
  
  execute(state: GameState): GameState {
    // Use provided players or keep existing ones
    const gamePlayers = this.players || state.players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isAI: p.isAI
    }));
    
    // Create initial cubes
    const cubes = this.createInitialCubes(this.gridSize);
    
    // Create fresh game state
    const newState: GameState = {
      gridSize: this.gridSize,
      currentPlayer: {
        id: gamePlayers[0].id,
        name: gamePlayers[0].name,
        color: gamePlayers[0].color,
        score: 0,
        squareCount: 0,
        isAI: gamePlayers[0].isAI
      },
      players: gamePlayers.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        score: 0,
        squareCount: 0,
        isAI: p.isAI
      })),
      lines: [],
      cubes: cubes,
      gameMode: this.gameMode,
      winner: null,
      turn: 0,
      lastMove: undefined
    };
    
    return newState;
  }
  
  protected getPayload(): any {
    return {
      gridSize: this.gridSize,
      gameMode: this.gameMode,
      players: this.players
    };
  }
  
  private createInitialCubes(gridSize: GridSize): Cube[] {
    const cubes: Cube[] = [];
    const size = gridSize - 1;
    
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          cubes.push({
            position: { x, y, z },
            faces: Array(6).fill(null).map(() => ({
              corners: [],
              lines: [],
              player: null
            })),
            owner: null,
            claimedFaces: 0
          });
        }
      }
    }
    
    return cubes;
  }
}