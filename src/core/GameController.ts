import { GameEngine } from './GameEngine';
import { GameRenderer } from './GameRenderer';
import { NetworkManager } from '../network/NetworkManager';
import { AIPlayer } from '../ai/AIPlayer';
import { GridSize, GameMode, Point3D, GameState } from './types';
import { PlayerIdentityService } from './PlayerIdentityService';

/**
 * GameController manages game logic and state without requiring rendering.
 * This allows for testing and server-side game management without WebGL dependencies.
 */
export class GameController {
  private engine: GameEngine;
  private renderer?: GameRenderer;
  private networkManager?: NetworkManager;
  private aiPlayer?: AIPlayer;
  private player1Name: string = 'Player 1';
  private player2Name: string = 'Player 2';
  private gameMode: GameMode;
  private playerIdentityService: PlayerIdentityService;

  constructor(
    gridSize: GridSize,
    gameMode: GameMode,
    player1Name: string,
    player2Name: string,
    networkManager?: NetworkManager
  ) {
    this.engine = new GameEngine(gridSize, gameMode);
    this.gameMode = gameMode;
    this.player1Name = player1Name;
    this.player2Name = player2Name;
    this.networkManager = networkManager;
    this.playerIdentityService = new PlayerIdentityService();

    if (gameMode === 'ai') {
      this.aiPlayer = new AIPlayer(this.engine);
    }
  }

  /**
   * Attach a renderer to this controller for visual output.
   * This is optional and only needed when running in a browser environment.
   */
  public attachRenderer(renderer: GameRenderer): void {
    this.renderer = renderer;
    this.updateRenderer();
  }

  /**
   * Initialize the game with the given state (used for online games)
   */
  public initializeWithState(gameState: GameState): void {
    this.syncEngineWithServerState(gameState);
    this.updateRenderer();
  }

  /**
   * Initialize the game with default state (used for local/AI games)
   */
  public initializeDefault(): void {
    const state = this.engine.getState();
    state.players[0].name = this.player1Name;
    state.players[1].name = this.player2Name;
    this.updateRenderer();
  }

  /**
   * Handle a move attempt from a player
   */
  public handleMove(start: Point3D, end: Point3D): boolean {
    // Use getState() to get the properly synced state with correct IDs
    const state = this.getState();
    
    if (state.winner) {
      console.log('GameController: Game is already over');
      return false;
    }

    // For online games, validate turn and send to server
    if (this.gameMode === 'online' && this.networkManager) {
      const playerId = this.networkManager.getPlayerId();
      
      if (playerId !== state.currentPlayer.id) {
        return false;
      }
      
      // Send move to server, which will validate and broadcast back
      this.networkManager.makeMove(start, end);
      return true; // Move sent, but not applied locally yet
    }

    // For local/AI games, apply move locally
    if (this.gameMode === 'ai' && state.currentPlayer.isAI) {
      return false;
    }

    const success = this.engine.makeMove(start, end);
    
    if (success) {
      this.updateGame();
      
      if (this.gameMode === 'ai' && !state.winner) {
        setTimeout(() => this.makeAIMove(), 500);
      }
    }
    
    return success;
  }

  /**
   * Handle AI player's move
   */
  private makeAIMove(): void {
    if (!this.aiPlayer) return;
    
    const state = this.engine.getState();
    if (!state.currentPlayer.isAI || state.winner) return;
    
    const move = this.aiPlayer.getNextMove();
    if (move) {
      this.engine.makeMove(move.start, move.end);
      this.updateGame();
    }
  }

