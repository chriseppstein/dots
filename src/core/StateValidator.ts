import { GameState, Line, Square, Cube, Player } from './types';

/**
 * Validation result with detailed information about failures
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  context?: any;
}

export interface ValidationWarning {
  code: string;
  message: string;
  context?: any;
}

/**
 * Options for state validation
 */
export interface ValidationOptions {
  allowPartialState?: boolean;  // Allow partial states during synchronization
}

/**
 * Comprehensive state validator that ensures game state consistency
 * and maintains invariants throughout the game lifecycle
 */
export class StateValidator {
  /**
   * Validate complete game state
   */
  public static validate(state: GameState, options?: ValidationOptions): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic structure validation
    this.validateBasicStructure(state, errors);
    
    // If basic structure is invalid, skip other validations
    if (!state) {
      return {
        valid: false,
        errors,
        warnings
      };
    }
    
    // Player validation
    this.validatePlayers(state, errors, warnings);
    
    // Line validation
    this.validateLines(state, errors, warnings);
    
    // Cube validation - skip for partial states during synchronization
    // During sync, server may send player scores without updating cube data
    const isPartialSync = options?.allowPartialState === true;
    
    if (!isPartialSync) {
      this.validateCubes(state, errors, warnings);
      
      // Score consistency - only validate if we have cube data
      this.validateScores(state, errors, warnings);
      
      // Invariant checks - only validate if we have cube data
      this.validateInvariants(state, errors, warnings);
    } else {
      // In partial sync mode, still validate cubes if they were explicitly provided
      // but skip score/invariant checks since they may be inconsistent
      if (state.cubes && state.cubes.length > 0) {
        // Only do basic cube validation, not score consistency
        this.validateCubes(state, errors, warnings, options);
      }
    }
    
