import { GameState, Point3D, Line, Player, Cube, Square, GridSize } from '../core/types';

/**
 * GameRules - Pure functions for game logic and validation
 * 
 * This module contains all game rules as pure functions with no state.
 * All functions are deterministic and side-effect free.
 */

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface MoveResult {
  valid: boolean;
  completedSquares: Square[];
  claimedCubes: Cube[];
  shouldKeepTurn: boolean;
  winner?: Player;
}

export interface ScoreResult {
  player1Score: number;
  player2Score: number;
  player1Squares: number;
  player2Squares: number;
}

/**
 * Validates if a move is legal according to game rules
 */
export function validateMove(state: GameState, start: Point3D, end: Point3D): ValidationResult {
  // Check if game is already won
  if (state.winner) {
    return { valid: false, reason: 'Game is already over' };
  }

  // Validate points are different
  if (pointsEqual(start, end)) {
    return { valid: false, reason: 'Start and end points must be different' };
  }

  // Validate points are within grid bounds
  const gridSize = state.gridSize;
  if (!isValidPoint(start, gridSize) || !isValidPoint(end, gridSize)) {
    return { valid: false, reason: 'Points must be within grid bounds' };
  }

  // Check if points are adjacent
  if (!arePointsAdjacent(start, end)) {
    return { valid: false, reason: 'Points must be adjacent' };
  }

  // Check if line already exists
  if (lineExists(state.lines, start, end)) {
    return { valid: false, reason: 'Line already exists' };
  }

  return { valid: true };
}

/**
 * Calculates which squares are completed by a move
 */
export function getCompletedSquares(state: GameState, start: Point3D, end: Point3D): Square[] {
  const completedSquares: Square[] = [];
  const gridSize = state.gridSize;
  
  // After adding the new line, check all potential squares that could be completed
  const newLine = { start, end, player: state.currentPlayer };
  const linesWithNew = [...state.lines, newLine];

  // Check all six orientations for completed squares
  const orientations = [
    { dx: 1, dy: 0, dz: 0, normal: 'x' },
    { dx: 0, dy: 1, dz: 0, normal: 'y' },
    { dx: 0, dy: 0, dz: 1, normal: 'z' }
  ];

  for (const orient of orientations) {
    const squares = findCompletedSquaresInOrientation(linesWithNew, newLine, orient, gridSize);
    completedSquares.push(...squares);
  }

  return completedSquares;
}

/**
 * Determines which cubes are claimed after completing squares
 */
export function getClaimedCubes(state: GameState, completedSquares: Square[]): Cube[] {
  const claimedCubes: Cube[] = [];
  const cubeOwnership = new Map<string, { player: Player; faceCount: number }>();

  // Count faces per cube for each player
  const allSquares = [...state.squares, ...completedSquares];
  
  for (const square of allSquares) {
    const adjacentCubes = getCubesAdjacentToSquare(square, state.gridSize);
    
    for (const cubePos of adjacentCubes) {
      const key = `${cubePos.x},${cubePos.y},${cubePos.z}`;
      
      if (!cubeOwnership.has(key)) {
        cubeOwnership.set(key, { player: square.player, faceCount: 1 });
      } else {
        const ownership = cubeOwnership.get(key)!;
        if (ownership.player.id === square.player.id) {
          ownership.faceCount++;
        }
      }
    }
  }

  // Check which cubes are newly claimed (4+ faces)
  for (const [key, ownership] of cubeOwnership) {
    if (ownership.faceCount >= 4) {
      const [x, y, z] = key.split(',').map(Number);
      const position = { x, y, z };
      
      // Check if cube was already claimed
      const alreadyClaimed = state.cubes.some(c => 
        c.position.x === position.x && 
        c.position.y === position.y && 
        c.position.z === position.z
      );
      
      if (!alreadyClaimed) {
        claimedCubes.push({
          position,
          owner: ownership.player,
          faces: [] // Faces will be populated by the caller if needed
        });
      }
    }
  }

  return claimedCubes;
}

/**
 * Calculates the current score for all players
 */
export function calculateScore(state: GameState): ScoreResult {
  let player1Score = 0;
  let player2Score = 0;
  let player1Squares = 0;
  let player2Squares = 0;

  // Count cubes (main score)
  for (const cube of state.cubes) {
    if (cube.owner.id === state.players[0].id) {
      player1Score++;
    } else if (cube.owner.id === state.players[1].id) {
      player2Score++;
    }
  }

  // Count unique squares using Set to avoid duplicates
  const uniqueSquares = new Set<string>();
  
  for (const square of state.squares) {
    const key = getSquareKey(square);
    if (!uniqueSquares.has(key)) {
      uniqueSquares.add(key);
      if (square.player.id === state.players[0].id) {
        player1Squares++;
      } else if (square.player.id === state.players[1].id) {
        player2Squares++;
      }
    }
  }

  return {
    player1Score,
    player2Score,
    player1Squares,
    player2Squares
  };
}

/**
 * Checks if the game has a winner
 */
