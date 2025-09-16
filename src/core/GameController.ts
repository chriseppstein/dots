import { GameEngine } from './GameEngine';
import { GameRenderer } from './GameRenderer';
import { NetworkManager } from '../network/NetworkManager';
import { AIPlayer } from '../ai/AIPlayer';
import { GridSize, GameMode, Point3D, GameState } from './types';
import { PlayerIdentityService } from './PlayerIdentityService';
import { GameStateManager, StateChangeListener } from './GameStateManager';
import { ResourceManager } from './ResourceManager';
import { ChainReactionController } from './ChainReactionController';

/**
 * GameController manages game logic and state without requiring rendering.
 * This allows for testing and server-side game management without WebGL dependencies.
 */
export class GameController implements StateChangeListener {
  private engine: GameEngine;
  private stateManager: GameStateManager;
  private renderer?: GameRenderer;
  private networkManager?: NetworkManager;
  private aiPlayer?: AIPlayer;
  private chainController?: ChainReactionController;
  private player1Name: string = 'Player 1';
  private player2Name: string = 'Player 2';
  private gameMode: GameMode;
  private playerIdentityService: PlayerIdentityService;
  private resourceManager = new ResourceManager();
  private aiMoveTimer?: number;

  constructor(
    gridSize: GridSize,
    gameMode: GameMode,
    player1Name: string,
    player2Name: string,
    networkManager?: NetworkManager,
    autoplayChainReactions?: boolean
  ) {
    console.log('🎯 GameController: Creating with autoplayChainReactions =', autoplayChainReactions);
    this.engine = new GameEngine(gridSize, gameMode, autoplayChainReactions);
    this.stateManager = new GameStateManager(this.engine);
    this.gameMode = gameMode;
    this.player1Name = player1Name;
    this.player2Name = player2Name;
    this.networkManager = networkManager;
    this.playerIdentityService = new PlayerIdentityService();

    if (gameMode === 'ai') {
      this.aiPlayer = new AIPlayer(this.engine);
    }

    // Create chain reaction controller if autoplay is enabled
    if (autoplayChainReactions) {
      console.log('⚡ GameController: Creating ChainReactionController');
      this.chainController = new ChainReactionController(this.engine);
    } else {
      console.log('❌ GameController: NOT creating ChainReactionController (autoplay disabled)');
    }

    // Register self as state change listener
    this.stateManager.addListener(this);
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
    // Update player names directly in engine state
    const state = this.engine.getState();
    state.players[0].name = this.player1Name;
    state.players[1].name = this.player2Name;
    
    // Force state change notification through state manager
    this.stateManager.forceNotify();
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

    // Use stateManager for centralized move handling
    const success = this.stateManager.makeMove(start, end);
    
    // AI moves are now handled by the onStateChange listener
    
    return success;
  }

  /**
   * Handle AI player's move
   */
  private makeAIMove(): void {
    if (!this.aiPlayer) return;
    
    const state = this.stateManager.getState();
    if (!state.currentPlayer.isAI || state.winner) return;
    
    const move = this.aiPlayer.getNextMove();
    if (move) {
      this.stateManager.makeMove(move.start, move.end);
    }
  }

  /**
   * Sync local engine state with server state
   */
  public syncEngineWithServerState(serverState: any): void {
    // Register player ID mappings first
    if (serverState.players) {
      for (let i = 0; i < serverState.players.length; i++) {
        const enginePlayerId = this.playerIdentityService.getEngineIdByPosition(i);
        const serverPlayerId = serverState.players[i].id; // socket ID
        const playerName = serverState.players[i].name;
        
        // Register the mapping in the identity service
        this.playerIdentityService.registerPlayer(enginePlayerId, serverPlayerId, playerName);
      }
    }
    
    // Use stateManager for centralized sync handling
    this.stateManager.syncWithServerState(serverState);
  }


  /**
   * Update the renderer with current game state
   */
  private updateRenderer(): void {
    if (this.renderer) {
      // Use getState() instead of engine.getState() to ensure proper ID mapping
      const state = this.getState();
      
      // Determine current player ID for visual feedback
      let playerId: string | undefined;
      if (this.gameMode === 'online' && this.networkManager) {
        playerId = this.networkManager.getPlayerId() || undefined;
      } else if (this.gameMode === 'local') {
        // For local games, use the first player as the "local" player
        playerId = state.players[0]?.id;
      } else if (this.gameMode === 'ai') {
        // For AI games, the human player is the first player
        playerId = state.players.find(p => !p.isAI)?.id;
      }
      
      this.renderer.updateFromGameState(state, playerId);
    }
  }

  /**
   * Handle game state update from server
   */
  public handleServerStateUpdate(gameState: any): void {
    this.syncEngineWithServerState(gameState);
    // updateRenderer is already called in syncEngineWithServerState
  }

