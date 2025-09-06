import { GridSize, GameMode } from '../core/types';

export class GameSetup extends HTMLElement {
  private selectedGridSize: GridSize = 4;
  private selectedGameMode: GameMode = 'local';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  private render() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem;
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
        
        .start-button {
          width: 100%;
          padding: 1rem;
          margin-top: 1rem;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          border: none;
          font-size: 1.2rem;
        }
        
        .start-button:hover {
          transform: scale(1.02);
        }
        
        .player-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 1rem;
        }
        
        input[type="text"] {
          padding: 0.5rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border-radius: 6px;
          font-size: 1rem;
        }
        
        input[type="text"]::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }
        
        input[type="text"]:focus {
          outline: none;
          border-color: white;
          background: rgba(255, 255, 255, 0.2);
        }
      </style>
      
      <h2>Planes - 3D Dots Game</h2>
      
      <div class="setup-group">
        <label>Grid Size</label>
        <div class="grid-sizes">
          <button data-size="3" class="${this.selectedGridSize === 3 ? 'selected' : ''}">3×3×3</button>
          <button data-size="4" class="${this.selectedGridSize === 4 ? 'selected' : ''}">4×4×4</button>
          <button data-size="5" class="${this.selectedGridSize === 5 ? 'selected' : ''}">5×5×5</button>
          <button data-size="6" class="${this.selectedGridSize === 6 ? 'selected' : ''}">6×6×6</button>
        </div>
      </div>
      
      <div class="setup-group">
        <label>Game Mode</label>
        <div class="game-modes">
          <button data-mode="local" class="${this.selectedGameMode === 'local' ? 'selected' : ''}">Local</button>
          <button data-mode="ai" class="${this.selectedGameMode === 'ai' ? 'selected' : ''}">vs AI</button>
          <button data-mode="online" class="${this.selectedGameMode === 'online' ? 'selected' : ''}">Online</button>
        </div>
      </div>
      
      <div class="setup-group">
        <label>Player Names</label>
        <div class="player-inputs">
          <input type="text" id="player1" placeholder="Player 1" value="Player 1">
          <input type="text" id="player2" placeholder="${this.selectedGameMode === 'ai' ? 'AI' : 'Player 2'}" 
                 value="${this.selectedGameMode === 'ai' ? 'AI' : 'Player 2'}"
                 ${this.selectedGameMode === 'ai' ? 'disabled' : ''}>
        </div>
      </div>
      
      <button class="start-button">Start Game</button>
    `;
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.querySelectorAll('[data-size]').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const size = parseInt(target.dataset.size!) as GridSize;
        this.selectedGridSize = size;
        this.render();
        this.setupEventListeners();
      });
    });
    
    this.shadowRoot.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const mode = target.dataset.mode as GameMode;
        this.selectedGameMode = mode;
        this.render();
        this.setupEventListeners();
      });
    });
    
    const startButton = this.shadowRoot.querySelector('.start-button');
    if (startButton) {
      startButton.addEventListener('click', () => {
        const player1Input = this.shadowRoot!.querySelector('#player1') as HTMLInputElement;
        const player2Input = this.shadowRoot!.querySelector('#player2') as HTMLInputElement;
        
        this.dispatchEvent(new CustomEvent('gamestart', {
          detail: {
            gridSize: this.selectedGridSize,
            gameMode: this.selectedGameMode,
            player1Name: player1Input.value || 'Player 1',
            player2Name: player2Input.value || (this.selectedGameMode === 'ai' ? 'AI' : 'Player 2')
          }
        }));
      });
    }
  }
}

customElements.define('game-setup', GameSetup);