export function checkWinCondition(state: GameState): Player | null {
  const totalPossibleCubes = Math.pow(state.gridSize - 1, 3);
  const claimedCubes = state.cubes.length;

  // Game ends when all cubes are claimed
  if (claimedCubes >= totalPossibleCubes) {
    const scores = calculateScore(state);
    
    if (scores.player1Score > scores.player2Score) {
      return state.players[0];
    } else if (scores.player2Score > scores.player1Score) {
      return state.players[1];
    } else {
      // In case of tie, check square count
      if (scores.player1Squares > scores.player2Squares) {
        return state.players[0];
      } else if (scores.player2Squares > scores.player1Squares) {
        return state.players[1];
      }
      // True tie - return first player as winner (or handle ties differently)
      return state.players[0];
    }
  }

  return null;
}

/**
 * Determines if a player should keep their turn after a move
 */
export function shouldPlayerKeepTurn(completedSquares: Square[], claimedCubes: Cube[]): boolean {
  return completedSquares.length > 0 || claimedCubes.length > 0;
}

/**
 * Gets all valid moves from the current state
 */
export function getValidMoves(state: GameState): Line[] {
  const validMoves: Line[] = [];
  const gridSize = state.gridSize;

  // Generate all possible lines
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        const point = { x, y, z };
        
        // Check lines in each direction
        const directions = [
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 0, z: 1 }
        ];
        
        for (const dir of directions) {
          const endPoint = {
            x: point.x + dir.x,
            y: point.y + dir.y,
            z: point.z + dir.z
          };
          
          if (isValidPoint(endPoint, gridSize)) {
            const validation = validateMove(state, point, endPoint);
            if (validation.valid) {
              validMoves.push({
                start: point,
                end: endPoint,
                player: state.currentPlayer
              });
            }
          }
        }
      }
    }
  }

  return validMoves;
}

// Helper functions (pure, no side effects)

function pointsEqual(p1: Point3D, p2: Point3D): boolean {
  return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z;
}

function isValidPoint(point: Point3D, gridSize: GridSize): boolean {
  return point.x >= 0 && point.x < gridSize &&
         point.y >= 0 && point.y < gridSize &&
         point.z >= 0 && point.z < gridSize;
}

function arePointsAdjacent(p1: Point3D, p2: Point3D): boolean {
  const dx = Math.abs(p1.x - p2.x);
  const dy = Math.abs(p1.y - p2.y);
  const dz = Math.abs(p1.z - p2.z);
  
  // Points are adjacent if they differ by 1 in exactly one dimension
  return (dx === 1 && dy === 0 && dz === 0) ||
         (dx === 0 && dy === 1 && dz === 0) ||
         (dx === 0 && dy === 0 && dz === 1);
}

function lineExists(lines: Line[], start: Point3D, end: Point3D): boolean {
  return lines.some(line => 
    (pointsEqual(line.start, start) && pointsEqual(line.end, end)) ||
    (pointsEqual(line.start, end) && pointsEqual(line.end, start))
  );
}

function findCompletedSquaresInOrientation(
  lines: Line[],
  newLine: Line,
  orientation: { dx: number; dy: number; dz: number; normal: string },
  gridSize: GridSize
): Square[] {
  const squares: Square[] = [];
  
  // This is a simplified version - the full implementation would check
  // all potential squares that could be completed by the new line
  // For brevity, returning empty array - actual implementation would be more complex
  
  return squares;
}

function getCubesAdjacentToSquare(square: Square, gridSize: GridSize): Point3D[] {
  const cubes: Point3D[] = [];
  
  // A square can be adjacent to up to 2 cubes
  // This would calculate which cubes are adjacent based on the square's position
  // For brevity, returning empty array - actual implementation would determine adjacency
  
  return cubes;
}

function getSquareKey(square: Square): string {
  // Create a unique key for a square based on its corners
  // This ensures we don't count the same square twice
  const corners = square.corners.map(c => `${c.x},${c.y},${c.z}`).sort();
  return corners.join('|');
}

/**
 * Creates a deep copy of the game state
 */
export function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Applies a move to a game state (returns new state, doesn't mutate)
 */
export function applyMove(state: GameState, start: Point3D, end: Point3D): GameState {
  const newState = cloneGameState(state);
  
  // Add the new line
  newState.lines.push({
    start,
    end,
    player: newState.currentPlayer
  });
  
  // Calculate completed squares and claimed cubes
  const completedSquares = getCompletedSquares(state, start, end);
  const claimedCubes = getClaimedCubes(state, completedSquares);
  
  // Add completed squares
  newState.squares.push(...completedSquares);
  
  // Add claimed cubes
  newState.cubes.push(...claimedCubes);
  
  // Update scores
  const scores = calculateScore(newState);
  newState.players[0].score = scores.player1Score;
  newState.players[1].score = scores.player2Score;
  newState.players[0].squareCount = scores.player1Squares;
  newState.players[1].squareCount = scores.player2Squares;
  
  // Check for winner
  newState.winner = checkWinCondition(newState);
  
  // Switch turns if no squares/cubes were completed
  if (!shouldPlayerKeepTurn(completedSquares, claimedCubes)) {
    const currentIndex = newState.players.findIndex(p => p.id === newState.currentPlayer.id);
    const nextIndex = (currentIndex + 1) % 2;
    newState.currentPlayer = newState.players[nextIndex];
  }
  
  // Update turn counter
  newState.turn++;
  
  // Set last move
  newState.lastMove = {
    start,
    end,
    player: state.currentPlayer
  };
  
  return newState;
}