import { BaseGameCommand, CommandType } from './Command';
import { GameState, Player } from '../types';
import { ValidationResult } from '../StateValidator';

/**
 * Command for syncing state with server.
 * This is used in multiplayer games to update local state with server state.
 */
export class SyncStateCommand extends BaseGameCommand {
  constructor(
    private readonly serverState: Partial<GameState>
  ) {
    super(CommandType.SYNC_STATE, false); // Cannot be undone
  }
  
  validate(_state: GameState): ValidationResult {
    // Sync is always allowed, but we'll validate the resulting state
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }
  
  execute(state: GameState): GameState {
    // Start with a deep copy of current state
    const newState: GameState = JSON.parse(JSON.stringify(state));
    
    // Sync lines
    if (this.serverState.lines !== undefined) {
      if (Array.isArray(this.serverState.lines)) {
        // Map server lines to local player references
        newState.lines = this.serverState.lines.map(line => {
          const player = this.findPlayerInState(newState, line.player);
          return {
            ...line,
            player: player || line.player
          };
        });
      } else {
        newState.lines = [...this.serverState.lines];
      }
    }
    
    // Sync cubes (deep copy to avoid reference issues)
    if (this.serverState.cubes !== undefined) {
      newState.cubes = this.serverState.cubes.map(cube => ({
        ...cube,
        faces: cube.faces.map(face => ({ ...face }))
      }));
    }
    
    // Sync players - maintain engine IDs but update properties
    if (this.serverState.players !== undefined && 
        this.serverState.players.length === state.players.length) {
      newState.players = state.players.map((enginePlayer, index) => {
        const serverPlayer = this.serverState.players![index];
        return {
          ...enginePlayer,
          // Copy all properties except ID (maintain engine ID)
          name: serverPlayer.name,
          color: serverPlayer.color,
          score: serverPlayer.score,
          squareCount: serverPlayer.squareCount,
          isAI: serverPlayer.isAI
        };
      });
    }
    
    // Sync current player - find by position in players array
    if (this.serverState.currentPlayer !== undefined && this.serverState.players) {
      const currentPlayerIndex = this.serverState.players.findIndex(
        p => p.id === this.serverState.currentPlayer!.id
      );
      if (currentPlayerIndex !== -1 && currentPlayerIndex < newState.players.length) {
        newState.currentPlayer = newState.players[currentPlayerIndex];
      }
    }
    
    // Sync turn
    if (this.serverState.turn !== undefined) {
      newState.turn = this.serverState.turn;
    }
    
    // Sync winner
    if (this.serverState.winner !== undefined) {
      if (this.serverState.winner && this.serverState.players) {
        const winnerIndex = this.serverState.players.findIndex(
          p => p.id === this.serverState.winner!.id
        );
        if (winnerIndex !== -1 && winnerIndex < newState.players.length) {
          newState.winner = newState.players[winnerIndex];
        }
      } else {
        newState.winner = null;
      }
    }
    
    // Sync lastMove
    if (this.serverState.lastMove !== undefined) {
      if (this.serverState.lastMove && 
          this.serverState.lastMove.player && 
          this.serverState.players) {
        const lastMovePlayerIndex = this.serverState.players.findIndex(
          p => p.id === this.serverState.lastMove!.player!.id
        );
        if (lastMovePlayerIndex !== -1 && lastMovePlayerIndex < newState.players.length) {
          newState.lastMove = {
            ...this.serverState.lastMove,
            player: newState.players[lastMovePlayerIndex]
          };
        }
      } else {
        newState.lastMove = undefined;
      }
    }
    
    return newState;
  }
  
  protected getPayload(): any {
    return {
      serverState: this.serverState
    };
  }
  
  private findPlayerInState(state: GameState, player: Player | any): Player | null {
    if (!player) return null;
    
    // Try to find by ID first
    if (player.id) {
      const found = state.players.find(p => p.id === player.id);
      if (found) return found;
    }
    
    // Try to find by name
    if (player.name) {
      const found = state.players.find(p => p.name === player.name);
      if (found) return found;
    }
    
    return null;
  }
}