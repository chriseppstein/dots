import { GameEngine } from './GameEngine';
import { GameRenderer } from './GameRenderer';
import { NetworkManager } from '../network/NetworkManager';
import { AIPlayer } from '../ai/AIPlayer';
import { GridSize, GameMode, Point3D, GameState } from './types';

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
  private serverPlayerIdMap: Map<string, string> = new Map(); // Maps engine IDs to server socket IDs

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
    
    // Use Object.assign to properly copy player properties and track ID mappings
    if (serverState.players) {
      for (let i = 0; i < serverState.players.length; i++) {
        const enginePlayerId = engineState.players[i].id; // 'player1' or 'player2'
        const serverPlayerId = serverState.players[i].id; // socket ID
        
        // Store the mapping
        this.serverPlayerIdMap.set(enginePlayerId, serverPlayerId);
        
        // Copy all properties EXCEPT id to preserve engine's internal ID
        const { id: _, ...serverPlayerData } = serverState.players[i];
        Object.assign(engineState.players[i], serverPlayerData);
      }
    }
    
    // Update currentPlayer reference to point to the correct player object
    if (serverState.currentPlayer) {
      // Find the engine player that matches the server's current player
      const mapEntries = Array.from(this.serverPlayerIdMap.entries());
      const currentPlayerIndex = mapEntries
        .findIndex(([engineId, serverId]) => serverId === serverState.currentPlayer.id);
      
      if (currentPlayerIndex !== -1) {
        engineState.currentPlayer = engineState.players[currentPlayerIndex];
      }
    }
    
    engineState.turn = serverState.turn || 0;
    
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
      const state = this.engine.getState();
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
    if (this.gameMode === 'online' && this.serverPlayerIdMap.size > 0) {
      // Create a deep copy to avoid modifying the engine's state
      const mappedState = JSON.parse(JSON.stringify(state));
      
      // Map player IDs
      for (let i = 0; i < mappedState.players.length; i++) {
        const engineId = state.players[i].id;
        const serverId = this.serverPlayerIdMap.get(engineId);
        if (serverId) {
          mappedState.players[i].id = serverId;
        }
      }
      
      // Map current player ID
      if (mappedState.currentPlayer) {
        const engineId = state.currentPlayer.id;
        const serverId = this.serverPlayerIdMap.get(engineId);
        if (serverId) {
          mappedState.currentPlayer.id = serverId;
        }
      }
      
      // Map winner ID if exists
      if (mappedState.winner) {
        const engineId = state.winner.id;
        const serverId = this.serverPlayerIdMap.get(engineId);
        if (serverId) {
          mappedState.winner.id = serverId;
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
   * Clean up resources
   */
  public dispose(): void {
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}