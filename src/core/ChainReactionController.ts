import { GameEngine } from './GameEngine';
import { GameState, Point3D, Line, Player } from './types';
import { getCompletedSquares, getValidMoves, applyMove } from '../domain/GameRules';

export interface ChainMoveSelectionStrategy {
  selectMove(availableMoves: Line[]): Line | null;
}

export interface ChainEvent {
  move: Line;
  player: Player;
  isAutomated: boolean;
  timestamp: number;
}

export interface ChainCompleteEvent {
  totalMoves: number;
  player: Player;
  squaresCompleted: number;
  timestamp: number;
}

/**
 * Handles automated chain reactions when a player completes squares
 * Allows the computer to take over and make additional moves automatically
 */
export class ChainReactionController {
  private gameEngine: GameEngine;
  private isActive: boolean = false;
  private chainEvents: ChainEvent[] = [];
  private selectionStrategy: ChainMoveSelectionStrategy;
  private chainMoveListeners: Array<(event: ChainEvent) => void> = [];
  private chainCompleteListeners: Array<(event: ChainCompleteEvent) => void> = [];

  constructor(gameEngine: GameEngine) {
    this.gameEngine = gameEngine;
    this.selectionStrategy = new RandomSelectionStrategy();
  }

  /**
   * Check if there are chain reaction opportunities after a move
   */
  hasChainOpportunity(start: Point3D, end: Point3D): boolean {
    const state = this.gameEngine.getState();
    
    // If autoplay is disabled, no chain opportunities
    if (!state.autoplayChainReactions) {
      return false;
    }

    // Check if this specific move would complete a square
    return this.wouldMoveCompleteSquare(state, start, end);
  }

  /**
   * Find all available chain reaction moves
   */
  findChainOpportunities(): Line[] {
    const state = this.gameEngine.getState();
    
    // If autoplay is disabled, return empty array
    if (!state.autoplayChainReactions) {
      return [];
    }

    // Get all valid moves
    const validMoves = getValidMoves(state);
    const chainMoves: Line[] = [];

    // Check each valid move to see if it completes a square
    for (const move of validMoves) {
      if (this.wouldMoveCompleteSquare(state, move.start, move.end)) {
        chainMoves.push(move);
      }
    }

    return chainMoves;
  }

  /**
   * Select the next move in a chain reaction
   */
  selectNextChainMove(): Line | null {
    const opportunities = this.findChainOpportunities();
    
    if (opportunities.length === 0) {
      return null;
    }

    return this.selectionStrategy.selectMove(opportunities);
  }

  /**
   * Set a custom strategy for selecting chain moves
   */
  setSelectionStrategy(strategy: ChainMoveSelectionStrategy): void {
    this.selectionStrategy = strategy;
  }