  /**
   * Get the current game state with proper ID mapping for online games
   */
  public getState(): GameState {
    const state = this.stateManager.getState();
    
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
      if (mappedState.winner && state.winner) {
        const engineId = state.winner.id;
        const networkId = this.playerIdentityService.getNetworkId(engineId);
        if (networkId) {
          mappedState.winner.id = networkId;
        }
      }
      
      // Map lastMove player ID if exists
      if (mappedState.lastMove && mappedState.lastMove.player && state.lastMove?.player) {
        const engineId = state.lastMove.player.id;
        const networkId = this.playerIdentityService.getNetworkId(engineId);
        if (networkId) {
          mappedState.lastMove.player.id = networkId;
        }
      }
      
      // Map line player IDs
      if (mappedState.lines && state.lines) {
        for (let i = 0; i < mappedState.lines.length; i++) {
          if (mappedState.lines[i].player && state.lines[i].player) {
            const engineId = state.lines[i].player.id;
            const networkId = this.playerIdentityService.getNetworkId(engineId);
            if (networkId) {
              mappedState.lines[i].player.id = networkId;
            }
          }
        }
      }
      
      // Map cube owner and face player IDs
      if (mappedState.cubes && state.cubes) {
        for (let i = 0; i < mappedState.cubes.length; i++) {
          // Map cube owner ID
          if (mappedState.cubes[i].owner && state.cubes[i].owner) {
            const engineId = state.cubes[i].owner.id;
            const networkId = this.playerIdentityService.getNetworkId(engineId);
            if (networkId) {
              mappedState.cubes[i].owner.id = networkId;
            }
          }
          
          // Map face player IDs
          if (mappedState.cubes[i].faces && state.cubes[i].faces) {
            for (let j = 0; j < mappedState.cubes[i].faces.length; j++) {
              if (mappedState.cubes[i].faces[j].player && state.cubes[i].faces[j].player) {
                const engineId = state.cubes[i].faces[j].player.id;
                const networkId = this.playerIdentityService.getNetworkId(engineId);
                if (networkId) {
                  mappedState.cubes[i].faces[j].player.id = networkId;
                }
              }
            }
          }
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
   * Get the state manager for registering listeners
   */
  public getStateManager(): GameStateManager {
    return this.stateManager;
  }

  /**
   * Get the chain reaction controller for registering chain event listeners
   */
  public getChainController(): ChainReactionController | undefined {
    return this.chainController;
  }

  // StateChangeListener implementation
  
  /**
   * Called when the game state changes
   */
  public onStateChange(_changeType: string, _newState: GameState): void {
    // Update renderer whenever state changes
    this.updateRenderer();
  }

  /**
   * Called when a move is made
   */
  public onMove(start: Point3D, end: Point3D, newState: GameState): void {
    // Handle chain reactions if enabled and the specific move completed a square
    if (this.chainController && newState.autoplayChainReactions && !newState.winner) {
      // FIXED: Check if the specific move that was just made completed a square
      const moveCompletedSquare = this.chainController.hasChainOpportunity(start, end);
      
      if (moveCompletedSquare) {
        // Only trigger autoplay if the move that was just made completed a square
        const chainOpportunities = this.chainController.findChainOpportunities();
        if (chainOpportunities.length > 0) {
          console.log('🔗 GameController: Square completed by move, executing autoplay');
          // Execute the chain reaction after a short delay to allow UI to update
          this.resourceManager.setTimeout(async () => {
            await this.chainController!.executeChainReaction();
          }, 300);
          return; // Don't process AI moves during chain reaction
        }
      } else {
        console.log('🚫 GameController: Move did not complete square, no autoplay triggered');
      }
    }

    // Handle AI moves for AI game mode
    if (this.gameMode === 'ai' && !newState.winner && newState.currentPlayer.isAI) {
      // Clear any existing AI move timer
      if (this.aiMoveTimer) {
        clearTimeout(this.aiMoveTimer);
      }
      this.aiMoveTimer = this.resourceManager.setTimeout(() => this.makeAIMove(), 500);
    }
  }

  /**
   * Called when the game ends
   */
  public onGameEnd(winner: any, _finalState: GameState): void {
    console.log('Game ended, winner:', winner.name);
  }

  /**
   * Called when an error occurs
   */
  public onError(errorType: string, error: Error): void {
    console.error(`GameController error (${errorType}):`, error);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Clean up all managed resources
    this.resourceManager.dispose();
    
    // Clean up state manager
    this.stateManager.removeListener(this);
    this.stateManager.dispose();
    
    // Clean up renderer
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    // Clear player identity service
    this.playerIdentityService.clear();
  }
}