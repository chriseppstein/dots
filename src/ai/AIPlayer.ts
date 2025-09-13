import { GameEngine } from '../core/GameEngine';
import { Line, Point3D } from '../core/types';

interface MoveScore {
  line: Line;
  score: number;
}

export class AIPlayer {
  private engine: GameEngine;
  private drawnLinesSet: Set<string> = new Set();
  
  constructor(engine: GameEngine) {
    this.engine = engine;
  }
  
  public getNextMove(): Line | null {
    // Build a set of drawn lines for O(1) lookups
    this.drawnLinesSet.clear();
    const state = this.engine.getState();
    for (const line of state.lines) {
      this.drawnLinesSet.add(this.getLineKey(line));
    }
    
    const possibleMoves = this.engine.getPossibleMoves();
    
    if (possibleMoves.length === 0) return null;
    
    // For very few moves, just evaluate them all
    if (possibleMoves.length <= 10) {
      const scoredMoves: MoveScore[] = possibleMoves.map(line => ({
        line,
        score: this.evaluateMove(line)
      }));
      
      scoredMoves.sort((a, b) => b.score - a.score);
      
      const bestScore = scoredMoves[0].score;
      const bestMoves = scoredMoves.filter(m => m.score === bestScore);
      
      const randomIndex = Math.floor(Math.random() * bestMoves.length);
      return bestMoves[randomIndex].line;
    }
    
    // For many moves, use early exits to avoid evaluating everything
    
    // Early exit: if we can complete a cube immediately, do it
    for (const line of possibleMoves) {
      const cubesCompletable = this.countCubesCompletableByLine(line);
      if (cubesCompletable > 0) {
        return line; // Take the cube immediately
      }
    }
    
    // Early exit: if we can complete multiple squares, prioritize that
    let maxSquares = 0;
    let bestSquareMove: Line | null = null;
    for (const line of possibleMoves) {
      const squaresCompletable = this.countSquaresCompletableByLine(line);
      if (squaresCompletable > maxSquares) {
        maxSquares = squaresCompletable;
        bestSquareMove = line;
        if (squaresCompletable >= 2) {
          return line; // Take multiple squares immediately
        }
      }
    }
    
    // If we can complete at least one square, do it
    if (bestSquareMove && maxSquares > 0) {
      return bestSquareMove;
    }
    
    // Otherwise, evaluate all moves more carefully
    const scoredMoves: MoveScore[] = possibleMoves.map(line => ({
      line,
      score: this.evaluateMove(line)
    }));
    
    scoredMoves.sort((a, b) => b.score - a.score);
    
    const bestScore = scoredMoves[0].score;
    const bestMoves = scoredMoves.filter(m => m.score === bestScore);
    
    const randomIndex = Math.floor(Math.random() * bestMoves.length);
    return bestMoves[randomIndex].line;
  }
  
  private evaluateMove(line: Line): number {
    let score = 0;
    
    const squaresCompletable = this.countSquaresCompletableByLine(line);
    score += squaresCompletable * 100;
    
    const blocksOpponent = this.checkIfBlocksOpponent(line);
    if (blocksOpponent > 0) {
      score += blocksOpponent * 50;
    }
    
    const cubesCompletable = this.countCubesCompletableByLine(line);
    score += cubesCompletable * 200;
    
    const givesAwaySquares = this.checkIfGivesAwaySquares(line);
    score -= givesAwaySquares * 75;
    
    score += Math.random() * 10;
    
    return score;
  }
  
  private countSquaresCompletableByLine(line: Line): number {
    let count = 0;
    const state = this.engine.getState();
    
    for (const cube of state.cubes) {
      for (const face of cube.faces) {
        if (!face.player && this.isLineInSquare(line, face)) {
          const drawnLines = face.lines.filter(l => this.isLineDrawn(l)).length;
          if (drawnLines === 3) {
            count++;
          }
        }
      }
    }
    
    return count;
  }
  
