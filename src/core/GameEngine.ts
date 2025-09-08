import { GridSize, Point3D, Line, Square, Cube, Player, GameState, GameMode, GameMove } from './types';

export class GameEngine {
  private state: GameState;
  private moveHistory: GameMove[] = [];
  private dots: Point3D[][][] = [];

  constructor(gridSize: GridSize = 4, gameMode: GameMode = 'local') {
    this.state = this.initializeGameState(gridSize, gameMode);
    this.initializeDots();
    this.initializeCubes();
  }

  private initializeGameState(gridSize: GridSize, gameMode: GameMode): GameState {
    const player1: Player = {
      id: 'player1',
      name: 'Player 1',
      color: '#FF0000',
      score: 0,
      squareCount: 0
    };

    const player2: Player = {
      id: 'player2',
      name: gameMode === 'ai' ? 'AI' : 'Player 2',
      color: '#87CEEB',
      score: 0,
      squareCount: 0,
      isAI: gameMode === 'ai'
    };

    return {
      gridSize,
      currentPlayer: player1,
      players: [player1, player2],
      lines: [],
      cubes: [],
      gameMode,
      winner: null,
      turn: 0
    };
  }

  private initializeDots(): void {
    const size = this.state.gridSize;
    for (let x = 0; x < size; x++) {
      this.dots[x] = [];
      for (let y = 0; y < size; y++) {
        this.dots[x][y] = [];
        for (let z = 0; z < size; z++) {
          this.dots[x][y][z] = { x, y, z };
        }
      }
    }
  }

