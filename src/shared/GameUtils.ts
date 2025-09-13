/**
 * Shared Game Utilities
 * 
 * Common utility functions to eliminate code duplication
 * across the codebase. All functions are pure with no side effects.
 */

import { Point3D, Line, Square, Cube, GridSize } from '../core/types';

/**
 * Checks if two points are equal
 */
export function pointsEqual(p1: Point3D, p2: Point3D): boolean {
  return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z;
}

/**
 * Checks if a point is within grid bounds
 */
export function isValidPoint(point: Point3D, gridSize: GridSize): boolean {
  return point.x >= 0 && point.x < gridSize &&
         point.y >= 0 && point.y < gridSize &&
         point.z >= 0 && point.z < gridSize;
}

/**
 * Checks if two points are adjacent (differ by 1 in exactly one dimension)
 */
export function arePointsAdjacent(p1: Point3D, p2: Point3D): boolean {
  const dx = Math.abs(p1.x - p2.x);
  const dy = Math.abs(p1.y - p2.y);
  const dz = Math.abs(p1.z - p2.z);
  
  return (dx === 1 && dy === 0 && dz === 0) ||
         (dx === 0 && dy === 1 && dz === 0) ||
         (dx === 0 && dy === 0 && dz === 1);
}

/**
 * Checks if a line exists in the collection (considers both directions)
 */
export function lineExists(lines: Line[], start: Point3D, end: Point3D): boolean {
  return lines.some(line => 
    (pointsEqual(line.start, start) && pointsEqual(line.end, end)) ||
    (pointsEqual(line.start, end) && pointsEqual(line.end, start))
  );
}

/**
 * Checks if two lines are equal (considers both directions)
 */
export function linesEqual(line1: Line, line2: Line): boolean {
  return (pointsEqual(line1.start, line2.start) && pointsEqual(line1.end, line2.end)) ||
         (pointsEqual(line1.start, line2.end) && pointsEqual(line1.end, line2.start));
}

/**
 * Creates a unique key for a line (direction-agnostic)
 */
export function getLineKey(start: Point3D, end: Point3D): string {
  // Sort points to ensure consistent key regardless of direction
  const points = [start, end].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    if (a.y !== b.y) return a.y - b.y;
    return a.z - b.z;
  });
  
  return `${points[0].x},${points[0].y},${points[0].z}-${points[1].x},${points[1].y},${points[1].z}`;
}

/**
 * Creates a unique key for a square based on its corners
 */
export function getSquareKey(square: Square): string {
  // Sort corners to ensure consistent key
  const corners = square.corners
    .map(c => `${c.x},${c.y},${c.z}`)
    .sort();
  
  return corners.join('|');
}

/**
 * Creates a unique key for a cube based on its position
 */
export function getCubeKey(position: Point3D): string {
  return `${position.x},${position.y},${position.z}`;
}

/**
 * Calculates the distance between two points
 */
export function pointDistance(p1: Point3D, p2: Point3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Gets the midpoint between two points
 */
export function getMidpoint(p1: Point3D, p2: Point3D): Point3D {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2
  };
}

/**
 * Gets all adjacent points to a given point within grid bounds
 */
export function getAdjacentPoints(point: Point3D, gridSize: GridSize): Point3D[] {
  const adjacent: Point3D[] = [];
  const directions = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 }
  ];
  
  for (const dir of directions) {
    const newPoint = {
      x: point.x + dir.x,
      y: point.y + dir.y,
      z: point.z + dir.z
    };
    
    if (isValidPoint(newPoint, gridSize)) {
      adjacent.push(newPoint);
    }
  }
  
  return adjacent;
}

/**
 * Determines the orientation of a line (x, y, or z axis)
 */
export function getLineOrientation(start: Point3D, end: Point3D): 'x' | 'y' | 'z' | null {
  const dx = Math.abs(start.x - end.x);
  const dy = Math.abs(start.y - end.y);
  const dz = Math.abs(start.z - end.z);
  
  if (dx === 1 && dy === 0 && dz === 0) return 'x';
  if (dx === 0 && dy === 1 && dz === 0) return 'y';
  if (dx === 0 && dy === 0 && dz === 1) return 'z';
  
  return null; // Not a valid line
}