    // Game flow validation
    this.validateGameFlow(state, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate state transition (before and after states)
   */
  public static validateTransition(
    beforeState: GameState,
    afterState: GameState,
    action?: { type: string; payload?: any }
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // First validate the after state
    const stateValidation = this.validate(afterState);
    errors.push(...stateValidation.errors);
    warnings.push(...stateValidation.warnings);

    // Validate transition legality
    this.validateTransitionLegality(beforeState, afterState, action, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static validateBasicStructure(state: GameState, errors: ValidationError[]): void {
    if (!state) {
      errors.push({ code: 'NULL_STATE', message: 'State is null or undefined' });
      return;
    }

    if (!state.players || !Array.isArray(state.players)) {
      errors.push({ code: 'INVALID_PLAYERS', message: 'Players array is missing or invalid' });
    } else if (state.players.length !== 2) {
      errors.push({ 
        code: 'PLAYER_COUNT', 
        message: `Expected 2 players, found ${state.players.length}`,
        context: { playerCount: state.players.length }
      });
    }

    if (!state.currentPlayer) {
      errors.push({ code: 'NO_CURRENT_PLAYER', message: 'Current player is not defined' });
    }

    if (typeof state.gridSize !== 'number' || state.gridSize < 2 || state.gridSize > 6) {
      errors.push({ 
        code: 'INVALID_GRID_SIZE', 
        message: `Grid size must be between 2 and 6, found ${state.gridSize}`,
        context: { gridSize: state.gridSize }
      });
    }

    if (!state.lines || !Array.isArray(state.lines)) {
      errors.push({ code: 'INVALID_LINES', message: 'Lines array is missing or invalid' });
    }

    if (!state.cubes || !Array.isArray(state.cubes)) {
      errors.push({ code: 'INVALID_CUBES', message: 'Cubes array is missing or invalid' });
    }

    if (typeof state.turn !== 'number' || state.turn < 0) {
      errors.push({ code: 'INVALID_TURN', message: 'Turn number is invalid' });
    }
  }

  private static validatePlayers(state: GameState, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!state.players) return;

    const playerIds = new Set<string>();
    
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      
      if (!player.id) {
        errors.push({ 
          code: 'PLAYER_NO_ID', 
          message: `Player ${i} has no ID`,
          context: { playerIndex: i }
        });
      } else if (playerIds.has(player.id)) {
        errors.push({ 
          code: 'DUPLICATE_PLAYER_ID', 
          message: `Duplicate player ID: ${player.id}`,
          context: { playerId: player.id }
        });
      } else {
        playerIds.add(player.id);
      }

      if (typeof player.score !== 'number' || player.score < 0) {
        errors.push({ 
          code: 'INVALID_PLAYER_SCORE', 
          message: `Player ${player.name} has invalid score: ${player.score}`,
          context: { player: player.name, score: player.score }
        });
      }

      if (typeof player.squareCount !== 'number' || player.squareCount < 0) {
        errors.push({ 
          code: 'INVALID_SQUARE_COUNT', 
          message: `Player ${player.name} has invalid square count: ${player.squareCount}`,
          context: { player: player.name, squareCount: player.squareCount }
        });
      }
    }

    // Validate current player exists
    if (state.currentPlayer && !playerIds.has(state.currentPlayer.id)) {
      errors.push({ 
        code: 'CURRENT_PLAYER_NOT_IN_GAME', 
        message: 'Current player is not one of the game players',
        context: { currentPlayerId: state.currentPlayer.id }
      });
    }

    // Validate winner if exists
    if (state.winner && !playerIds.has(state.winner.id)) {
      errors.push({ 
        code: 'WINNER_NOT_IN_GAME', 
        message: 'Winner is not one of the game players',
        context: { winnerId: state.winner.id }
      });
    }
  }

  private static validateLines(state: GameState, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!state.lines) return;

    const lineKeys = new Set<string>();
    
    for (const line of state.lines) {
      // Validate line structure
      if (!line.start || !line.end) {
        errors.push({ 
          code: 'INVALID_LINE_STRUCTURE', 
          message: 'Line missing start or end point',
          context: { line }
        });
        continue;
      }

      // Validate line is unit length
      const dx = Math.abs(line.end.x - line.start.x);
      const dy = Math.abs(line.end.y - line.start.y);
      const dz = Math.abs(line.end.z - line.start.z);
      const distance = dx + dy + dz;
      
      if (distance !== 1) {
        errors.push({ 
          code: 'INVALID_LINE_LENGTH', 
          message: `Line is not unit length: distance=${distance}`,
          context: { line, distance }
        });
      }

      // Check for duplicate lines
      const key = this.getLineKey(line);
      if (lineKeys.has(key)) {
        errors.push({ 
          code: 'DUPLICATE_LINE', 
          message: 'Duplicate line found',
          context: { line }
        });
      } else {
        lineKeys.add(key);
      }

      // Validate line bounds
      const maxCoord = state.gridSize - 1;
      if (line.start.x < 0 || line.start.x > maxCoord ||
          line.start.y < 0 || line.start.y > maxCoord ||
          line.start.z < 0 || line.start.z > maxCoord ||
          line.end.x < 0 || line.end.x > maxCoord ||
          line.end.y < 0 || line.end.y > maxCoord ||
          line.end.z < 0 || line.end.z > maxCoord) {
        errors.push({ 
          code: 'LINE_OUT_OF_BOUNDS', 
          message: 'Line coordinates out of grid bounds',
          context: { line, gridSize: state.gridSize }
        });
      }
    }
  }

  private static validateCubes(state: GameState, errors: ValidationError[], warnings: ValidationWarning[], options?: ValidationOptions): void {
    if (!state.cubes) return;

    const expectedCubeCount = Math.pow(state.gridSize - 1, 3);
    
    // Skip strict cube validation in partial sync mode
    if (!options?.allowPartialState) {
      // Only validate cube count if cubes array is not empty (allow partial state during sync)
      if (state.cubes.length > 0 && state.cubes.length !== expectedCubeCount) {
        errors.push({ 
          code: 'INCORRECT_CUBE_COUNT', 
          message: `Expected ${expectedCubeCount} cubes, found ${state.cubes.length}`,
          context: { expected: expectedCubeCount, actual: state.cubes.length }
        });
      }
    }

    for (const cube of state.cubes) {
      // Skip face count validation in partial sync mode
      if (!options?.allowPartialState) {
        // Validate cube has 6 faces
        if (!cube.faces || cube.faces.length !== 6) {
          errors.push({ 
            code: 'INVALID_CUBE_FACES', 
            message: `Cube at (${cube.position.x}, ${cube.position.y}, ${cube.position.z}) doesn't have 6 faces`,
            context: { cube }
          });
        }
      }

      // Validate face ownership consistency
      let ownedFaceCount = 0;
      const faceOwners = new Set<string>();
      
      for (const face of cube.faces) {
        if (face.player) {
          ownedFaceCount++;
          faceOwners.add(face.player.id);
        }
      }

      // If cube is claimed, validate ownership rules
      if (cube.owner) {
        if (ownedFaceCount < 4) {
          errors.push({ 
            code: 'INVALID_CUBE_OWNERSHIP', 
            message: `Cube claimed with only ${ownedFaceCount} faces owned`,
            context: { cube, ownedFaceCount }
          });
        }
        
        if (!faceOwners.has(cube.owner.id)) {
          errors.push({ 
            code: 'CUBE_OWNER_MISMATCH', 
            message: 'Cube owner doesn\'t own any faces',
            context: { cube }
          });
        }
      }
    }
  }

