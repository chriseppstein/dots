import './components/GameSetup';
import './components/GameBoard';
import { GridSize, GameMode } from './core/types';

class CubesApp {
  private setupScreen: HTMLElement;
  private gameScreen: HTMLElement;
  private gameBoard: any;

  constructor() {
    this.setupScreen = document.getElementById('setup-screen')!;
    this.gameScreen = document.getElementById('game-screen')!;
    this.gameBoard = document.querySelector('game-board')!;
    
    this.init();
  }

  private init() {
    const gameSetup = document.querySelector('game-setup');
    
    if (gameSetup) {
      gameSetup.addEventListener('gamestart', (event: any) => {
        const { gridSize, gameMode, player1Name, player2Name, networkManager, gameState, autoplayChainReactions } = event.detail;
        this.startGame(gridSize, gameMode, player1Name, player2Name, networkManager, gameState, autoplayChainReactions);
      });
    }
    
    if (this.gameBoard) {
      this.gameBoard.addEventListener('newgame', () => {
        this.showSetupScreen();
      });
    }
  }

  private startGame(gridSize: GridSize, gameMode: GameMode, player1Name: string, player2Name: string, networkManager?: any, gameState?: any, autoplayChainReactions?: boolean) {
    this.setupScreen.style.display = 'none';
    this.gameScreen.style.display = 'block';
    
    this.gameBoard.startGame(gridSize, gameMode, player1Name, player2Name, networkManager, gameState, autoplayChainReactions);
  }

  private showSetupScreen() {
    this.setupScreen.style.display = 'flex';
    this.gameScreen.style.display = 'none';
    
    // Reset the game setup component to initial state
    const gameSetup = document.querySelector('game-setup') as any;
    if (gameSetup && gameSetup.reset) {
      gameSetup.reset();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CubesApp();
});