import { GameEngine } from '../core/GameEngine';
import { Line, Point3D } from '../core/types';

interface MoveScore {
  line: Line;
  score: number;
}

export class AIPlayer {
  private engine: GameEngine;
  
  constructor(engine: GameEngine) {
    this.engine = engine;
  }
  
  public getNextMove(): Line | null {
    const possibleMoves = this.engine.getPossibleMoves();
    
    if (possibleMoves.length === 0) return null;
    
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
    const state = this.engine.getState();
    
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
                const adjDrawnLines = adjFace.lines.filter(l => this.isLineDrawn(l)).length;
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
    
    for (const otherCube of state.cubes) {
      if (otherCube === cube) continue;
      
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
    const state = this.engine.getState();
    return state.lines.some(drawnLine => 
      this.linesEqual(line, drawnLine)
    );
  }
}