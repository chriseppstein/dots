import './components/GameSetup';
import './components/GameBoard';
import { GridSize, GameMode } from './core/types';

class PlanesApp {
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
        const { gridSize, gameMode, player1Name, player2Name, networkManager, gameState } = event.detail;
        this.startGame(gridSize, gameMode, player1Name, player2Name, networkManager, gameState);
      });
    }
    
    if (this.gameBoard) {
      this.gameBoard.addEventListener('newgame', () => {
        this.showSetupScreen();
      });
    }
  }

  private startGame(gridSize: GridSize, gameMode: GameMode, player1Name: string, player2Name: string, networkManager?: any, gameState?: any) {
    this.setupScreen.style.display = 'none';
    this.gameScreen.style.display = 'block';
    
    this.gameBoard.startGame(gridSize, gameMode, player1Name, player2Name, networkManager, gameState);
  }

  private showSetupScreen() {
    this.setupScreen.style.display = 'flex';
    this.gameScreen.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PlanesApp();
});