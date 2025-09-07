import { GameEngine } from '../core/GameEngine';
import { GameRenderer } from '../core/GameRenderer';
import { GridSize, GameMode, Point3D } from '../core/types';
import { AIPlayer } from '../ai/AIPlayer';
import { NetworkManager } from '../network/NetworkManager';

export class GameBoard extends HTMLElement {
  private engine?: GameEngine;
  private renderer?: GameRenderer;
  private renderContainer?: HTMLDivElement;
  private aiPlayer?: AIPlayer;
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
          <div class="player-name" id="player2-name" style="color: #0000ff;">Player 2</div>
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
    if (!this.renderContainer) return;
    
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    this.networkManager = networkManager;
    this.engine = new GameEngine(gridSize, gameMode);
    this.renderer = new GameRenderer(this.renderContainer, gridSize);
    
    if (gameMode === 'ai') {
      this.aiPlayer = new AIPlayer(this.engine);
    }
    
    // For online games, immediately sync with server state
    if (gameMode === 'online' && gameState) {
      console.log('Setting up online game with server state:', {
        player1Id: gameState.players[0].id,
        player2Id: gameState.players[1].id,
        currentPlayerId: gameState.currentPlayer.id
      });
      
      // Sync the full state including IDs
      this.syncEngineWithServerState(gameState);
      this.renderer.updateFromGameState(gameState);
    } else {
      // For local/AI games, just set the names
      const state = this.engine.getState();
      state.players[0].name = player1Name;
      state.players[1].name = player2Name;
    }
    
    this.updateHUD();
    
    this.renderer.onLineClick((start: Point3D, end: Point3D) => {
      if (!this.engine) return;
      
      const state = this.engine.getState();
      if (state.winner) return;
      
      if (state.gameMode === 'ai' && state.currentPlayer.isAI) return;
      
      // For online games, only send move to server - don't apply locally
      if (gameMode === 'online' && this.networkManager) {
        const playerId = this.networkManager.getPlayerId();
        console.log(`Player ${playerId} attempting move. Current player: ${state.currentPlayer.id}`);
        if (playerId !== state.currentPlayer.id) {
          console.log('🚨 NOT THIS PLAYER TURN - MOVE BLOCKED 🚨');
          console.log('=== CLIENT SIDE DEBUG INFO ===');
          console.log('Client Player ID:', playerId);
          console.log('Client Player ID type:', typeof playerId);
          console.log('Current Player ID from state:', state.currentPlayer.id);
          console.log('Current Player ID type:', typeof state.currentPlayer.id);
          console.log('Are they equal?', playerId === state.currentPlayer.id);
          console.log('Full current player object:', JSON.stringify(state.currentPlayer, null, 2));
          console.log('All players in state:', JSON.stringify(state.players, null, 2));
          console.log('Game turn:', state.turn);
          console.log('Game mode:', state.gameMode);
          console.log('Network manager connected:', this.networkManager.isConnected());
          console.log('Room ID:', this.networkManager.getRoomId());
          console.log('=== END CLIENT DEBUG ===');
          // Not this player's turn
          return;
        }
        // Send move to server, which will validate and broadcast back
        console.log('Sending move to server:', { start, end });
        this.networkManager.makeMove(start, end);
        return;
      }
      
      // For local/AI games, apply move locally
      const success = this.engine.makeMove(start, end);
      
      if (success) {
        this.updateGame();
        
        if (state.gameMode === 'ai' && !state.winner) {
          setTimeout(() => this.makeAIMove(), 500);
        }
      }
    });
    
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
      console.log('Received game-state-update:', { 
        turn: gameState.turn, 
        currentPlayer: gameState.currentPlayer?.id,
        linesCount: gameState.lines?.length 
      });
      // Update local game engine with server state
      if (this.engine && this.renderer) {
        // Sync the local engine state with server state
        this.syncEngineWithServerState(gameState);
        this.renderer.updateFromGameState(gameState);
        this.updateHUD();
        
        // Check for winner
        if (gameState.winner) {
          this.showWinner();
        }
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

  private makeAIMove() {
    if (!this.engine || !this.aiPlayer) return;
    
    const state = this.engine.getState();
    if (!state.currentPlayer.isAI || state.winner) return;
    
    const move = this.aiPlayer.getNextMove();
    if (move) {
      this.engine.makeMove(move.start, move.end);
      this.updateGame();
    }
  }

  private syncEngineWithServerState(serverState: any) {
    if (!this.engine) return;
    
    console.log('🔄 SYNCING ENGINE WITH SERVER STATE 🔄');
    console.log('Server state current player:', JSON.stringify(serverState.currentPlayer, null, 2));
    
    // Update the engine's internal state to match server completely
    const engineState = this.engine.getState();
    console.log('Engine state BEFORE sync - current player:', JSON.stringify(engineState.currentPlayer, null, 2));
    
    // Copy all properties from server state
    engineState.lines = serverState.lines || [];
    engineState.cubes = serverState.cubes || [];
    if (serverState.players) {
      for (var i = 0; i < serverState.players.length; i++) {
        Object.assign(engineState.players[i], serverState.players[i])
      }
    }
    engineState.turn = serverState.turn || 0;
    engineState.winner = serverState.winner || null;
    engineState.gridSize = serverState.gridSize || engineState.gridSize;
    engineState.gameMode = serverState.gameMode || engineState.gameMode;
    
    console.log('Engine state AFTER sync - current player:', JSON.stringify(engineState.currentPlayer, null, 2));
    console.log('🔄 ENGINE SYNC COMPLETE 🔄');
  }

  private updateGame() {
    if (!this.engine || !this.renderer) return;
    
    const state = this.engine.getState();
    this.renderer.updateFromGameState(state);
    this.updateHUD();
    
    if (state.winner) {
      this.showWinner();
    }
  }

  private updateHUD() {
    if (!this.shadowRoot || !this.engine) return;
    
    const state = this.engine.getState();
    
    const turnPlayer = this.shadowRoot.querySelector('#turn-player');
    if (turnPlayer) {
      turnPlayer.textContent = state.currentPlayer.name;
      turnPlayer.setAttribute('style', `color: ${state.currentPlayer.color}`);
    }
    
    const player1Name = this.shadowRoot.querySelector('#player1-name');
    const player1Score = this.shadowRoot.querySelector('#player1-score');
    const player1Squares = this.shadowRoot.querySelector('#player1-squares');
    if (player1Name && player1Score && player1Squares) {
      player1Name.textContent = state.players[0].name;
      player1Score.textContent = state.players[0].score.toString();
      player1Squares.textContent = `Squares: ${state.players[0].squareCount || 0}`;
    }
    
    const player2Name = this.shadowRoot.querySelector('#player2-name');
    const player2Score = this.shadowRoot.querySelector('#player2-score');
    const player2Squares = this.shadowRoot.querySelector('#player2-squares');
    if (player2Name && player2Score && player2Squares) {
      player2Name.textContent = state.players[1].name;
      player2Score.textContent = state.players[1].score.toString();
      player2Squares.textContent = `Squares: ${state.players[1].squareCount || 0}`;
    }
  }

  private showWinner() {
    if (!this.shadowRoot || !this.engine) return;
    
    const state = this.engine.getState();
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