  private static validateScores(state: GameState, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!state.players || !state.cubes) return;
    
    // Skip score validation if cubes array is empty (partial state)
    if (state.cubes.length === 0) return;

    // Count actual scores
    const actualScores = new Map<string, number>();
    const actualSquares = new Map<string, number>();
    
    for (const player of state.players) {
      actualScores.set(player.id, 0);
      actualSquares.set(player.id, 0);
    }

    // Count cubes
    for (const cube of state.cubes) {
      if (cube.owner) {
        const current = actualScores.get(cube.owner.id) || 0;
        actualScores.set(cube.owner.id, current + 1);
      }
    }

    // Count unique squares
    const countedSquares = new Set<string>();
    for (const cube of state.cubes) {
      for (const face of cube.faces) {
        if (face && face.player) {
          const squareKey = this.getSquareKey(face);
          if (squareKey && !countedSquares.has(squareKey)) {
            countedSquares.add(squareKey);
            const current = actualSquares.get(face.player.id) || 0;
            actualSquares.set(face.player.id, current + 1);
          }
        }
      }
    }

    // Validate scores match
    for (const player of state.players) {
      const expectedScore = actualScores.get(player.id) || 0;
      if (player.score !== expectedScore) {
        errors.push({ 
          code: 'SCORE_MISMATCH', 
          message: `Player ${player.name} score mismatch: has ${player.score}, should be ${expectedScore}`,
          context: { player: player.name, actual: player.score, expected: expectedScore }
        });
      }

      const expectedSquares = actualSquares.get(player.id) || 0;
      if (player.squareCount !== expectedSquares) {
        warnings.push({ 
          code: 'SQUARE_COUNT_MISMATCH', 
          message: `Player ${player.name} square count mismatch: has ${player.squareCount}, should be ${expectedSquares}`,
          context: { player: player.name, actual: player.squareCount, expected: expectedSquares }
        });
      }
    }
  }

  private static validateGameFlow(state: GameState, errors: ValidationError[], warnings: ValidationWarning[]): void {
    // Turn number should match lines drawn (approximately)
    if (state.lines.length > state.turn + 1) {
      warnings.push({ 
        code: 'TURN_LINE_MISMATCH', 
        message: `Turn ${state.turn} but ${state.lines.length} lines drawn`,
        context: { turn: state.turn, lineCount: state.lines.length }
      });
    }

    // If game has winner, validate win conditions
    if (state.winner) {
      const totalCubes = state.cubes.length;
      const winnerCubes = state.cubes.filter(c => c.owner?.id === state.winner!.id).length;
      
      if (winnerCubes <= totalCubes / 2) {
        warnings.push({ 
          code: 'QUESTIONABLE_WIN', 
          message: `Winner has ${winnerCubes} of ${totalCubes} cubes (not majority)`,
          context: { winnerCubes, totalCubes }
        });
      }

      // Current player shouldn't change after game ends
      if (state.currentPlayer.id !== state.winner.id) {
        warnings.push({ 
          code: 'CURRENT_PLAYER_AFTER_WIN', 
          message: 'Current player is not the winner after game end',
          context: { currentPlayer: state.currentPlayer.id, winner: state.winner.id }
        });
      }
    }
  }

  private static validateInvariants(state: GameState, errors: ValidationError[], warnings: ValidationWarning[]): void {
    // Invariant 1: Total cubes = (gridSize - 1)³
    const expectedCubes = Math.pow(state.gridSize - 1, 3);
    const totalCubes = state.cubes.length;
    
    // Only validate if cubes array is populated (allow partial state during sync)
    if (totalCubes > 0 && totalCubes !== expectedCubes) {
      errors.push({ 
        code: 'CUBE_COUNT_INVARIANT', 
        message: `Cube count invariant violated: expected ${expectedCubes}, got ${totalCubes}`,
        context: { expected: expectedCubes, actual: totalCubes }
      });
    }

    // Invariant 2: Sum of player scores <= total cubes
    // Only check if cubes are populated
    if (totalCubes > 0) {
      const totalScore = state.players.reduce((sum, p) => sum + p.score, 0);
      if (totalScore > totalCubes) {
        errors.push({ 
          code: 'SCORE_INVARIANT', 
          message: `Score invariant violated: total score ${totalScore} > total cubes ${totalCubes}`,
          context: { totalScore, totalCubes }
        });
      }
    }

    // Invariant 3: Each face can only belong to one cube
    // (This is implicitly validated by the unique square counting)

    // Invariant 4: Lines should be within grid bounds
    const maxLines = 3 * state.gridSize * Math.pow(state.gridSize - 1, 2);
    if (state.lines.length > maxLines) {
      errors.push({ 
        code: 'TOO_MANY_LINES', 
        message: `Too many lines: ${state.lines.length} > maximum ${maxLines}`,
        context: { lineCount: state.lines.length, maxLines }
      });
    }
  }

  private static validateTransitionLegality(
    beforeState: GameState,
    afterState: GameState,
    action: { type: string; payload?: any } | undefined,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Turn should increment or stay the same
    if (afterState.turn < beforeState.turn) {
      errors.push({ 
        code: 'TURN_WENT_BACKWARD', 
        message: `Turn went backward from ${beforeState.turn} to ${afterState.turn}`,
        context: { before: beforeState.turn, after: afterState.turn }
      });
    }

    // Lines can only be added, never removed
    if (afterState.lines.length < beforeState.lines.length) {
      errors.push({ 
        code: 'LINES_REMOVED', 
        message: 'Lines were removed from the game',
        context: { before: beforeState.lines.length, after: afterState.lines.length }
      });
    }

    // Scores should never decrease
    for (let i = 0; i < afterState.players.length; i++) {
      const before = beforeState.players[i];
      const after = afterState.players[i];
      
      if (after.score < before.score) {
        errors.push({ 
          code: 'SCORE_DECREASED', 
          message: `Player ${after.name} score decreased from ${before.score} to ${after.score}`,
          context: { player: after.name, before: before.score, after: after.score }
        });
      }
      
      if (after.squareCount < before.squareCount) {
        warnings.push({ 
          code: 'SQUARE_COUNT_DECREASED', 
          message: `Player ${after.name} square count decreased`,
          context: { player: after.name, before: before.squareCount, after: after.squareCount }
        });
      }
    }

    // Once game has winner, it shouldn't change
    if (beforeState.winner && !afterState.winner) {
      errors.push({ 
        code: 'WINNER_REMOVED', 
        message: 'Winner was removed from finished game'
      });
    }
    
    if (beforeState.winner && afterState.winner && beforeState.winner.id !== afterState.winner.id) {
      errors.push({ 
        code: 'WINNER_CHANGED', 
        message: 'Winner changed after game ended',
        context: { before: beforeState.winner.id, after: afterState.winner.id }
      });
    }
  }

  private static getLineKey(line: Line): string {
    const p1 = `${line.start.x},${line.start.y},${line.start.z}`;
    const p2 = `${line.end.x},${line.end.y},${line.end.z}`;
    return p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
  }

  private static getSquareKey(square: Square): string {
    // Create a unique key based on the square's corner coordinates
    // This ensures each unique face is counted only once
    if (!square || !square.lines) return '';
    
    const corners = square.lines
      .flatMap(line => [line.start, line.end])
      .map(p => `${p.x},${p.y},${p.z}`)
      .sort()
      .join('|');
    return corners;
  }
}