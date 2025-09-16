import { GridSize, GameMode } from '../core/types';
import { NetworkManager } from '../network/NetworkManager';

interface GameToken {
  roomId: string;
  playerId: string;
  playerName: string;
  token: string;
}

export class GameSetup extends HTMLElement {
  private selectedGridSize: GridSize = 4;
  private selectedGameMode: GameMode = 'local';
  private autoplayChainReactions: boolean = false;
  private currentStep: 'mode-selection' | 'game-setup' | 'waiting-room' = 'mode-selection';
  private networkManager: NetworkManager | null = null;
  private gameRoomUrl: string = '';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.checkForExistingGames();
    const isJoiningRoom = this.checkForRoomJoin();
    
    if (!isJoiningRoom) {
      this.render();
      this.setupEventListeners();
    }
  }

  private checkForRoomJoin() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    console.log('Checking for room join. URL:', window.location.href);
    console.log('Room ID from URL:', roomId);
    
    if (roomId) {
      console.log('Room ID found, handling join for room:', roomId);
      // This is a join request - handle it immediately
      this.handleJoinRoom(roomId);
      return true;
    }
    
    console.log('No room ID found, showing normal mode selection');
    return false;
  }

  private checkForExistingGames() {
    const tokens = this.getStoredTokens();
    if (tokens.length > 0) {
      // TODO: Add UI to rejoin existing games
      console.log('Found existing games:', tokens);
    }
  }

  private getStoredTokens(): GameToken[] {
    const stored = localStorage.getItem('planes-game-tokens');
    return stored ? JSON.parse(stored) : [];
  }

  private storeToken(token: GameToken) {
    const tokens = this.getStoredTokens();
    tokens.push(token);
    localStorage.setItem('planes-game-tokens', JSON.stringify(tokens));
  }

  private render() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem !important;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        h2 {
          margin: 0 0 1.5rem 0;
          text-align: center;
          font-size: 2rem;
        }
        
        .setup-group {
          margin-bottom: 1.5rem;
        }
        
        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .grid-sizes, .game-modes {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: 0.5rem;
        }
        
        .mode-buttons {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          margin-top: 1rem;
        }
        
        button {
          padding: 0.75rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          transition: all 0.3s ease;
        }
        
        button:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }
        
        button.selected {
          background: rgba(255, 255, 255, 0.3);
          border-color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .primary-button {
          width: 100%;
          padding: 1rem;
          margin-top: 1rem;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          border: none;
          font-size: 1.2rem;
        }
        
        .primary-button:hover {
          transform: scale(1.02);
        }
        
        .secondary-button {
          background: rgba(255, 255, 255, 0.2);
          margin-top: 0.5rem;
        }
        
        .player-input {
          margin-top: 1rem;
        }
        
        input[type="text"] {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border-radius: 6px;
          font-size: 1rem;
          box-sizing: border-box;
        }
        
        input[type="text"]::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }
        
        input[type="text"]:focus {
          outline: none;
          border-color: white;
          background: rgba(255, 255, 255, 0.2);
        }
        
        .checkbox-group {
          margin-top: 1rem;
        }
        
        .checkbox-wrapper {
          display: flex;
          align-items: center;
          margin-top: 0.5rem;
          cursor: pointer;
        }
        
        input[type="checkbox"] {
          margin-right: 0.75rem;
          transform: scale(1.2);
          cursor: pointer;
        }
        
        .checkbox-label {
          font-size: 1rem;
          cursor: pointer;
          flex: 1;
        }
        
        .checkbox-description {
          font-size: 0.85rem;
          opacity: 0.8;
          margin-top: 0.25rem;
          margin-left: 2rem;
          line-height: 1.3;
        }
        
        .url-display {
          background: rgba(255, 255, 255, 0.1);
          padding: 1rem;
          border-radius: 8px;
          margin: 1rem 0;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }
        
        .url-display input {
          background: transparent;
          border: none;
          color: white;
          font-family: monospace;
          font-size: 0.9rem;
        }
        
        .waiting-message {
          text-align: center;
          padding: 2rem !important;
          font-size: 1.1rem;
          opacity: 0.9;
        }
        
        .spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
          margin-right: 0.5rem;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
      
      ${this.renderContent()}
    `;
  }

  private renderContent(): string {
    switch (this.currentStep) {
      case 'mode-selection':
        return this.renderModeSelection();
      case 'game-setup':
        return this.renderGameSetup();
      case 'waiting-room':
        return this.renderWaitingRoom();
      default:
        return this.renderModeSelection();
    }
  }

  private renderModeSelection(): string {
    return `
      <h2>Choose Game Type</h2>
      <div class="mode-buttons">
        <button data-mode="local" class="primary-button">🏠 Local Multiplayer<br><small>Two players on this device</small></button>
        <button data-mode="ai" class="primary-button">🤖 Single Player<br><small>Play against AI</small></button>
        <button data-mode="online" class="primary-button">🌐 Online Multiplayer<br><small>Play with a friend online</small></button>
      </div>
    `;
  }

  private renderGameSetup(): string {
    const playerNameSection = this.selectedGameMode === 'local' 
      ? `
        <div class="setup-group">
          <label>Player Names</label>
          <input type="text" id="player1" placeholder="Player 1" value="Player 1">
          <input type="text" id="player2" placeholder="Player 2" value="Player 2" style="margin-top: 0.5rem;">
        </div>
      `
      : `
        <div class="setup-group">
          <label>Your Name</label>
          <input type="text" id="player1" placeholder="Your name" value="Player 1">
        </div>
      `;

    return `
      <h2>Game Setup</h2>
      
      <div class="setup-group">
        <label>Grid Size</label>
        <div class="grid-sizes">
          <button data-size="3" class="${this.selectedGridSize === 3 ? 'selected' : ''}">3×3×3</button>
          <button data-size="4" class="${this.selectedGridSize === 4 ? 'selected' : ''}">4×4×4</button>
          <button data-size="5" class="${this.selectedGridSize === 5 ? 'selected' : ''}">5×5×5</button>
          <button data-size="6" class="${this.selectedGridSize === 6 ? 'selected' : ''}">6×6×6</button>
        </div>
      </div>
      
      ${playerNameSection}
      
      <div class="setup-group">
        <label>Game Options</label>
        <div class="checkbox-group">
          <div class="checkbox-wrapper" id="autoplay-wrapper">
            <input type="checkbox" id="autoplay-chain-reactions" ${this.autoplayChainReactions ? 'checked' : ''}>
            <label for="autoplay-chain-reactions" class="checkbox-label">Autoplay Chain Reactions</label>
          </div>
          <div class="checkbox-description">
            When enabled, the computer automatically continues playing for you after completing a square to claim additional squares in a chain.
          </div>
        </div>
      </div>
      
      <button class="primary-button" id="create-game">Create Game</button>
      <button class="secondary-button" id="back-button">← Back</button>
    `;
  }

  private renderWaitingRoom(): string {
    return `
      <h2>Online Game Created</h2>
      
      <div class="setup-group">
        <label>Share this link with your opponent:</label>
        <div class="url-display">
          <input type="text" value="${this.gameRoomUrl}" readonly onclick="this.select()">
        </div>
        <button class="secondary-button" id="copy-url">📋 Copy Link</button>
      </div>
      
      <div class="waiting-message">
        <div class="spinner"></div>
        Waiting for player 2 to join...
      </div>
      
      <button class="secondary-button" id="cancel-game">Cancel Game</button>
    `;
  }
  
  private showJoiningMessage(player1Name: string) {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem !important;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        h2 {
          margin: 0 0 1.5rem 0;
          text-align: center;
          font-size: 2rem;
        }
        
        .joining-message {
          text-align: center;
          padding: 2rem !important;
          font-size: 1.1rem;
          opacity: 0.9;
        }
        
        .player-name {
          font-weight: bold;
          color: #f093fb;
          margin: 0.5rem 0;
        }
        
        .spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
          margin-right: 0.5rem;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
      
      <h2>Joining Game</h2>
      
      <div class="joining-message">
        <div>You're joining a game with:</div>
        <div class="player-name">${player1Name}</div>
        <div style="margin-top: 1rem;">
          <div class="spinner"></div>
          Starting game...
        </div>
      </div>
    `;
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;
    
    // Mode selection buttons
    this.shadowRoot.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const mode = target.dataset.mode as GameMode;
        this.selectedGameMode = mode;
        this.currentStep = 'game-setup';
        this.render();
        this.setupEventListeners();
      });
    });
    
    // Grid size selection
    this.shadowRoot.querySelectorAll('[data-size]').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const size = parseInt(target.dataset.size!) as GridSize;
        this.selectedGridSize = size;
        this.render();
        this.setupEventListeners();
      });
    });
    
    // Autoplay chain reactions checkbox
    const autoplayCheckbox = this.shadowRoot.querySelector('#autoplay-chain-reactions');
    if (autoplayCheckbox) {
      autoplayCheckbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.autoplayChainReactions = target.checked;
        console.log('☑️ GameSetup: Autoplay checkbox changed to', this.autoplayChainReactions);
      });
    }
    
    // Create game button
    const createGameButton = this.shadowRoot.querySelector('#create-game');
    if (createGameButton) {
      createGameButton.addEventListener('click', () => {
        this.handleCreateGame();
      });
    }
    
    // Back button
    const backButton = this.shadowRoot.querySelector('#back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        this.currentStep = 'mode-selection';
        this.render();
        this.setupEventListeners();
      });
    }
    
    // Copy URL button
    const copyUrlButton = this.shadowRoot.querySelector('#copy-url');
    if (copyUrlButton) {
      copyUrlButton.addEventListener('click', () => {
        this.copyGameUrl();
      });
    }
    
    // Cancel game button
    const cancelGameButton = this.shadowRoot.querySelector('#cancel-game');
    if (cancelGameButton) {
      cancelGameButton.addEventListener('click', () => {
        this.cancelOnlineGame();
      });
    }
  }

  private async handleCreateGame() {
    const player1Input = this.shadowRoot!.querySelector('#player1') as HTMLInputElement;
    const player1Name = player1Input.value.trim() || 'Player 1';
    
    if (this.selectedGameMode === 'online') {
      await this.createOnlineGame(player1Name);
    } else {
      // Handle local and AI games immediately
      const player2Input = this.shadowRoot!.querySelector('#player2') as HTMLInputElement;
      const player2Name = this.selectedGameMode === 'ai' 
        ? 'Computer' 
        : (player2Input?.value.trim() || 'Player 2');
      
      console.log('🎮 GameSetup: Dispatching gamestart event with autoplay =', this.autoplayChainReactions);
      this.dispatchEvent(new CustomEvent('gamestart', {
        detail: {
          gridSize: this.selectedGridSize,
          gameMode: this.selectedGameMode,
          player1Name,
          player2Name,
          autoplayChainReactions: this.autoplayChainReactions
        }
      }));
    }
  }

  private async createOnlineGame(playerName: string) {
    try {
      // Clean up any existing network manager first
      this.cleanupNetworkManager();
      
      this.networkManager = new NetworkManager();
      await this.networkManager.connect();
      
      this.networkManager.on('room-created', (data: { roomId: string, playerId: string }) => {
        const roomId = data.roomId;
        const token = this.generateToken();
        
        // Store game token
        this.storeToken({
          roomId,
          playerId: data.playerId,
          playerName,
          token
        });
        
        // Generate shareable URL
        this.gameRoomUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        
        this.currentStep = 'waiting-room';
        this.render();
        this.setupEventListeners();
      });
      
      this.networkManager.on('player-joined', (data: { playerId: string, playerName: string }) => {
        console.log('Player joined:', data);
        // This is received by player 1 when player 2 joins
        // But we don't start the game yet - wait for game-started event
      });
      
      this.networkManager.on('game-started', (gameState: any) => {
        console.log('Game started:', gameState);
        // Both players receive this when the game starts
        this.dispatchEvent(new CustomEvent('gamestart', {
          detail: {
            gridSize: this.selectedGridSize,
            gameMode: this.selectedGameMode,
            player1Name: gameState.players[0].name,
            player2Name: gameState.players[1].name,
            networkManager: this.networkManager,
            gameState: gameState,
            autoplayChainReactions: this.autoplayChainReactions
          }
        }));
      });
      
      this.networkManager.createRoom(playerName, this.selectedGridSize);
      
    } catch (error) {
      console.error('Failed to create online game:', error);
      alert('Failed to connect to server. Please try again.');
    }
  }

  private generateToken(): string {
    return Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
  }

  private copyGameUrl() {
    const urlInput = this.shadowRoot!.querySelector('.url-display input') as HTMLInputElement;
    urlInput.select();
    document.execCommand('copy');
    
    const button = this.shadowRoot!.querySelector('#copy-url') as HTMLButtonElement;
    const originalText = button.textContent;
    button.textContent = '✓ Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  }

  private cleanupNetworkManager() {
    if (this.networkManager) {
      // Remove all event listeners
      this.networkManager.off('room-created');
      this.networkManager.off('room-joined');
      this.networkManager.off('player-joined');
      this.networkManager.off('game-started');
      this.networkManager.off('error');
      this.networkManager.disconnect();
      this.networkManager = null;
    }
  }

  private cancelOnlineGame() {
    this.cleanupNetworkManager();
    this.currentStep = 'mode-selection';
    this.render();
    this.setupEventListeners();
  }

  public async handleJoinRoom(roomId: string) {
    // Check if user has a token for this room
    const tokens = this.getStoredTokens();
    const existingToken = tokens.find(t => t.roomId === roomId);
    
    if (existingToken) {
      // Check if the game has actually started by getting room info first
      try {
        this.networkManager = new NetworkManager();
        await this.networkManager.connect();
        
        // Get room info to check if game has started
        const roomInfo = await this.networkManager.getRoomInfo(roomId);
        
        if (roomInfo.playersCount === 1) {
          // Room creator returning to their own room - show waiting room
          console.log('Room creator returning to waiting room');
          
          // Set up the network manager with existing event handlers for waiting room
          this.networkManager.on('player-joined', (data: { playerId: string, playerName: string }) => {
            console.log('Player joined:', data);
            // This is received by player 1 when player 2 joins
            // But we don't start the game yet - wait for game-started event
          });
          
          this.networkManager.on('game-started', (gameState: any) => {
            console.log('Game started:', gameState);
            // Both players receive this when the game starts
            this.dispatchEvent(new CustomEvent('gamestart', {
              detail: {
                gridSize: this.selectedGridSize || gameState.gridSize || 4,
                gameMode: 'online' as GameMode,
                player1Name: gameState.players[0].name,
                player2Name: gameState.players[1].name,
                networkManager: this.networkManager,
                gameState: gameState,
                autoplayChainReactions: this.autoplayChainReactions
              }
            }));
          });
          
          // Generate shareable URL
          this.gameRoomUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
          
          // Show waiting room
          this.currentStep = 'waiting-room';
          this.render();
          this.setupEventListeners();
          
        } else {
          // Game has multiple players - rejoin existing game
          this.networkManager.joinRoom(roomId, existingToken.playerName);
          
          this.dispatchEvent(new CustomEvent('gamestart', {
            detail: {
              gridSize: roomInfo.gridSize || 4,
              gameMode: 'online' as GameMode,
              player1Name: existingToken.playerName,
              player2Name: 'Opponent',
              networkManager: this.networkManager,
              rejoining: true,
              autoplayChainReactions: this.autoplayChainReactions
            }
          }));
        }
      } catch (error) {
        console.error('Failed to rejoin game:', error);
        this.showJoinFormWithRoomInfo(roomId);
      }
    } else {
      this.showJoinFormWithRoomInfo(roomId);
    }
  }
  
  private async showJoinFormWithRoomInfo(roomId: string) {
    try {
      // Don't create a new NetworkManager if we already have one
      if (!this.networkManager) {
        this.networkManager = new NetworkManager();
        await this.networkManager.connect();
      }
      
      const roomInfo = await this.networkManager.getRoomInfo(roomId);
      this.showInvitationForm(roomId, roomInfo.player1Name, roomInfo.gridSize);
      
    } catch (error) {
      console.error('Failed to get room info:', error);
      if (error === 'Room not found') {
        this.showRoomNotFound();
      } else if (error === 'Room is full') {
        this.showRoomFull();
      } else {
        alert('Failed to connect to game. Please try again.');
        this.currentStep = 'mode-selection';
        this.render();
        this.setupEventListeners();
      }
    }
  }
  
  private showInvitationForm(roomId: string, player1Name: string, gridSize: any) {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem !important;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        h2 {
          margin: 0 0 1.5rem 0;
          text-align: center;
          font-size: 2rem;
        }
        
        .invitation {
          text-align: center;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          border: 2px solid rgba(255, 255, 255, 0.2);
        }
        
        .invitation-text {
          font-size: 1.2rem;
          margin-bottom: 1rem;
        }
        
        .player-name {
          font-weight: bold;
          color: #f093fb;
          font-size: 1.4rem;
          margin: 0.5rem 0;
        }
        
        .game-info {
          font-size: 0.9rem;
          opacity: 0.8;
          margin-top: 1rem;
        }
        
        .setup-group {
          margin-bottom: 1.5rem;
        }
        
        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        input[type="text"] {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border-radius: 6px;
          font-size: 1rem;
          box-sizing: border-box;
        }
        
        input[type="text"]::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }
        
        input[type="text"]:focus {
          outline: none;
          border-color: white;
          background: rgba(255, 255, 255, 0.2);
        }
        
        .primary-button {
          width: 100%;
          padding: 1rem;
          margin-top: 1rem;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          border: none;
          font-size: 1.2rem;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s ease;
        }
        
        .primary-button:hover {
          transform: scale(1.02);
        }
        
        .secondary-button {
          background: rgba(255, 255, 255, 0.2);
          margin-top: 0.5rem;
          width: 100%;
          padding: 0.75rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          transition: all 0.3s ease;
        }
        
        .how-to-play {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 1.5rem;
          margin: 1.5rem 0;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .how-to-play h3 {
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1.2rem;
          color: #f5576c;
        }
        
        .how-to-play-content {
          font-size: 0.95rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
        }
        
        .how-to-play ul {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        
        .how-to-play li {
          margin: 0.5rem 0;
        }
        
        .controls-section {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .controls-section h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          color: #f093fb;
        }
        
        .control-item {
          display: flex;
          align-items: center;
          margin: 0.3rem 0;
          font-size: 0.9rem;
        }
        
        .control-icon {
          margin-right: 0.5rem;
          font-size: 1.1rem;
        }
        
        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(5px);
        }
        
        .dialog-content {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 2rem !important;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }
        
        .close-dialog {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 1.5rem;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .close-dialog:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }
        
        .dialog-content h3 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          color: white;
        }
        
        .dialog-content .how-to-play-content {
          color: white;
        }
        
        .dialog-content .controls-section h4 {
          color: #ffd700;
        }
      </style>
      
      <h2>🎮 Game Invitation</h2>
      
      <div class="invitation">
        <div class="invitation-text">You've been invited to play Cubes by</div>
        <div class="player-name">${player1Name}</div>
        <div class="game-info">Grid Size: ${gridSize}×${gridSize}×${gridSize}</div>
      </div>
      
      <div class="setup-group">
        <label>Enter your name to join:</label>
        <input type="text" id="player-name" placeholder="Your name" value="Player 2">
      </div>
      
      <button class="secondary-button" id="how-to-play-btn" style="margin-bottom: 0.5rem;">📖 How to Play</button>
      <button class="primary-button" id="join-game">🚀 Join Game</button>
      <button class="secondary-button" id="decline-game">❌ Decline</button>
      
      <!-- How to Play Dialog -->
      <div id="how-to-play-dialog" class="dialog-overlay" style="display: none;">
        <div class="dialog-content">
          <button class="close-dialog" id="close-dialog">✕</button>
          <h3>📖 How to Play Cubes</h3>
          <div class="how-to-play-content">
            <p><strong>Objective:</strong> Capture more cubes than your opponent by completing their faces!</p>
            
            <ul>
              <li>🎯 <strong>Draw lines</strong> between adjacent dots to form squares (cube faces)</li>
              <li>📦 <strong>Complete 4 faces</strong> of a cube to capture it and score a point</li>
              <li>🔄 <strong>Keep your turn</strong> when you complete a square - chain combos for big scores!</li>
              <li>🏆 <strong>Win</strong> by capturing the most cubes when all lines are drawn</li>
            </ul>
            
            <div class="controls-section">
              <h4>🎮 Game Controls</h4>
              <div class="control-item">
                <span class="control-icon">🖱️</span>
                <span>Left Click on dots to draw lines between them</span>
              </div>
              <div class="control-item">
                <span class="control-icon">🔄</span>
                <span>Right Click + Drag to rotate the 3D view</span>
              </div>
              <div class="control-item">
                <span class="control-icon">🔍</span>
                <span>Scroll to zoom in and out</span>
              </div>
            </div>
            
            <p style="margin-top: 1rem; font-style: italic;">💡 Tip: Plan ahead! Setting up multiple squares in one turn can lead to massive scoring chains!</p>
          </div>
        </div>
      </div>
    `;
    
    this.setupInvitationListeners(roomId);
  }
  
  private setupInvitationListeners(roomId: string) {
    const joinButton = this.shadowRoot!.querySelector('#join-game') as HTMLButtonElement;
    const declineButton = this.shadowRoot!.querySelector('#decline-game') as HTMLButtonElement;
    const howToPlayBtn = this.shadowRoot!.querySelector('#how-to-play-btn') as HTMLButtonElement;
    const howToPlayDialog = this.shadowRoot!.querySelector('#how-to-play-dialog') as HTMLDivElement;
    const closeDialogBtn = this.shadowRoot!.querySelector('#close-dialog') as HTMLButtonElement;
    
    if (joinButton) {
      joinButton.addEventListener('click', () => {
        const nameInput = this.shadowRoot!.querySelector('#player-name') as HTMLInputElement;
        const playerName = nameInput.value.trim() || 'Player 2';
        this.handleJoinExistingRoom(roomId, playerName);
      });
    }
    
    if (declineButton) {
      declineButton.addEventListener('click', () => {
        this.currentStep = 'mode-selection';
        this.render();
        this.setupEventListeners();
      });
    }
    
    if (howToPlayBtn && howToPlayDialog) {
      howToPlayBtn.addEventListener('click', () => {
        howToPlayDialog.style.display = 'flex';
      });
    }
    
    if (closeDialogBtn && howToPlayDialog) {
      closeDialogBtn.addEventListener('click', () => {
        howToPlayDialog.style.display = 'none';
      });
      
      // Also close when clicking outside the dialog content
      howToPlayDialog.addEventListener('click', (e) => {
        if (e.target === howToPlayDialog) {
          howToPlayDialog.style.display = 'none';
        }
      });
    }
  }
  
  private showRoomNotFound() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem !important;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        h2 {
          margin: 0 0 1.5rem 0;
          text-align: center;
          font-size: 2rem;
        }
        
        .error-message {
          text-align: center;
          padding: 2rem !important;
          font-size: 1.1rem;
          opacity: 0.9;
        }
        
        .secondary-button {
          background: rgba(255, 255, 255, 0.2);
          margin-top: 1rem;
          width: 100%;
          padding: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          transition: all 0.3s ease;
        }
      </style>
      
      <h2>❌ Game Not Found</h2>
      
      <div class="error-message">
        <p>This game room doesn't exist or has already ended.</p>
        <p>Please ask for a new invitation link.</p>
      </div>
      
      <button class="secondary-button" onclick="window.location.href = window.location.origin + window.location.pathname">← Back to Main Menu</button>
    `;
  }
  
  private showRoomFull() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem !important;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        h2 {
          margin: 0 0 1.5rem 0;
          text-align: center;
          font-size: 2rem;
        }
        
        .error-message {
          text-align: center;
          padding: 2rem !important;
          font-size: 1.1rem;
          opacity: 0.9;
        }
        
        .secondary-button {
          background: rgba(255, 255, 255, 0.2);
          margin-top: 1rem;
          width: 100%;
          padding: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          transition: all 0.3s ease;
        }
      </style>
      
      <h2>🚫 Game is Full</h2>
      
      <div class="error-message">
        <p>This game already has 2 players and cannot accept more participants.</p>
        <p>You can start your own game instead!</p>
      </div>
      
      <button class="secondary-button" onclick="window.location.href = window.location.origin + window.location.pathname">🎮 Start New Game</button>
    `;
  }
  
  private async handleJoinExistingRoom(roomId: string, playerName?: string) {
    if (!playerName) {
      const player1Input = this.shadowRoot!.querySelector('#player1') as HTMLInputElement;
      playerName = player1Input?.value.trim() || 'Player 2';
    }
    
    try {
      // Don't create a new NetworkManager if we already have one
      if (!this.networkManager) {
        this.networkManager = new NetworkManager();
        await this.networkManager.connect();
      }
      
      this.networkManager.on('room-joined', (data: { roomId: string, playerId: string, gameState: any, player1Name: string }) => {
        console.log('Room joined:', data);
        const token = this.generateToken();
        
        // Store game token
        this.storeToken({
          roomId,
          playerId: data.playerId,
          playerName,
          token
        });
        
        // Show joining message
        this.showJoiningMessage(data.player1Name);
      });
      
      this.networkManager.on('game-started', (gameState: any) => {
        console.log('Game started for joiner:', gameState);
        // Both players receive this - start the game
        this.dispatchEvent(new CustomEvent('gamestart', {
          detail: {
            gridSize: gameState.gridSize || 4,
            gameMode: 'online' as GameMode,
            player1Name: gameState.players[0].name,
            player2Name: gameState.players[1].name,
            networkManager: this.networkManager,
            gameState: gameState,
            autoplayChainReactions: this.autoplayChainReactions
          }
        }));
      });
      
      this.networkManager.on('error', (error: string) => {
        if (error.includes('full') || error.includes('Full')) {
          alert('This game is full. You cannot join.');
          this.currentStep = 'mode-selection';
          this.render();
          this.setupEventListeners();
        } else {
          alert(`Failed to join game: ${error}`);
        }
      });
      
      this.networkManager.joinRoom(roomId, playerName);
      
    } catch (error) {
      console.error('Failed to join game:', error);
      alert('Failed to connect to server. Please try again.');
    }
  }

  /**
   * Reset the component to initial state when returning from a game
   */
  public reset(): void {
    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Reset component state
    this.currentStep = 'mode-selection';
    this.selectedGameMode = 'local' as GameMode;
    this.selectedGridSize = 4;
    this.autoplayChainReactions = false;
    
    // Re-render to initial state
    this.render();
    this.setupEventListeners();
  }

  /**
   * Clean up when component is removed from DOM
   */
  disconnectedCallback() {
    this.cleanupNetworkManager();
  }
}


customElements.define('game-setup', GameSetup);