  private checkIfBlocksOpponent(line: Line): number {
    let blocked = 0;
    const state = this.engine.getState();
    
    for (const cube of state.cubes) {
      for (const face of cube.faces) {
        if (!face.player && this.isLineInSquare(line, face)) {
          const drawnLines = face.lines.filter(l => this.isLineDrawn(l)).length;
          if (drawnLines === 2) {
            const undrawnLines = face.lines.filter(l => !this.isLineDrawn(l));
            if (undrawnLines.length === 2) {
              blocked++;
            }
          }
        }
      }
    }
    
    return blocked;
  }
  
  private countCubesCompletableByLine(line: Line): number {
    let count = 0;
    const state = this.engine.getState();
    const currentPlayer = state.currentPlayer;
    
    for (const cube of state.cubes) {
      if (!cube.owner) {
        let playerFaces = 0;
        let willComplete = false;
        
        for (const face of cube.faces) {
          if (face.player?.id === currentPlayer.id) {
            playerFaces++;
          } else if (!face.player && this.isLineInSquare(line, face)) {
            const drawnLines = face.lines.filter(l => this.isLineDrawn(l)).length;
            if (drawnLines === 3) {
              willComplete = true;
            }
          }
        }
        
        if (willComplete && playerFaces === 3) {
          count++;
        }
      }
    }
    
    return count;
  }
  
  private checkIfGivesAwaySquares(line: Line): number {
    let giveaways = 0;
    const state = this.engine.getState();
    
    for (const cube of state.cubes) {
      for (const face of cube.faces) {
        if (!face.player && this.isLineInSquare(line, face)) {
          const drawnLines = face.lines.filter(l => this.isLineDrawn(l)).length;
          if (drawnLines === 1) {
            const adjacentFaces = this.getAdjacentSquares(face, cube);
            for (const adjFace of adjacentFaces) {
              if (!adjFace.player) {
                const adjDrawnLines = adjFace.lines.filter((_l: any) => this.isLineDrawn(_l)).length;
                if (adjDrawnLines === 2) {
                  giveaways++;
                }
              }
            }
          }
        }
      }
    }
    
    return giveaways;
  }
  
  private getAdjacentSquares(square: any, cube: any): any[] {
    const adjacent: any[] = [];
    const state = this.engine.getState();
    
    // Only check adjacent cubes, not all cubes
    for (const otherCube of state.cubes) {
      if (otherCube === cube) continue;
      
      // Quick distance check - adjacent cubes must be close
      const dx = Math.abs(otherCube.position.x - cube.position.x);
      const dy = Math.abs(otherCube.position.y - cube.position.y);
      const dz = Math.abs(otherCube.position.z - cube.position.z);
      
      // Adjacent cubes are at most 1 unit away in one dimension, 0 in others
      const distance = dx + dy + dz;
      if (distance > 1) continue;
      
      for (const face of otherCube.faces) {
        if (this.sharesEdge(square, face)) {
          adjacent.push(face);
        }
      }
    }
    
    return adjacent;
  }
  
  private sharesEdge(square1: any, square2: any): boolean {
    for (const line1 of square1.lines) {
      for (const line2 of square2.lines) {
        if (this.linesEqual(line1, line2)) {
          return true;
        }
      }
    }
    return false;
  }
  
  private linesEqual(line1: Line, line2: Line): boolean {
    return (this.pointsEqual(line1.start, line2.start) && this.pointsEqual(line1.end, line2.end)) ||
           (this.pointsEqual(line1.start, line2.end) && this.pointsEqual(line1.end, line2.start));
  }
  
  private pointsEqual(p1: Point3D, p2: Point3D): boolean {
    return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z;
  }
  
  private isLineInSquare(line: Line, square: any): boolean {
    return square.lines.some((squareLine: Line) => 
      this.linesEqual(line, squareLine)
    );
  }
  
  private isLineDrawn(line: Line): boolean {
    // O(1) lookup using the pre-built set
    const key = this.getLineKey(line);
    return this.drawnLinesSet.has(key);
  }
  
  private getLineKey(line: Line): string {
    // Create a normalized key for the line (handles both directions)
    const p1 = `${line.start.x},${line.start.y},${line.start.z}`;
    const p2 = `${line.end.x},${line.end.y},${line.end.z}`;
    return p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
  }
}