/**
 * Gets the six faces of a cube at the given position
 */
export function getCubeFaces(position: Point3D): Square[] {
  const { x, y, z } = position;
  
  return [
    // Front face (z)
    {
      corners: [
        { x, y, z },
        { x: x + 1, y, z },
        { x: x + 1, y: y + 1, z },
        { x, y: y + 1, z }
      ],
      player: null as any, // Will be set by caller
      lines: []
    },
    // Back face (z+1)
    {
      corners: [
        { x, y, z: z + 1 },
        { x: x + 1, y, z: z + 1 },
        { x: x + 1, y: y + 1, z: z + 1 },
        { x, y: y + 1, z: z + 1 }
      ],
      player: null as any,
      lines: []
    },
    // Left face (x)
    {
      corners: [
        { x, y, z },
        { x, y: y + 1, z },
        { x, y: y + 1, z: z + 1 },
        { x, y, z: z + 1 }
      ],
      player: null as any,
      lines: []
    },
    // Right face (x+1)
    {
      corners: [
        { x: x + 1, y, z },
        { x: x + 1, y: y + 1, z },
        { x: x + 1, y: y + 1, z: z + 1 },
        { x: x + 1, y, z: z + 1 }
      ],
      player: null as any,
      lines: []
    },
    // Bottom face (y)
    {
      corners: [
        { x, y, z },
        { x: x + 1, y, z },
        { x: x + 1, y, z: z + 1 },
        { x, y, z: z + 1 }
      ],
      player: null as any,
      lines: []
    },
    // Top face (y+1)
    {
      corners: [
        { x, y: y + 1, z },
        { x: x + 1, y: y + 1, z },
        { x: x + 1, y: y + 1, z: z + 1 },
        { x, y: y + 1, z: z + 1 }
      ],
      player: null as any,
      lines: []
    }
  ];
}

/**
 * Checks if a square is complete (all four edges exist)
 */
export function isSquareComplete(square: Square, lines: Line[]): boolean {
  const corners = square.corners;
  
  // A square needs 4 edges
  const edges = [
    { start: corners[0], end: corners[1] },
    { start: corners[1], end: corners[2] },
    { start: corners[2], end: corners[3] },
    { start: corners[3], end: corners[0] }
  ];
  
  return edges.every(edge => lineExists(lines, edge.start, edge.end));
}

/**
 * Gets all possible lines in a grid
 */
export function getAllPossibleLines(gridSize: GridSize): Line[] {
  const lines: Line[] = [];
  
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        const point = { x, y, z };
        
        // Add lines in each direction (avoiding duplicates)
        if (x < gridSize - 1) {
          lines.push({
            start: point,
            end: { x: x + 1, y, z },
            player: null as any
          });
        }
        
        if (y < gridSize - 1) {
          lines.push({
            start: point,
            end: { x, y: y + 1, z },
            player: null as any
          });
        }
        
        if (z < gridSize - 1) {
          lines.push({
            start: point,
            end: { x, y, z: z + 1 },
            player: null as any
          });
        }
      }
    }
  }
  
  return lines;
}

/**
 * Counts the total number of possible cubes in a grid
 */
export function getTotalPossibleCubes(gridSize: GridSize): number {
  return Math.pow(gridSize - 1, 3);
}

/**
 * Counts the total number of possible lines in a grid
 */
export function getTotalPossibleLines(gridSize: GridSize): number {
  // Lines along x-axis: gridSize * gridSize * (gridSize - 1)
  // Lines along y-axis: gridSize * (gridSize - 1) * gridSize
  // Lines along z-axis: (gridSize - 1) * gridSize * gridSize
  return 3 * gridSize * gridSize * (gridSize - 1);
}

/**
 * Deep clones an object (simple implementation)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Throttles a function call
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeout: number | null = null;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall >= delay) {
      func(...args);
      lastCall = now;
    } else if (!timeout) {
      timeout = window.setTimeout(() => {
        func(...args);
        lastCall = Date.now();
        timeout = null;
      }, delay - (now - lastCall));
    }
  };
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      window.clearTimeout(timeout);
    }
    
    timeout = window.setTimeout(() => {
      func(...args);
      timeout = null;
    }, delay);
  };
}