import { BaseGameCommand, CommandType } from './Command';
import { GameState, Point3D, Line, Square, Cube } from '../types';
import { ValidationResult, StateValidator } from '../StateValidator';

/**
 * Command for making a move in the game.
 * This encapsulates all the logic for adding a line and updating the game state.
 */
export class MakeMoveCommand extends BaseGameCommand {
  constructor(
    private readonly start: Point3D,
    private readonly end: Point3D,
    private readonly playerId?: string
  ) {
    super(CommandType.MAKE_MOVE, true); // Can be undone
  }
  
  validate(state: GameState): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    // Check if it's a valid line
    const dx = Math.abs(this.end.x - this.start.x);
    const dy = Math.abs(this.end.y - this.start.y);
    const dz = Math.abs(this.end.z - this.start.z);
    const distance = dx + dy + dz;
    
    if (distance !== 1) {
      errors.push({
        code: 'INVALID_MOVE',
        message: 'Move must be between adjacent dots'
      });
    }
    
    // Check bounds
    const maxCoord = state.gridSize - 1;
    if (this.start.x < 0 || this.start.x > maxCoord ||
        this.start.y < 0 || this.start.y > maxCoord ||
        this.start.z < 0 || this.start.z > maxCoord ||
        this.end.x < 0 || this.end.x > maxCoord ||
        this.end.y < 0 || this.end.y > maxCoord ||
        this.end.z < 0 || this.end.z > maxCoord) {
      errors.push({
        code: 'OUT_OF_BOUNDS',
        message: 'Move is out of grid bounds'
      });
    }
    
    // Check if line already exists
    const lineExists = this.isLineAlreadyDrawn(state);
    if (lineExists) {
      errors.push({
        code: 'LINE_EXISTS',
        message: 'Line has already been drawn'
      });
    }
    