  /**
   * Sync local engine state with server state
   */
  public syncEngineWithServerState(serverState: any): void {
    // Use getMutableState to directly modify the engine's internal state
    const engineState = (this.engine as any).getMutableState();
    
    // Copy all properties from server state
    engineState.lines = serverState.lines || [];
    engineState.cubes = serverState.cubes || [];
    
    // Register player ID mappings and copy player properties
    if (serverState.players) {
      for (let i = 0; i < serverState.players.length; i++) {
        const enginePlayerId = this.playerIdentityService.getEngineIdByPosition(i);
        const serverPlayerId = serverState.players[i].id; // socket ID
        const playerName = serverState.players[i].name;
        
        // Register the mapping in the identity service
        this.playerIdentityService.registerPlayer(enginePlayerId, serverPlayerId, playerName);
        
        // Copy all properties EXCEPT id to preserve engine's internal ID
        const { id: _, ...serverPlayerData } = serverState.players[i];
        Object.assign(engineState.players[i], serverPlayerData);
      }
    }
    
    // Update currentPlayer reference to point to the correct player object
    if (serverState.currentPlayer) {
      // Find the engine player that matches the server's current player
      const engineId = this.playerIdentityService.getEngineId(serverState.currentPlayer.id);
      
      if (engineId) {
        const currentPlayerIndex = this.playerIdentityService.getPositionByEngineId(engineId);
        engineState.currentPlayer = engineState.players[currentPlayerIndex];
      }
    }
    
    engineState.turn = serverState.turn || 0;
    
    // Handle lastMove with proper player reference
    if (serverState.lastMove) {
      console.log('Syncing lastMove from server:', serverState.lastMove);
      engineState.lastMove = {
        ...serverState.lastMove,
        player: null // Will be set to proper player reference below
      };
      
      // Find the correct player reference for lastMove
      if (serverState.lastMove.player) {
        const lastMovePlayerIndex = serverState.players.findIndex(
          p => p.id === serverState.lastMove.player.id
        );
        if (lastMovePlayerIndex !== -1) {
          engineState.lastMove.player = engineState.players[lastMovePlayerIndex];
        }
      }
      console.log('Engine lastMove after sync:', engineState.lastMove);
    } else {
      console.log('No lastMove in server state, setting to null');
      engineState.lastMove = null;
    }
    
    // Handle winner reference
    if (serverState.winner) {
      const winnerIndex = engineState.players.findIndex(
        p => p.id === serverState.winner.id
      );
      engineState.winner = winnerIndex !== -1 ? engineState.players[winnerIndex] : null;
    } else {
      engineState.winner = null;
    }
    
    engineState.gridSize = serverState.gridSize || engineState.gridSize;
    engineState.gameMode = serverState.gameMode || engineState.gameMode;
  }

  /**
   * Update the game after a move
   */
  private updateGame(): void {
    const state = this.engine.getState();
    this.updateRenderer();
    
    // Game complete - winner determined
  }

  /**
   * Update the renderer with current game state
   */
  private updateRenderer(): void {
    if (this.renderer) {
      // Use getState() instead of engine.getState() to ensure proper ID mapping
      const state = this.getState();
      this.renderer.updateFromGameState(state);
    }
  }

  /**
   * Handle game state update from server
   */
  public handleServerStateUpdate(gameState: any): void {
    this.syncEngineWithServerState(gameState);
    this.updateRenderer();
  }

  /**
   * Get the current game state with proper ID mapping for online games
   */
  public getState(): GameState {
    const state = this.engine.getState();
    
    // If we're in online mode and have ID mappings, return state with server IDs
    if (this.gameMode === 'online' && this.playerIdentityService.hasMappings()) {
      // Create a deep copy to avoid modifying the engine's state
      const mappedState = JSON.parse(JSON.stringify(state));
      
      // Map player IDs
      for (let i = 0; i < mappedState.players.length; i++) {
        const engineId = state.players[i].id;
        const networkId = this.playerIdentityService.getNetworkId(engineId);
        if (networkId) {
          mappedState.players[i].id = networkId;
        }
      }
      
      // Map current player ID
      if (mappedState.currentPlayer) {
        const engineId = state.currentPlayer.id;
        const networkId = this.playerIdentityService.getNetworkId(engineId);
        if (networkId) {
          mappedState.currentPlayer.id = networkId;
        }
      }
      
      // Map winner ID if exists
      if (mappedState.winner) {
        const engineId = state.winner.id;
        const networkId = this.playerIdentityService.getNetworkId(engineId);
        if (networkId) {
          mappedState.winner.id = networkId;
        }
      }
      
      // Map lastMove player ID if exists
      if (mappedState.lastMove && mappedState.lastMove.player) {
        const engineId = state.lastMove.player.id;
        const networkId = this.playerIdentityService.getNetworkId(engineId);
        if (networkId) {
          mappedState.lastMove.player.id = networkId;
        }
      }
      
      return mappedState;
    }
    
    return state;
  }

  /**
   * Get the network manager
   */
  public getNetworkManager(): NetworkManager | undefined {
    return this.networkManager;
  }

  /**
   * Get the player identity service for ID mapping
   */
  public getPlayerIdentityService(): PlayerIdentityService {
    return this.playerIdentityService;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.playerIdentityService.clear();
  }
}