  private initializeCubes(): void {
    const size = this.state.gridSize - 1;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const cube = this.createCube({ x, y, z });
          this.state.cubes.push(cube);
        }
      }
    }
  }

  private createCube(position: Point3D): Cube {
    const { x, y, z } = position;
    const faces: Square[] = [
      this.createSquare([
        { x, y, z },
        { x: x + 1, y, z },
        { x: x + 1, y: y + 1, z },
        { x, y: y + 1, z }
      ]),
      this.createSquare([
        { x, y, z: z + 1 },
        { x: x + 1, y, z: z + 1 },
        { x: x + 1, y: y + 1, z: z + 1 },
        { x, y: y + 1, z: z + 1 }
      ]),
      this.createSquare([
        { x, y, z },
        { x: x + 1, y, z },
        { x: x + 1, y, z: z + 1 },
        { x, y, z: z + 1 }
      ]),
      this.createSquare([
        { x, y: y + 1, z },
        { x: x + 1, y: y + 1, z },
        { x: x + 1, y: y + 1, z: z + 1 },
        { x, y: y + 1, z: z + 1 }
      ]),
      this.createSquare([
        { x, y, z },
        { x, y: y + 1, z },
        { x, y: y + 1, z: z + 1 },
        { x, y, z: z + 1 }
      ]),
      this.createSquare([
        { x: x + 1, y, z },
        { x: x + 1, y: y + 1, z },
        { x: x + 1, y: y + 1, z: z + 1 },
        { x: x + 1, y, z: z + 1 }
      ])
    ];

    return {
      position,
      faces,
      owner: null,
      claimedFaces: 0
    };
  }

  private createSquare(corners: Point3D[]): Square {
    const lines: Line[] = [
      { start: corners[0], end: corners[1], player: null },
      { start: corners[1], end: corners[2], player: null },
      { start: corners[2], end: corners[3], player: null },
      { start: corners[3], end: corners[0], player: null }
    ];

    return {
      corners,
      lines,
      player: null
    };
  }

  public makeMove(start: Point3D, end: Point3D): boolean {
    if (this.state.winner) return false;

    const line: Line = { start, end, player: this.state.currentPlayer };
    
    if (this.isLineAlreadyDrawn(line)) {
      return false;
    }

    if (!this.isValidLine(line)) {
      return false;
    }

    this.state.lines.push(line);
    this.state.lastMove = line;
    this.moveHistory.push({
      line,
      player: this.state.currentPlayer,
      timestamp: Date.now()
    });

    const squaresCompleted = this.checkCompletedSquares(line);
    const cubesWon = this.checkCompletedCubes();

    this.updateScores();

    if (!squaresCompleted) {
      this.switchPlayer();
    }

    this.state.turn++;
    this.checkWinCondition();

    return true;
  }

  private isValidLine(line: Line): boolean {
    const { start, end } = line;
    
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const dz = Math.abs(end.z - start.z);
    
    const totalDiff = dx + dy + dz;
    
    return totalDiff === 1 && 
           this.isPointInGrid(start) && 
           this.isPointInGrid(end);
  }

  private isPointInGrid(point: Point3D): boolean {
    const size = this.state.gridSize;
    return point.x >= 0 && point.x < size &&
           point.y >= 0 && point.y < size &&
           point.z >= 0 && point.z < size;
  }

  private isLineAlreadyDrawn(newLine: Line): boolean {
    return this.state.lines.some(line => 
      (this.pointsEqual(line.start, newLine.start) && this.pointsEqual(line.end, newLine.end)) ||
      (this.pointsEqual(line.start, newLine.end) && this.pointsEqual(line.end, newLine.start))
    );
  }

  private pointsEqual(p1: Point3D, p2: Point3D): boolean {
    return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z;
  }

  private checkCompletedSquares(newLine: Line): boolean {
    let completedAny = false;
    
    for (const cube of this.state.cubes) {
      for (const face of cube.faces) {
        if (this.isLineInSquare(newLine, face)) {
          const allLinesDrawn = face.lines.every(line => 
            this.isLineDrawn(line)
          );
          
          if (allLinesDrawn && !face.player) {
            face.player = this.state.currentPlayer;
            cube.claimedFaces++;
            completedAny = true;
          }
        }
      }
    }
    
    return completedAny;
  }

  private isLineInSquare(line: Line, square: Square): boolean {
    return square.lines.some(squareLine => 
      (this.pointsEqual(squareLine.start, line.start) && this.pointsEqual(squareLine.end, line.end)) ||
      (this.pointsEqual(squareLine.start, line.end) && this.pointsEqual(squareLine.end, line.start))
    );
  }

  private isLineDrawn(line: Line): boolean {
    return this.state.lines.some(drawnLine => 
      (this.pointsEqual(drawnLine.start, line.start) && this.pointsEqual(drawnLine.end, line.end)) ||
      (this.pointsEqual(drawnLine.start, line.end) && this.pointsEqual(drawnLine.end, line.start))
    );
  }

  private checkCompletedCubes(): number {
    let cubesWon = 0;
    
    for (const cube of this.state.cubes) {
      if (!cube.owner && cube.claimedFaces >= 4) {
        const playerFaces = cube.faces.filter(face => 
          face.player?.id === this.state.currentPlayer.id
        ).length;
        
        if (playerFaces >= 4) {
          cube.owner = this.state.currentPlayer;
          cubesWon++;
        }
      }
    }
    
    return cubesWon;
  }

  private updateScores(): void {
    for (const player of this.state.players) {
      // Update cube score
      player.score = this.state.cubes.filter(cube => 
        cube.owner?.id === player.id
      ).length;
      
      // Update square count using unique face tracking
      player.squareCount = this.countUniqueFacesForPlayer(player.id);
    }
  }
  
  private countUniqueFacesForPlayer(playerId: string): number {
    const uniqueFaces = new Set<string>();
    
    for (const cube of this.state.cubes) {
      for (const face of cube.faces) {
        if (face.player?.id === playerId) {
          // Create a unique key for this face based on its corners
          const faceKey = face.corners
            .map(corner => `${corner.x},${corner.y},${corner.z}`)
            .sort()
            .join('|');
          uniqueFaces.add(faceKey);
        }
      }
    }
    
    return uniqueFaces.size;
  }

  private switchPlayer(): void {
    const currentIndex = this.state.players.indexOf(this.state.currentPlayer);
    this.state.currentPlayer = this.state.players[(currentIndex + 1) % this.state.players.length];
  }

  private checkWinCondition(): void {
    const totalCubes = Math.pow(this.state.gridSize - 1, 3);
    const claimedCubes = this.state.cubes.filter(cube => cube.owner !== null).length;
    
    if (claimedCubes === totalCubes) {
      const scores = this.state.players.map(p => ({ player: p, score: p.score }));
      scores.sort((a, b) => b.score - a.score);
      
      if (scores[0].score > scores[1].score) {
        this.state.winner = scores[0].player;
      }
    }
  }

  public getState(): GameState {
    return { ...this.state };
  }

  /**
   * Get mutable state for direct modification (used for server sync)
   */
  public getMutableState(): GameState {
    return this.state;
  }

  public getPossibleMoves(): Line[] {
    const possibleMoves: Line[] = [];
    const size = this.state.gridSize;
    
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const point = { x, y, z };
          
          if (x < size - 1) {
            const line = { start: point, end: { x: x + 1, y, z }, player: null };
            if (!this.isLineAlreadyDrawn(line)) {
              possibleMoves.push(line);
            }
          }
          
          if (y < size - 1) {
            const line = { start: point, end: { x, y: y + 1, z }, player: null };
            if (!this.isLineAlreadyDrawn(line)) {
              possibleMoves.push(line);
            }
          }
          
          if (z < size - 1) {
            const line = { start: point, end: { x, y, z: z + 1 }, player: null };
            if (!this.isLineAlreadyDrawn(line)) {
              possibleMoves.push(line);
            }
          }
        }
      }
    }
    
    return possibleMoves;
  }

  public reset(gridSize?: GridSize): void {
    this.state = this.initializeGameState(gridSize || this.state.gridSize, this.state.gameMode);
    this.moveHistory = [];
    this.dots = [];
    this.initializeDots();
    this.initializeCubes();
  }
}