  /**
   * Execute a complete chain reaction sequence
   */
  async executeChainReaction(): Promise<boolean> {
    const initialState = this.gameEngine.getState();
    
    if (!initialState.autoplayChainReactions) {
      return false;
    }

    this.isActive = true;
    this.chainEvents = [];
    
    // Capture the player who started the chain
    const chainPlayer = initialState.currentPlayer;
    
    let chainContinues = true;
    let movesExecuted = 0;
    
    while (chainContinues && movesExecuted < 100) { // Safety limit
      const nextMove = this.selectNextChainMove();
      
      if (!nextMove) {
        chainContinues = false;
        break;
      }

      // Get fresh state for validation
      const currentState = this.gameEngine.getState();
      
      // Validate the move before attempting it
      if (!this.gameEngine.isValidMove(nextMove.start, nextMove.end)) {
        chainContinues = false;
        break;
      }

      // Execute the automated move
      let success = false;
      try {
        success = this.gameEngine.makeMove(nextMove.start, nextMove.end);
        
        if (!success) {
          chainContinues = false;
        }
      } catch (error) {
        // If we get an error (like duplicate line), gracefully end the chain
        chainContinues = false;
      }
      
      if (success) {
        const chainEvent: ChainEvent = {
          move: nextMove,
          player: chainPlayer, // Use the original chain player
          isAutomated: true,
          timestamp: Date.now()
        };
        
        this.chainEvents.push(chainEvent);
        this.notifyChainMove(chainEvent);
        movesExecuted++;
      } else {
        chainContinues = false;
      }
    }

    this.isActive = false;
    
    // Get final state after chain completion
    const finalState = this.gameEngine.getState();
    
    // If we executed moves but the chain ended (no more opportunities),
    // and this isn't a winning game state, determine if turns should switch
    if (movesExecuted > 0 && !finalState.winner) {
      // Check if there are any more chain opportunities
      const remainingOpportunities = this.findChainOpportunities();
      if (remainingOpportunities.length === 0) {
        // Only switch turns if exactly one move was executed (single square completion)
        // If multiple moves were executed, the player earned their continued turn
        if (movesExecuted === 1) {
          this.gameEngine.forceTurnSwitch();
        }
      }
    }
    
    // Notify completion
    const completeEvent: ChainCompleteEvent = {
      totalMoves: movesExecuted,
      player: chainPlayer, // Use the original chain player
      squaresCompleted: movesExecuted, // Simplified - each move completes a square
      timestamp: Date.now()
    };
    
    this.notifyChainComplete(completeEvent);
    
    return movesExecuted > 0;
  }

  /**
   * Check if a chain reaction is currently active
   */
  isChainActive(): boolean {
    return this.isActive;
  }

  /**
   * Get all events from the last chain reaction
   */
  getChainEvents(): ChainEvent[] {
    return [...this.chainEvents];
  }

  /**
   * Check if the game is in online mode
   */
  isOnlineMode(): boolean {
    return this.gameEngine.getState().gameMode === 'online';
  }

  /**
   * Register a listener for chain move events
   */
  onChainMove(listener: (event: ChainEvent) => void): void {
    this.chainMoveListeners.push(listener);
  }

  /**
   * Register a listener for chain completion events
   */
  onChainComplete(listener: (event: ChainCompleteEvent) => void): void {
    this.chainCompleteListeners.push(listener);
  }

