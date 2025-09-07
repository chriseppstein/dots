export type GridSize = 3 | 4 | 5 | 6;

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Line {
  start: Point3D;
  end: Point3D;
  player: Player | null;
}

export interface Square {
  corners: Point3D[];
  lines: Line[];
  player: Player | null;
}

export interface Cube {
  position: Point3D;
  faces: Square[];
  owner: Player | null;
  claimedFaces: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
  squareCount: number;
  isAI?: boolean;
}

export type GameMode = 'local' | 'online' | 'ai';

export interface GameState {
  gridSize: GridSize;
  currentPlayer: Player;
  players: Player[];
  lines: Line[];
  cubes: Cube[];
  gameMode: GameMode;
  winner: Player | null;
  turn: number;
}

export interface GameMove {
  line: Line;
  player: Player;
  timestamp: number;
}