    // Check if game is over
    if (state.winner) {
      errors.push({
        code: 'GAME_OVER',
        message: 'Cannot make moves after game has ended'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  execute(state: GameState): GameState {
    // Create a deep copy of the state
    const newState: GameState = JSON.parse(JSON.stringify(state));
    
    // Determine which player is making the move
    const player = this.playerId 
      ? newState.players.find(p => p.id === this.playerId) 
      : newState.currentPlayer;
    
    if (!player) {
      throw new Error('Invalid player for move');
    }
    
    // Add the new line
    const newLine: Line = {
      start: { ...this.start },
      end: { ...this.end },
      player: player
    };
    newState.lines.push(newLine);
    
    // Check for completed squares and update scores
    const completedSquares = this.checkForCompletedSquares(newState, newLine);
    let squaresCompleted = 0;
    let cubesCompleted = 0;
    
    for (const square of completedSquares) {
      // Find the cube this square belongs to
      const cube = this.findCubeForSquare(newState, square);
      if (cube) {
        // Update the cube's face
        const faceIndex = this.getFaceIndex(cube, square);
        if (faceIndex !== -1 && !cube.faces[faceIndex].player) {
          cube.faces[faceIndex].player = player;
          squaresCompleted++;
          
          // Check if this completes the cube
          const claimedFaces = cube.faces.filter(f => f.player === player).length;
          if (claimedFaces >= 4 && !cube.owner) {
            cube.owner = player;
            cubesCompleted++;
          }
        }
      }
    }
    
    // Update player scores
    const playerIndex = newState.players.findIndex(p => p.id === player.id);
    if (playerIndex !== -1) {
      newState.players[playerIndex].score += cubesCompleted;
      newState.players[playerIndex].squareCount = 
        (newState.players[playerIndex].squareCount || 0) + squaresCompleted;
    }
    
    // Update turn and current player
    if (squaresCompleted === 0) {
      // No squares completed, switch to next player
      const currentIndex = newState.players.findIndex(p => p.id === newState.currentPlayer.id);
      const nextIndex = (currentIndex + 1) % newState.players.length;
      newState.currentPlayer = newState.players[nextIndex];
    }
    // If squares were completed, same player goes again
    
    newState.turn++;
    newState.lastMove = newLine;
    
    // Check for game end
    const totalCubes = Math.pow(state.gridSize - 1, 3);
    const claimedCubes = newState.cubes.filter(c => c.owner).length;
    if (claimedCubes === totalCubes) {
      // Game is over, determine winner
      const winner = newState.players.reduce((prev, curr) => 
        curr.score > prev.score ? curr : prev
      );
      newState.winner = winner;
    }
    
    return newState;
  }
  
  undo(state: GameState): GameState {
    // Remove the last line and recalculate state
    // This is complex and would need careful implementation
    // For now, we'll mark it as not implemented
    throw new Error('Undo not yet implemented for MakeMoveCommand');
  }
  
  protected getPayload(): any {
    return {
      start: this.start,
      end: this.end,
      playerId: this.playerId
    };
  }
  
  private isLineAlreadyDrawn(state: GameState): boolean {
    return state.lines.some(line =>
      (this.isSamePoint(line.start, this.start) && this.isSamePoint(line.end, this.end)) ||
      (this.isSamePoint(line.start, this.end) && this.isSamePoint(line.end, this.start))
    );
  }
  
  private isSamePoint(p1: Point3D, p2: Point3D): boolean {
    return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z;
  }
  
  private checkForCompletedSquares(state: GameState, newLine: Line): Square[] {
    const completedSquares: Square[] = [];
    const possibleSquares = this.getPossibleSquaresForLine(newLine);
    
    for (const square of possibleSquares) {
      if (this.isSquareComplete(state, square)) {
        completedSquares.push(square);
      }
    }
    
    return completedSquares;
  }
  
  private getPossibleSquaresForLine(line: Line): Square[] {
    const squares: Square[] = [];
    const { start, end } = line;
    
    // A line can be part of up to 4 squares (in 3D)
    // We need to find all possible squares that include this line
    
    // Determine the direction of the line
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    
    // Based on the direction, generate possible squares
    if (dx !== 0) {
      // Line is along X axis
      // Can form squares in XY and XZ planes
      squares.push(
        { corners: this.getSquareCorners(start, 'x', 'y') },
        { corners: this.getSquareCorners(start, 'x', 'z') },
        { corners: this.getSquareCorners({ ...start, y: start.y - 1 }, 'x', 'y') },
        { corners: this.getSquareCorners({ ...start, z: start.z - 1 }, 'x', 'z') }
      );
    } else if (dy !== 0) {
      // Line is along Y axis
      squares.push(
        { corners: this.getSquareCorners(start, 'y', 'x') },
        { corners: this.getSquareCorners(start, 'y', 'z') },
        { corners: this.getSquareCorners({ ...start, x: start.x - 1 }, 'y', 'x') },
        { corners: this.getSquareCorners({ ...start, z: start.z - 1 }, 'y', 'z') }
      );
    } else if (dz !== 0) {
      // Line is along Z axis
      squares.push(
        { corners: this.getSquareCorners(start, 'z', 'x') },
        { corners: this.getSquareCorners(start, 'z', 'y') },
        { corners: this.getSquareCorners({ ...start, x: start.x - 1 }, 'z', 'x') },
        { corners: this.getSquareCorners({ ...start, y: start.y - 1 }, 'z', 'y') }
      );
    }
    
    // Filter out invalid squares (out of bounds)
    return squares.filter(s => this.isValidSquare(s));
  }
  
  private getSquareCorners(origin: Point3D, axis1: string, axis2: string): Point3D[] {
    const corners: Point3D[] = [];
    const point = { ...origin };
    
    corners.push({ ...point });
    point[axis1]++;
    corners.push({ ...point });
    point[axis2]++;
    corners.push({ ...point });
    point[axis1]--;
    corners.push({ ...point });
    
    return corners;
  }
  
  private isValidSquare(square: Square): boolean {
    return square.corners.every(corner =>
      corner.x >= 0 && corner.y >= 0 && corner.z >= 0
    );
  }
  
  private isSquareComplete(state: GameState, square: Square): boolean {
    // Check if all 4 edges of the square have been drawn
    const edges = [
      [square.corners[0], square.corners[1]],
      [square.corners[1], square.corners[2]],
      [square.corners[2], square.corners[3]],
      [square.corners[3], square.corners[0]]
    ];
    
    return edges.every(([start, end]) =>
      state.lines.some(line =>
        (this.isSamePoint(line.start, start) && this.isSamePoint(line.end, end)) ||
        (this.isSamePoint(line.start, end) && this.isSamePoint(line.end, start))
      )
    );
  }
  
  private findCubeForSquare(state: GameState, square: Square): Cube | null {
    // Find which cube this square belongs to
    for (const cube of state.cubes) {
      // Check if the square matches any face of the cube
      for (let i = 0; i < 6; i++) {
        if (this.isSquareOnCubeFace(square, cube, i)) {
          return cube;
        }
      }
    }
    return null;
  }
  
  private isSquareOnCubeFace(square: Square, cube: Cube, faceIndex: number): boolean {
    const { x, y, z } = cube.position;
    
    // Define the 6 faces of the cube
    const faces = [
      // Front (z)
      [{ x, y, z }, { x: x + 1, y, z }, { x: x + 1, y: y + 1, z }, { x, y: y + 1, z }],
      // Back (z+1)
      [{ x, y, z: z + 1 }, { x: x + 1, y, z: z + 1 }, { x: x + 1, y: y + 1, z: z + 1 }, { x, y: y + 1, z: z + 1 }],
      // Left (x)
      [{ x, y, z }, { x, y: y + 1, z }, { x, y: y + 1, z: z + 1 }, { x, y, z: z + 1 }],
      // Right (x+1)
      [{ x: x + 1, y, z }, { x: x + 1, y: y + 1, z }, { x: x + 1, y: y + 1, z: z + 1 }, { x: x + 1, y, z: z + 1 }],
      // Bottom (y)
      [{ x, y, z }, { x: x + 1, y, z }, { x: x + 1, y, z: z + 1 }, { x, y, z: z + 1 }],
      // Top (y+1)
      [{ x, y: y + 1, z }, { x: x + 1, y: y + 1, z }, { x: x + 1, y: y + 1, z: z + 1 }, { x, y: y + 1, z: z + 1 }]
    ];
    
    const face = faces[faceIndex];
    
    // Check if square corners match face corners (order may differ)
    return square.corners.every(corner =>
      face.some(faceCorner => this.isSamePoint(corner, faceCorner))
    );
  }
  
  private getFaceIndex(cube: Cube, square: Square): number {
    for (let i = 0; i < 6; i++) {
      if (this.isSquareOnCubeFace(square, cube, i)) {
        return i;
      }
    }
    return -1;
  }
}