  private notifyChainMove(event: ChainEvent): void {
    this.chainMoveListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in chain move listener:', error);
      }
    });
  }

  private notifyChainComplete(event: ChainCompleteEvent): void {
    this.chainCompleteListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in chain complete listener:', error);
      }
    });
  }

  /**
   * Check if a move would complete a square using simplified 2D logic
   * This is a working implementation for basic chain detection
   */
  private wouldMoveCompleteSquare(state: GameState, start: Point3D, end: Point3D): boolean {
    // Generate possible squares that would include this line
    const possibleSquares = this.getPossibleSquaresForLine(start, end);
    
    // Check if any of these squares would be completed by adding this line
    for (const square of possibleSquares) {
      if (this.wouldSquareBeComplete(state, square, start, end)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get possible squares that could include the given line
   */
  private getPossibleSquaresForLine(start: Point3D, end: Point3D): Point3D[][] {
    const squares: Point3D[][] = [];
    
    // Determine direction of line
    const dx = end.x - start.x;
    const dy = end.y - start.y;  
    const dz = end.z - start.z;
    
    // Handle squares in XY plane (same Z)
    if (dz === 0) {
      if (dx !== 0) {
        // Horizontal line in X direction, can form squares above and below in Y
        squares.push([
          start,
          end, 
          { x: end.x, y: end.y + 1, z: end.z },
          { x: start.x, y: start.y + 1, z: start.z }
        ]);
        squares.push([
          start,
          end,
          { x: end.x, y: end.y - 1, z: end.z },
          { x: start.x, y: start.y - 1, z: start.z }
        ]);
      } else if (dy !== 0) {
        // Vertical line in Y direction, can form squares left and right in X
        squares.push([
          start,
          end,
          { x: end.x + 1, y: end.y, z: end.z },
          { x: start.x + 1, y: start.y, z: start.z }
        ]);
        squares.push([
          start,
          end,
          { x: end.x - 1, y: end.y, z: end.z },
          { x: start.x - 1, y: start.y, z: start.z }
        ]);
      }
    }
    
    // Handle squares in XZ plane (same Y) 
    if (dy === 0) {
      if (dx !== 0) {
        // Horizontal line in X direction, can form squares forward and backward in Z
        squares.push([
          start,
          end,
          { x: end.x, y: end.y, z: end.z + 1 },
          { x: start.x, y: start.y, z: start.z + 1 }
        ]);
        squares.push([
          start,
          end,
          { x: end.x, y: end.y, z: end.z - 1 },
          { x: start.x, y: start.y, z: start.z - 1 }
        ]);
      } else if (dz !== 0) {
        // Line in Z direction, can form squares left and right in X
        squares.push([
          start,
          end,
          { x: end.x + 1, y: end.y, z: end.z },
          { x: start.x + 1, y: start.y, z: start.z }
        ]);
        squares.push([
          start,
          end,
          { x: end.x - 1, y: end.y, z: end.z },
          { x: start.x - 1, y: start.y, z: start.z }
        ]);
      }
    }
    
    // Handle squares in YZ plane (same X)
    if (dx === 0) {
      if (dy !== 0) {
        // Line in Y direction, can form squares forward and backward in Z
        squares.push([
          start,
          end,
          { x: end.x, y: end.y, z: end.z + 1 },
          { x: start.x, y: start.y, z: start.z + 1 }
        ]);
        squares.push([
          start,
          end,
          { x: end.x, y: end.y, z: end.z - 1 },
          { x: start.x, y: start.y, z: start.z - 1 }
        ]);
      } else if (dz !== 0) {
        // Line in Z direction, can form squares up and down in Y
        squares.push([
          start,
          end,
          { x: end.x, y: end.y + 1, z: end.z },
          { x: start.x, y: start.y + 1, z: start.z }
        ]);
        squares.push([
          start,
          end,
          { x: end.x, y: end.y - 1, z: end.z },
          { x: start.x, y: start.y - 1, z: start.z }
        ]);
      }
    }
    
    return squares;
  }

  /**
   * Check if a square would be complete after adding the new line
   */
  private wouldSquareBeComplete(state: GameState, square: Point3D[], newStart: Point3D, newEnd: Point3D): boolean {
    // Get the 4 edges of the square
    const edges = [
      [square[0], square[1]],
      [square[1], square[2]], 
      [square[2], square[3]],
      [square[3], square[0]]
    ];
    
    // Check if all edges exist (including the new line we're about to add)
    let edgesFound = 0;
    
    for (const [edgeStart, edgeEnd] of edges) {
      // Check if this edge is the new line we're adding
      if ((this.isSamePoint(edgeStart, newStart) && this.isSamePoint(edgeEnd, newEnd)) ||
          (this.isSamePoint(edgeStart, newEnd) && this.isSamePoint(edgeEnd, newStart))) {
        edgesFound++;
        continue;
      }
      
      // Check if this edge already exists in the state
      if (state.lines.some(line =>
          (this.isSamePoint(line.start, edgeStart) && this.isSamePoint(line.end, edgeEnd)) ||
          (this.isSamePoint(line.start, edgeEnd) && this.isSamePoint(line.end, edgeStart))
      )) {
        edgesFound++;
      }
    }
    
    return edgesFound === 4;
  }

  private isSamePoint(p1: Point3D, p2: Point3D): boolean {
    return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z;
  }
}

/**
 * Default random selection strategy
 */
class RandomSelectionStrategy implements ChainMoveSelectionStrategy {
  selectMove(availableMoves: Line[]): Line | null {
    if (availableMoves.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * availableMoves.length);
    return availableMoves[randomIndex];
  }
}