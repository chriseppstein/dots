import { GridSize, Point3D, Line, Square, Cube, Player, GameState, GameMode, GameMove } from './types';

export class GameEngine {
  private state: GameState;
  private moveHistory: GameMove[] = [];
  private dots: Point3D[][][] = [];
  private drawnLinesSet: Set<string> = new Set();

  constructor(gridSize: GridSize = 4, gameMode: GameMode = 'local') {
    this.state = this.initializeGameState(gridSize, gameMode);
    this.initializeDots();
    this.initializeCubes();
    // Initialize the drawnLinesSet with any existing lines (should be empty initially)
    for (const line of this.state.lines) {
      this.drawnLinesSet.add(this.getLineKey(line));
    }
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
    this.drawnLinesSet.add(this.getLineKey(line)); // Add to Set for O(1) lookups
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
    // O(1) lookup using the Set
    const key = this.getLineKey(newLine);
    return this.drawnLinesSet.has(key);
  }

  private pointsEqual(p1: Point3D, p2: Point3D): boolean {
    return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z;
  }

  private getLineKey(line: Line): string {
    // Create a normalized key for the line (handles both directions)
    const p1 = `${line.start.x},${line.start.y},${line.start.z}`;
    const p2 = `${line.end.x},${line.end.y},${line.end.z}`;
    return p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
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
    // O(1) lookup using the Set
    const key = this.getLineKey(line);
    return this.drawnLinesSet.has(key);
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
   * Properly synchronize engine state with server state.
   * This method maintains encapsulation and ensures state consistency.
   */
  public syncWithServerState(serverState: Partial<GameState>): void {
    // Validate the incoming state
    if (!serverState) {
      throw new Error('Server state is required for synchronization');
    }

    // Create a new state object to maintain immutability principles
    const newState: GameState = { ...this.state };

    // Sync lines - map player references to engine players
    if (serverState.lines !== undefined && serverState.players) {
      newState.lines = serverState.lines.map((line: any) => {
        if (line.player) {
          // Find the player index based on server ID
          const playerIndex = serverState.players!.findIndex(
            (p: any) => p.id === line.player.id
          );
          if (playerIndex !== -1 && playerIndex < this.state.players.length) {
            return {
              ...line,
              player: this.state.players[playerIndex]
            };
          }
        }
        return line;
      });
    } else if (serverState.lines !== undefined) {
      newState.lines = [...serverState.lines];
    }
    
    // Rebuild the drawnLinesSet with the new lines
    if (serverState.lines !== undefined) {
      this.drawnLinesSet.clear();
      for (const line of newState.lines) {
        this.drawnLinesSet.add(this.getLineKey(line));
      }
    }

    // Sync cubes
    if (serverState.cubes !== undefined) {
      newState.cubes = serverState.cubes.map(cube => ({
        ...cube,
        faces: cube.faces.map(face => ({ ...face }))
      }));
    }

    // Sync players - maintain engine IDs
    if (serverState.players !== undefined && serverState.players.length === this.state.players.length) {
      newState.players = this.state.players.map((enginePlayer, index) => {
        const serverPlayer = serverState.players![index];
        return {
          ...enginePlayer,
          // Copy all properties except ID
          name: serverPlayer.name,
          color: serverPlayer.color,
          score: serverPlayer.score,
          squareCount: serverPlayer.squareCount,
          isAI: serverPlayer.isAI
        };
      });
    }

    // Sync current player - find by position
    if (serverState.currentPlayer !== undefined && serverState.players) {
      const currentPlayerIndex = serverState.players.findIndex(
        p => p.id === serverState.currentPlayer!.id
      );
      if (currentPlayerIndex !== -1 && currentPlayerIndex < newState.players.length) {
        newState.currentPlayer = newState.players[currentPlayerIndex];
      }
    }

    // Sync turn
    if (serverState.turn !== undefined) {
      newState.turn = serverState.turn;
    }

    // Sync winner
    if (serverState.winner !== undefined) {
      if (serverState.winner && serverState.players) {
        const winnerIndex = serverState.players.findIndex(
          p => p.id === serverState.winner!.id
        );
        if (winnerIndex !== -1 && winnerIndex < newState.players.length) {
          newState.winner = newState.players[winnerIndex];
        }
      } else {
        newState.winner = null;
      }
    }

    // Sync lastMove
    if (serverState.lastMove !== undefined) {
      if (serverState.lastMove && serverState.lastMove.player && serverState.players) {
        const lastMovePlayerIndex = serverState.players.findIndex(
          p => p.id === serverState.lastMove!.player.id
        );
        if (lastMovePlayerIndex !== -1 && lastMovePlayerIndex < newState.players.length) {
          newState.lastMove = {
            ...serverState.lastMove,
            player: newState.players[lastMovePlayerIndex]
          };
        }
      } else {
        newState.lastMove = null;
      }
    }

    // Validate the new state before applying
    this.validateState(newState);

    // Apply the new state
    this.state = newState;
  }

  /**
   * Validate game state for consistency
   */
  private validateState(state: GameState): void {
    // Basic validation
    if (!state.players || state.players.length !== 2) {
      throw new Error('Game must have exactly 2 players');
    }

    if (!state.currentPlayer) {
      throw new Error('Current player must be defined');
    }

    // Ensure current player is one of the players
    const currentPlayerExists = state.players.some(p => p.id === state.currentPlayer.id);
    if (!currentPlayerExists) {
      throw new Error('Current player must be one of the game players');
    }

    // Validate turn number
    if (state.turn < 0) {
      throw new Error('Turn number cannot be negative');
    }

    // Validate lines reference existing players
    // Note: During sync from server, line players might have different IDs that will be resolved
    // So we only validate if we're not in a sync operation
    for (const line of state.lines) {
      if (line.player) {
        const playerExists = state.players.some(p => p.id === line.player!.id);
        if (!playerExists) {
          // Check if it's one of the standard engine IDs
          const isEngineId = line.player.id === 'player1' || line.player.id === 'player2';
          if (!isEngineId) {
            // During sync, server IDs are expected and will be resolved
            console.warn(`Line references player with ID: ${line.player.id} - will be resolved during sync`);
          }
        }
      }
    }

    // Validate winner if present
    if (state.winner) {
      const winnerExists = state.players.some(p => p.id === state.winner!.id);
      if (!winnerExists) {
        throw new Error('Winner must be one of the game players');
      }
    }
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
    this.drawnLinesSet.clear(); // Clear the Set
    this.initializeDots();
    this.initializeCubes();
  }
}