import { GameController } from '../core/GameController';
import { GameRenderer } from '../core/GameRenderer';
import { GridSize, GameMode, Point3D, GameState } from '../core/types';
import { NetworkManager } from '../network/NetworkManager';
import { StateChangeListener } from '../core/GameStateManager';

export class GameBoard extends HTMLElement implements StateChangeListener {
  private controller?: GameController;
  private renderer?: GameRenderer;
  private renderContainer?: HTMLDivElement;
  private networkManager?: NetworkManager;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        #render-container {
          width: 100%;
          height: 100%;
        }
        
        .hud {
          position: absolute;
          top: 20px;
          left: 20px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 1rem;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          min-width: 200px;
        }
        
        .player-info {
          margin-bottom: 1rem;
        }
        
        .player-name {
          font-weight: bold;
          margin-bottom: 0.25rem;
        }
        
        .player-score {
          font-size: 1.5rem;
        }
        
        .player-squares {
          font-size: 0.9rem;
          opacity: 0.8;
          margin-top: 0.25rem;
        }
        
        .current-turn {
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          margin-bottom: 1rem;
        }
        
        .controls {
          position: absolute;
          bottom: 20px;
          left: 20px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 1rem;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .controls h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
        }
        
        .control-item {
          margin: 0.25rem 0;
          font-size: 0.9rem;
          opacity: 0.8;
        }
        
        button {
          padding: 0.5rem 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          margin-top: 1rem;
        }
        
        button:hover {
          transform: scale(1.05);
        }
        
        .winner-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 2rem;
          border-radius: 12px;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .winner-overlay h2 {
          margin: 0 0 1rem 0;
          font-size: 2rem;
        }
        
        .winner-name {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          color: #4ade80;
        }
        
        .final-scores {
          margin: 1rem 0;
        }
      </style>
      
      <div id="render-container"></div>
      
      <div class="hud">
        <div class="current-turn" id="current-turn">
          Current Turn: <span id="turn-player"></span>
        </div>
        <div class="player-info">
          <div class="player-name" id="player1-name" style="color: #ff0000;">Player 1</div>
          <div class="player-score" id="player1-score">0</div>
          <div class="player-squares" id="player1-squares">Squares: 0</div>
        </div>
        <div class="player-info">
          <div class="player-name" id="player2-name" style="color: #87CEEB;">Player 2</div>
          <div class="player-score" id="player2-score">0</div>
          <div class="player-squares" id="player2-squares">Squares: 0</div>
        </div>
      </div>
      
      <div class="controls">
        <h3>Controls</h3>
        <div class="control-item">🖱️ Left Click: Draw Line</div>
        <div class="control-item">🖱️ Right Drag: Rotate View</div>
        <div class="control-item">🔄 Scroll: Zoom In/Out</div>
        <button id="new-game">New Game</button>
      </div>
    `;
    
    this.renderContainer = this.shadowRoot.querySelector('#render-container') as HTMLDivElement;
  }

  public startGame(gridSize: GridSize, gameMode: GameMode, player1Name: string, player2Name: string, networkManager?: NetworkManager, gameState?: any) {
    // Clean up previous game
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = undefined;
    }
    
    if (this.controller) {
      // Unregister self as listener before disposing controller
      this.controller.getStateManager().removeListener(this);
      this.controller.dispose();
    }
    
    // Create the game controller (handles logic without rendering)
    this.networkManager = networkManager;
    this.controller = new GameController(gridSize, gameMode, player1Name, player2Name, networkManager);
    
    // Register as state change listener
    this.controller.getStateManager().addListener(this);
    
    // Only create renderer if we have a render container (not in test environment)
    if (this.renderContainer) {
      this.renderer = new GameRenderer(this.renderContainer, gridSize);
      this.controller.attachRenderer(this.renderer);
    }
    
    // Initialize game state
    if (gameMode === 'online' && gameState) {
      console.log('Setting up online game with server state:', {
        player1Id: gameState.players[0].id,
        player2Id: gameState.players[1].id,
        currentPlayerId: gameState.currentPlayer.id
      });
      this.controller.initializeWithState(gameState);
    } else {
      this.controller.initializeDefault();
    }
    
    // Initial HUD update will be handled by state listener
    
    // Set up click handler only if we have a renderer
    if (this.renderer) {
      this.renderer.onLineClick((start: Point3D, end: Point3D) => {
        if (!this.controller) return;
        this.controller.handleMove(start, end);
        // State changes (including winner detection) are now handled by listeners
      });
    }
    
    // Set up network event listeners for online games
    if (gameMode === 'online' && this.networkManager) {
      this.setupNetworkListeners();
    }
    
    if (this.shadowRoot) {
      const newGameButton = this.shadowRoot.querySelector('#new-game');
      if (newGameButton) {
        newGameButton.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('newgame'));
        });
      }
    }
  }
  
  private setupNetworkListeners() {
    if (!this.networkManager) return;
    
    this.networkManager.on('game-state-update', (gameState: any) => {
      console.log('GameBoard received game-state-update, lastMove:', gameState.lastMove);
      if (this.controller) {
        this.controller.handleServerStateUpdate(gameState);
        // State changes (including winner detection) are now handled by listeners
      }
    });
    
    this.networkManager.on('player-left', () => {
      alert('Your opponent has left the game.');
      this.dispatchEvent(new CustomEvent('newgame'));
    });
    
    this.networkManager.on('disconnected', () => {
      alert('Connection lost. Please rejoin the game.');
      this.dispatchEvent(new CustomEvent('newgame'));
    });
  }

  // StateChangeListener implementation
  
  /**
   * Called when the game state changes
   */
  public onStateChange(changeType: string, newState: GameState): void {
    this.updateHUD(newState);
  }

  /**
   * Called when the game ends
   */
  public onGameEnd(winner: any, finalState: GameState): void {
    this.showWinner();
  }

  /**
   * Called when an error occurs
   */
  public onError(errorType: string, error: Error): void {
    console.error(`GameBoard error (${errorType}):`, error);
  }

  private updateHUD(state?: GameState) {
    if (!this.shadowRoot || !this.controller) return;
    
    const gameState = state || this.controller.getState();
    
    const turnPlayer = this.shadowRoot.querySelector('#turn-player');
    if (turnPlayer) {
      turnPlayer.textContent = gameState.currentPlayer.name;
      turnPlayer.setAttribute('style', `color: ${gameState.currentPlayer.color}`);
    }
    
    const player1Name = this.shadowRoot.querySelector('#player1-name');
    const player1Score = this.shadowRoot.querySelector('#player1-score');
    const player1Squares = this.shadowRoot.querySelector('#player1-squares');
    if (player1Name && player1Score && player1Squares) {
      player1Name.textContent = gameState.players[0].name;
      player1Score.textContent = gameState.players[0].score.toString();
      player1Squares.textContent = `Squares: ${gameState.players[0].squareCount || 0}`;
    }
    
    const player2Name = this.shadowRoot.querySelector('#player2-name');
    const player2Score = this.shadowRoot.querySelector('#player2-score');
    const player2Squares = this.shadowRoot.querySelector('#player2-squares');
    if (player2Name && player2Score && player2Squares) {
      player2Name.textContent = gameState.players[1].name;
      player2Score.textContent = gameState.players[1].score.toString();
      player2Squares.textContent = `Squares: ${gameState.players[1].squareCount || 0}`;
    }
  }

  private showWinner() {
    if (!this.shadowRoot || !this.controller) return;
    
    const state = this.controller.getState();
    if (!state.winner) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'winner-overlay';
    overlay.innerHTML = `
      <h2>🎉 Game Over! 🎉</h2>
      <div class="winner-name">${state.winner.name} Wins!</div>
      <div class="final-scores">
        <div>${state.players[0].name}: ${state.players[0].score} cubes, ${state.players[0].squareCount || 0} squares</div>
        <div>${state.players[1].name}: ${state.players[1].score} cubes, ${state.players[1].squareCount || 0} squares</div>
      </div>
      <button onclick="this.parentElement.remove()">Close</button>
    `;
    
    this.shadowRoot.appendChild(overlay);
  }
}

customElements.define('game-board', GameBoard);