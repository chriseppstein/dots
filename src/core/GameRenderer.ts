import * as THREE from 'three';
import { GridSize, Point3D, Line, GameState } from './types';
import { ResourceManager } from './ResourceManager';

interface LineConsequence {
  type: 'safe' | 'completes-square' | 'chain-reaction' | 'dangerous-third-line';
  squareCount: number;
  chainReaction: boolean;
}

export class GameRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private dots: THREE.Mesh[][][] = [];
  private drawnLines: Map<string, THREE.Mesh> = new Map();
  private previewLine: THREE.Mesh | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private container: HTMLElement;
  private gridGroup: THREE.Group;
  private gridSize: GridSize;
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private completedSquares: THREE.Mesh[] = [];
  private cubeSpheres: THREE.Mesh[] = [];
  private squareOpacity = 0.5; // Configurable opacity for squares
  private lastState: GameState | null = null;
  private currentPlayerId: string | null = null;
  private isPlayerTurn: boolean = false;
  
  // Tracking for differential updates
  private renderedSquareKeys: Set<string> = new Set();
  private renderedSphereKeys: Set<string> = new Set();
  
  // Store bound event listeners for proper cleanup
  private boundOnMouseMove: (event: MouseEvent) => void;
  private boundOnMouseDown: (event: MouseEvent) => void;
  private boundOnMouseUp: (event: MouseEvent) => void;
  
  // Resource management
  private resourceManager = new ResourceManager();
  private animationId?: number;
  private isDisposed = false;
  private boundOnWheel: (event: WheelEvent) => void;
  private boundOnContextMenu: (event: MouseEvent) => void;
  private boundOnWindowResize: () => void;
  
  // Performance optimization: pre-computed lines for hover detection
  private possibleLines: Line[] = [];

  constructor(container: HTMLElement, gridSize: GridSize = 4) {
    this.container = container;
    this.gridSize = gridSize;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.gridGroup = new THREE.Group();
    this.scene.add(this.gridGroup);
    
    // Bind event handlers once to allow proper removal
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnContextMenu = (e: MouseEvent) => e.preventDefault();
    this.boundOnWindowResize = this.onWindowResize.bind(this);
    
    this.setupLights();
    this.setupCamera();
    this.setupEventListeners();
    this.createGrid();
    this.animate();
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    this.scene.add(directionalLight);
  }

  private setupCamera(): void {
    const distance = this.gridSize * 3;
    this.camera.position.set(distance, distance, distance);
    this.camera.lookAt(this.gridGroup.position);
  }

  private setupEventListeners(): void {
    this.renderer.domElement.addEventListener('mousemove', this.boundOnMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.boundOnMouseDown);
    this.renderer.domElement.addEventListener('mouseup', this.boundOnMouseUp);
    this.renderer.domElement.addEventListener('wheel', this.boundOnWheel);
    this.renderer.domElement.addEventListener('contextmenu', this.boundOnContextMenu);
    window.addEventListener('resize', this.boundOnWindowResize);
  }

  private createGrid(): void {
    const dotGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const dotMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    
    const offset = (this.gridSize - 1) / 2;
    
    // Pre-compute all possible lines for hover detection optimization
    this.possibleLines = [];
    
    for (let x = 0; x < this.gridSize; x++) {
      this.dots[x] = [];
      for (let y = 0; y < this.gridSize; y++) {
        this.dots[x][y] = [];
        for (let z = 0; z < this.gridSize; z++) {
          const dot = new THREE.Mesh(dotGeometry, dotMaterial);
          dot.position.set(x - offset, y - offset, z - offset);
          dot.userData = { x, y, z };
          this.gridGroup.add(dot);
          this.dots[x][y][z] = dot;
          
          // Pre-compute possible lines from this point
          const point = { x, y, z };
          
          // Horizontal line (x direction)
          if (x < this.gridSize - 1) {
            this.possibleLines.push({
              start: point,
              end: { x: x + 1, y, z },
              player: null
            });
          }
          
          // Vertical line (y direction)
          if (y < this.gridSize - 1) {
            this.possibleLines.push({
              start: point,
              end: { x, y: y + 1, z },
              player: null
            });
          }
          
          // Depth line (z direction)
          if (z < this.gridSize - 1) {
            this.possibleLines.push({
              start: point,
              end: { x, y, z: z + 1 },
              player: null
            });
          }
        }
      }
    }
    
    console.log(`Pre-computed ${this.possibleLines.length} possible lines for ${this.gridSize}x${this.gridSize}x${this.gridSize} grid`);
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    if (this.isDragging) {
      const deltaX = event.clientX - this.previousMousePosition.x;
      const deltaY = event.clientY - this.previousMousePosition.y;
      
      // Right mouse button (button 2) or middle button (button 1) for rotation
      if (event.buttons === 2 || event.buttons === 4) {
        this.gridGroup.rotation.y += deltaX * 0.01;
        this.gridGroup.rotation.x += deltaY * 0.01;
      }
      
      this.previousMousePosition = { x: event.clientX, y: event.clientY };
    } else if (!event.buttons) {
      this.updateLinePreview();
    }
  }

  private onMouseDown(event: MouseEvent): void {
    // Left click (button 0) for selecting lines
    if (event.button === 0) {
      const line = this.getHoveredLine();
      if (line) {
        this.handleLineClick(line, event.shiftKey);
        return; // Don't start dragging on left click
      }
    }
    
    // Right click (button 2) or middle click (button 1) for dragging
    if (event.button === 2 || event.button === 1) {
      this.isDragging = true;
      this.previousMousePosition = { x: event.clientX, y: event.clientY };
    }
  }

  private onMouseUp(event: MouseEvent): void {
    // Only stop dragging if it was a right or middle click release
    if (event.button === 2 || event.button === 1) {
      this.isDragging = false;
    }
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const scaleFactor = event.deltaY > 0 ? 1.1 : 0.9;
    const currentDistance = this.camera.position.length();
    const newDistance = currentDistance * scaleFactor;
    
    if (newDistance > 5 && newDistance < 50) {
      this.camera.position.multiplyScalar(scaleFactor);
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  private updateLinePreview(): void {
    const line = this.getHoveredLine();
    
    if (this.previewLine) {
      this.gridGroup.remove(this.previewLine);
      this.previewLine = null;
    }
    
    if (line && !this.isLineDrawn(line)) {
      // Analyze consequences and choose color accordingly
      const consequence = this.analyzeLineConsequences(line);
      let color: number;
      let baseOpacity = 0.6;
      
      // Apply turn-based opacity to preview lines only
      const turnOpacity = this.isPlayerTurn ? 1.0 : 0.4;
      
      switch (consequence.type) {
        case 'safe':
          color = 0x00ff00; // Green for safe moves
          break;
        case 'completes-square':
          color = 0xffd700; // Gold for moves that complete squares
          baseOpacity = 0.7;
          break;
        case 'chain-reaction':
          color = 0xffa500; // Bright orange for chain reactions
          baseOpacity = 0.8;
          break;
        case 'dangerous-third-line':
          color = 0xff0000; // Red warning for dangerous moves
          baseOpacity = 0.8;
          break;
        default:
          color = 0xffff00; // Fallback yellow
      }
      
      // Combine base opacity with turn-based opacity
      const finalOpacity = baseOpacity * turnOpacity;
      
      this.previewLine = this.createLineMesh(line, color, finalOpacity);
      
      // Add pulsing effect for chain reactions or dangerous moves
      if (consequence.chainReaction || consequence.type === 'dangerous-third-line') {
        this.addPulsingEffect(this.previewLine);
      }
      
      this.gridGroup.add(this.previewLine);
    }
  }

  private getHoveredLine(): Line | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Optimized: iterate through pre-computed lines instead of O(n³) nested loops
    let closestLine: Line | null = null;
    let closestDistance = Infinity;
    
    for (const line of this.possibleLines) {
      const distance = this.getLineDistanceFromRay(line);
      if (distance !== null && distance < closestDistance) {
        closestDistance = distance;
        closestLine = line;
        
        // Early exit optimization: if we found a very close line, stop searching
        if (closestDistance < 0.1) {
          break;
        }
      }
    }
    
    // Return the closest line if it's within a reasonable distance
    if (closestLine && closestDistance < 0.5) {
      return closestLine;
    }
    
    return null;
  }
  
  private getLineDistanceFromRay(line: Line): number | null {
    const offset = (this.gridSize - 1) / 2;
    
    // Convert line endpoints to world space
    const start = new THREE.Vector3(
      line.start.x - offset,
      line.start.y - offset,
      line.start.z - offset
    );
    const end = new THREE.Vector3(
      line.end.x - offset,
      line.end.y - offset,
      line.end.z - offset
    );
    
    // Get the midpoint of the line
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    // Transform midpoint to world coordinates
    const worldMidpoint = midpoint.clone();
    worldMidpoint.applyMatrix4(this.gridGroup.matrixWorld);
    
    // Create a ray from camera through mouse position
    const ray = this.raycaster.ray;
    
    // Calculate distance from ray to midpoint
    const distance = ray.distanceToPoint(worldMidpoint);
    
    return distance;
  }

  private createLineMesh(line: Line, color: number, opacity: number = 1): THREE.Mesh {
    const offset = (this.gridSize - 1) / 2;
    const start = new THREE.Vector3(
      line.start.x - offset,
      line.start.y - offset,
      line.start.z - offset
    );
    const end = new THREE.Vector3(
      line.end.x - offset,
      line.end.y - offset,
      line.end.z - offset
    );
    
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    direction.normalize();
    
    const geometry = new THREE.CylinderGeometry(0.05, 0.05, length, 8);
    const material = new THREE.MeshPhongMaterial({
      color,
      opacity,
      transparent: opacity < 1
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.copy(midpoint);
    
    const axis = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction);
    mesh.setRotationFromQuaternion(quaternion);
    
    return mesh;
  }

  private createGlowingLineMesh(line: Line, color: number): THREE.Mesh {
    const offset = (this.gridSize - 1) / 2;
    const start = new THREE.Vector3(
      line.start.x - offset,
      line.start.y - offset,
      line.start.z - offset
    );
    const end = new THREE.Vector3(
      line.end.x - offset,
      line.end.y - offset,
      line.end.z - offset
    );
    
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    direction.normalize();
    
    const geometry = new THREE.CylinderGeometry(0.08, 0.08, length, 8);
    
    // Create a glowing material with emissive properties
    const material = new THREE.MeshPhongMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.8,
      shininess: 100
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add a second, larger transparent cylinder for glow effect
    const glowGeometry = new THREE.CylinderGeometry(0.12, 0.12, length, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    mesh.add(glowMesh);
    
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.copy(midpoint);
    
    const axis = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction);
    mesh.setRotationFromQuaternion(quaternion);
    
    return mesh;
  }

  private areLinesEqual(line1: Line, line2: Line): boolean {
    const forward = (
      line1.start.x === line2.start.x && line1.start.y === line2.start.y && line1.start.z === line2.start.z &&
      line1.end.x === line2.end.x && line1.end.y === line2.end.y && line1.end.z === line2.end.z
    );
    const backward = (
      line1.start.x === line2.end.x && line1.start.y === line2.end.y && line1.start.z === line2.end.z &&
      line1.end.x === line2.start.x && line1.end.y === line2.start.y && line1.end.z === line2.start.z
    );
    
    if (forward || backward) {
      console.log('Lines match!', {line1, line2, forward, backward});
    }
    
    return forward || backward;
  }

  private isLineDrawn(line: Line): boolean {
    const key = this.getLineKey(line);
    return this.drawnLines.has(key);
  }

  private getLineKey(line: Line): string {
    const points = [line.start, line.end].sort((a, b) => {
      if (a.x !== b.x) return a.x - b.x;
      if (a.y !== b.y) return a.y - b.y;
      return a.z - b.z;
    });
    return `${points[0].x},${points[0].y},${points[0].z}-${points[1].x},${points[1].y},${points[1].z}`;
  }

  private getSquareKey(corners: Point3D[], playerColor: string): string {
    // Sort corners to create a consistent key
    const sortedCorners = [...corners].sort((a, b) => {
      if (a.x !== b.x) return a.x - b.x;
      if (a.y !== b.y) return a.y - b.y;
      return a.z - b.z;
    });
    const cornerStr = sortedCorners.map(c => `${c.x},${c.y},${c.z}`).join('|');
    return `${cornerStr}:${playerColor}`;
  }

  private getSphereKey(position: Point3D, color: string): string {
    return `${position.x},${position.y},${position.z}:${color}`;
  }

  /**
   * Analyze the consequences of drawing a line
   */
  private analyzeLineConsequences(line: Line): LineConsequence {
    if (!this.lastState) {
      return { type: 'safe', squareCount: 0, chainReaction: false };
    }

    // Simulate adding this line to the current state
    const newLines = [...this.lastState.lines, {
      ...line,
      player: this.lastState.currentPlayer
    }];

    // Count how many squares this would complete
    let completedSquares = 0;
    let chainPotential = false;
    let dangerousThirdLines = 0;

    // Only check squares that could be affected by this line (more efficient)
    const relevantSquares = this.getSquaresAdjacentToLine(line, this.lastState.gridSize);
    
    for (const squareCorners of relevantSquares) {
      if (this.wouldSquareBeCompleted(squareCorners, newLines)) {
        completedSquares++;
        chainPotential = true; // Any completed square could lead to chain reactions
      } else if (this.wouldBeThirdLine(squareCorners, newLines)) {
        // This would be the third line of a square, leaving an easy completion for the opponent
        dangerousThirdLines++;
      }
    }

    // Prioritize warnings: dangerous moves first, then completions
    if (dangerousThirdLines > 0 && completedSquares === 0) {
      return { type: 'dangerous-third-line', squareCount: 0, chainReaction: false };
    } else if (completedSquares === 0) {
      return { type: 'safe', squareCount: 0, chainReaction: false };
    } else if (completedSquares === 1 && !chainPotential) {
      return { type: 'completes-square', squareCount: 1, chainReaction: false };
    } else {
      return { type: 'chain-reaction', squareCount: completedSquares, chainReaction: true };
    }
  }

  /**
   * Check if a square would be completed with the given lines
   */
  private wouldSquareBeCompleted(corners: Point3D[], lines: Line[]): boolean {
    if (corners.length !== 4) return false;

    // Check all 4 edges of the square
    const edges = [
      [corners[0], corners[1]],
      [corners[1], corners[2]], 
      [corners[2], corners[3]],
      [corners[3], corners[0]]
    ];

    return edges.every(([start, end]) => 
      lines.some(line => 
        (this.arePointsEqual(line.start, start) && this.arePointsEqual(line.end, end)) ||
        (this.arePointsEqual(line.start, end) && this.arePointsEqual(line.end, start))
      )
    );
  }

  private arePointsEqual(p1: Point3D, p2: Point3D): boolean {
    return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z;
  }

  /**
   * Check if adding a line would create the third line of a square (dangerous move)
   */
  private wouldBeThirdLine(corners: Point3D[], lines: Line[]): boolean {
    if (corners.length !== 4) return false;

    // Check all 4 edges of the square
    const edges = [
      [corners[0], corners[1]],
      [corners[1], corners[2]], 
      [corners[2], corners[3]],
      [corners[3], corners[0]]
    ];

    let drawnEdges = 0;
    for (const [start, end] of edges) {
      const isDrawn = lines.some(line => 
        (this.arePointsEqual(line.start, start) && this.arePointsEqual(line.end, end)) ||
        (this.arePointsEqual(line.start, end) && this.arePointsEqual(line.end, start))
      );
      if (isDrawn) {
        drawnEdges++;
      }
    }

    // If we have exactly 3 edges drawn, this would be the third line (leaving 1 for opponent)
    return drawnEdges === 3;
  }

  /**
   * Get squares that are adjacent to (contain) the given line
   */
  private getSquaresAdjacentToLine(line: Line, gridSize: number): Point3D[][] {
    const squares: Point3D[][] = [];
    const { start, end } = line;
    
    // Determine the line's orientation
    const orientation = this.getLineOrientation(start, end);
    if (!orientation) return squares; // Invalid line
    
    // Generate potential squares that could contain this line as an edge
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);
    
    // Check cubes adjacent to this line
    for (let x = Math.max(0, minX - 1); x < Math.min(gridSize - 1, maxX + 1); x++) {
      for (let y = Math.max(0, minY - 1); y < Math.min(gridSize - 1, maxY + 1); y++) {
        for (let z = Math.max(0, minZ - 1); z < Math.min(gridSize - 1, maxZ + 1); z++) {
          const cubePosition = { x, y, z };
          const cubeFaces = this.getCubeFaces(cubePosition);
          
          // Check each face to see if it contains our line as an edge
          for (const face of cubeFaces) {
            if (this.squareContainsLine(face.corners, start, end)) {
              squares.push(face.corners);
            }
          }
        }
      }
    }
    
    return squares;
  }

  /**
   * Check if a square contains the given line as one of its edges
   */
  private squareContainsLine(corners: Point3D[], lineStart: Point3D, lineEnd: Point3D): boolean {
    if (corners.length !== 4) return false;
    
    // Check all 4 edges of the square
    const edges = [
      [corners[0], corners[1]],
      [corners[1], corners[2]], 
      [corners[2], corners[3]],
      [corners[3], corners[0]]
    ];
    
    return edges.some(([edgeStart, edgeEnd]) => 
      (this.arePointsEqual(edgeStart, lineStart) && this.arePointsEqual(edgeEnd, lineEnd)) ||
      (this.arePointsEqual(edgeStart, lineEnd) && this.arePointsEqual(edgeEnd, lineStart))
    );
  }

  /**
   * Determines the orientation of a line (x, y, or z axis)
   */
  private getLineOrientation(start: Point3D, end: Point3D): 'x' | 'y' | 'z' | null {
    const dx = Math.abs(start.x - end.x);
    const dy = Math.abs(start.y - end.y);
    const dz = Math.abs(start.z - end.z);
    
    if (dx === 1 && dy === 0 && dz === 0) return 'x';
    if (dx === 0 && dy === 1 && dz === 0) return 'y';
    if (dx === 0 && dy === 0 && dz === 1) return 'z';
    
    return null; // Not a valid line
  }

  /**
   * Gets the six faces of a cube at the given position (copied from GameUtils)
   */
  private getCubeFaces(position: Point3D): { corners: Point3D[] }[] {
    const { x, y, z } = position;
    
    return [
      // Front face (z)
      { corners: [{ x, y, z }, { x: x + 1, y, z }, { x: x + 1, y: y + 1, z }, { x, y: y + 1, z }] },
      // Back face (z+1)  
      { corners: [{ x, y, z: z + 1 }, { x: x + 1, y, z: z + 1 }, { x: x + 1, y: y + 1, z: z + 1 }, { x, y: y + 1, z: z + 1 }] },
      // Left face (x)
      { corners: [{ x, y, z }, { x, y: y + 1, z }, { x, y: y + 1, z: z + 1 }, { x, y, z: z + 1 }] },
      // Right face (x+1)
      { corners: [{ x: x + 1, y, z }, { x: x + 1, y: y + 1, z }, { x: x + 1, y: y + 1, z: z + 1 }, { x: x + 1, y, z: z + 1 }] },
      // Bottom face (y)
      { corners: [{ x, y, z }, { x: x + 1, y, z }, { x: x + 1, y, z: z + 1 }, { x, y, z: z + 1 }] },
      // Top face (y+1)
      { corners: [{ x, y: y + 1, z }, { x: x + 1, y: y + 1, z }, { x: x + 1, y: y + 1, z: z + 1 }, { x, y: y + 1, z: z + 1 }] }
    ];
  }

  /**
   * Add a pulsing effect to a line mesh for chain reactions
   */
  private addPulsingEffect(mesh: THREE.Mesh): void {
    if (!mesh.material || Array.isArray(mesh.material)) return;
    
    const material = mesh.material as THREE.MeshPhongMaterial;
    const originalIntensity = material.emissiveIntensity || 0;
    
    // Store reference to stop animation later
    const animate = () => {
      const time = Date.now() * 0.005;
      const pulse = Math.sin(time) * 0.3 + 0.7; // Pulse between 0.4 and 1.0
      material.emissiveIntensity = originalIntensity + pulse * 0.5;
    };
    
    // Add animation to mesh for cleanup
    (mesh as any).pulseAnimation = animate;
    
    // Start animation loop
    const animationLoop = () => {
      if (mesh.parent) { // Still in scene
        animate();
        requestAnimationFrame(animationLoop);
      }
    };
    requestAnimationFrame(animationLoop);
  }

  private handleLineClick(line: Line, isShiftHeld: boolean = false): void {
    // If Shift is held, print line coordinates to console for debugging
    if (isShiftHeld) {
      console.log('🔍 DEBUG: Line coordinates:', {
        start: { x: line.start.x, y: line.start.y, z: line.start.z },
        end: { x: line.end.x, y: line.end.y, z: line.end.z },
        isDrawn: this.isLineDrawn(line)
      });
      return;
    }
    
    // Normal line click behavior
    if (this.lineClickCallback && !this.isLineDrawn(line)) {
      this.lineClickCallback(line.start, line.end);
    }
  }

  private lineClickCallback?: (start: Point3D, end: Point3D) => void;

  public onLineClick(callback: (start: Point3D, end: Point3D) => void): void {
    this.lineClickCallback = callback;
  }

  public updateFromGameState(state: GameState, playerId?: string): void {
    // Store the state for potential re-rendering
    this.lastState = state;
    
    // Update turn information for visual feedback
    this.currentPlayerId = playerId || null;
    this.isPlayerTurn = playerId ? state.currentPlayer.id === playerId : false;
    
    // Update lines differentially (now with turn-based opacity)
    this.updateLinesDifferentially(state);
    
    // Update squares differentially
    this.updateSquaresDifferentially(state);
    
    // Update spheres differentially
    this.updateSpheresDifferentially(state);
  }

  private updateLinesDifferentially(state: GameState): void {
    // Create a set of current line keys from the state
    const currentLineKeys = new Set<string>();
    const currentLines = new Map<string, { line: Line; isLastMove: boolean }>();
    
    console.log('Drawing lines, lastMove:', state.lastMove);
    
    for (const line of state.lines) {
      const key = this.getLineKey(line);
      const isLastMove = !!(state.lastMove && this.areLinesEqual(line, state.lastMove));
      
      if (isLastMove) {
        console.log('Found last move! Creating glowing line:', line);
      }
      
      currentLineKeys.add(key);
      currentLines.set(key, { line, isLastMove });
    }
    
    // Remove lines that are no longer in the state
    for (const [key, mesh] of this.drawnLines) {
      if (!currentLineKeys.has(key)) {
        this.gridGroup.remove(mesh);
        // Dispose geometry and material to prevent memory leaks
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
        this.drawnLines.delete(key);
      }
    }
    
    // Add new lines or update existing ones that changed (e.g., highlighting)
    for (const [key, { line, isLastMove }] of currentLines) {
      const existingMesh = this.drawnLines.get(key);
      const color = line.player?.color ? parseInt(line.player.color.replace('#', '0x')) : 0xffffff;
      
      // Existing drawn lines always use full opacity (1.0) - they keep their player color
      const baseOpacity = 1.0;
      
      // Check if line needs to be recreated (new line or highlighting changed)
      const needsRecreation = !existingMesh || 
        (isLastMove && !this.isGlowingMesh(existingMesh)) ||
        (!isLastMove && this.isGlowingMesh(existingMesh));
      
      if (needsRecreation) {
        // Remove existing mesh if it exists
        if (existingMesh) {
          this.gridGroup.remove(existingMesh);
          if (existingMesh.geometry) existingMesh.geometry.dispose();
          if (existingMesh.material) {
            if (Array.isArray(existingMesh.material)) {
              existingMesh.material.forEach(m => m.dispose());
            } else {
              existingMesh.material.dispose();
            }
          }
        }
        
        // Create new mesh with turn-based opacity
        const mesh = isLastMove 
          ? this.createGlowingLineMesh(line, color)
          : this.createLineMesh(line, color, baseOpacity);
        
        this.drawnLines.set(key, mesh);
        this.gridGroup.add(mesh);
      }
    }
  }

  private updateSquaresDifferentially(state: GameState): void {
    const currentSquareKeys = new Set<string>();
    const currentSquares = new Map<string, { corners: Point3D[]; color: string }>();
    
    // Collect all current squares
    for (const cube of state.cubes) {
      for (const face of cube.faces) {
        if (face.player) {
          const key = this.getSquareKey(face.corners, face.player.color);
          currentSquareKeys.add(key);
          currentSquares.set(key, { corners: face.corners, color: face.player.color });
        }
      }
    }
    
    // Remove squares that are no longer in the state
    const squaresToRemove: number[] = [];
    for (let i = 0; i < this.completedSquares.length; i++) {
      const mesh = this.completedSquares[i];
      const key = mesh.userData.squareKey;
      if (!currentSquareKeys.has(key)) {
        this.gridGroup.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
        this.renderedSquareKeys.delete(key);
        squaresToRemove.push(i);
      }
    }
    
    // Remove squares from array in reverse order to maintain indices
    for (let i = squaresToRemove.length - 1; i >= 0; i--) {
      this.completedSquares.splice(squaresToRemove[i], 1);
    }
    
    // Add new squares
    for (const [key, { corners, color }] of currentSquares) {
      if (!this.renderedSquareKeys.has(key)) {
        this.drawCompletedSquare(corners, color);
        this.renderedSquareKeys.add(key);
        
        // Store the key in the mesh for later identification
        const lastMesh = this.completedSquares[this.completedSquares.length - 1];
        if (lastMesh) {
          lastMesh.userData.squareKey = key;
        }
      }
    }
  }

  private updateSpheresDifferentially(state: GameState): void {
    const currentSphereKeys = new Set<string>();
    const currentSpheres = new Map<string, { position: Point3D; color: string }>();
    
    // Collect all current spheres
    for (const cube of state.cubes) {
      if (cube.owner) {
        // Owned cube - use dark blue for Player 2 spheres, otherwise use owner's color
        const sphereColor = cube.owner.id === 'player2' ? '#0000FF' : cube.owner.color;
        const key = this.getSphereKey(cube.position, sphereColor);
        currentSphereKeys.add(key);
        currentSpheres.set(key, { position: cube.position, color: sphereColor });
      } else if (cube.claimedFaces === 6) {
        // All faces claimed but tied (3-3) - use gray
        const sphereColor = '#808080';
        const key = this.getSphereKey(cube.position, sphereColor);
        currentSphereKeys.add(key);
        currentSpheres.set(key, { position: cube.position, color: sphereColor });
      }
    }
    
    // Remove spheres that are no longer in the state
    const spheresToRemove: number[] = [];
    for (let i = 0; i < this.cubeSpheres.length; i++) {
      const mesh = this.cubeSpheres[i];
      const key = mesh.userData.sphereKey;
      if (!currentSphereKeys.has(key)) {
        this.gridGroup.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
        this.renderedSphereKeys.delete(key);
        spheresToRemove.push(i);
      }
    }
    
    // Remove spheres from array in reverse order to maintain indices
    for (let i = spheresToRemove.length - 1; i >= 0; i--) {
      this.cubeSpheres.splice(spheresToRemove[i], 1);
    }
    
    // Add new spheres
    for (const [key, { position, color }] of currentSpheres) {
      if (!this.renderedSphereKeys.has(key)) {
        this.drawCubeSphere(position, color);
        this.renderedSphereKeys.add(key);
        
        // Store the key in the mesh for later identification
        const lastMesh = this.cubeSpheres[this.cubeSpheres.length - 1];
        if (lastMesh) {
          lastMesh.userData.sphereKey = key;
        }
      }
    }
  }

  private isGlowingMesh(mesh: THREE.Mesh): boolean {
    // Check if the mesh has the characteristic structure of a glowing line
    // (it has a child glow mesh)
    return mesh.children && mesh.children.length > 0;
  }

  private drawCompletedSquare(corners: Point3D[], color: string): void {
    const offset = (this.gridSize - 1) / 2;
    
    // Calculate the center and normal of the square
    const v1 = new THREE.Vector3(
      corners[0].x - offset,
      corners[0].y - offset,
      corners[0].z - offset
    );
    const v2 = new THREE.Vector3(
      corners[1].x - offset,
      corners[1].y - offset,
      corners[1].z - offset
    );
    const v3 = new THREE.Vector3(
      corners[2].x - offset,
      corners[2].y - offset,
      corners[2].z - offset
    );
    const v4 = new THREE.Vector3(
      corners[3].x - offset,
      corners[3].y - offset,
      corners[3].z - offset
    );
    
    // Create a plane geometry for the square
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      v1.x, v1.y, v1.z,
      v2.x, v2.y, v2.z,
      v3.x, v3.y, v3.z,
      v4.x, v4.y, v4.z
    ]);
    
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshPhongMaterial({
      color: parseInt(color.replace('#', '0x')),
      opacity: this.squareOpacity,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    this.completedSquares.push(mesh);
    this.gridGroup.add(mesh);
  }
  
  private drawCubeSphere(position: Point3D, color: string): void {
    const offset = (this.gridSize - 1) / 2;
    
    // Create a sphere in the center of the cube
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshPhongMaterial({
      color: parseInt(color.replace('#', '0x')),
      opacity: 0.9,
      transparent: true
    });
    
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(
      position.x - offset + 0.5,
      position.y - offset + 0.5,
      position.z - offset + 0.5
    );
    
    this.cubeSpheres.push(sphere);
    this.gridGroup.add(sphere);
  }
  
  // Method to adjust square opacity if needed
  public setSquareOpacity(opacity: number): void {
    this.squareOpacity = Math.max(0, Math.min(1, opacity));
    // Re-render with new opacity, preserving player ID
    if (this.lastState) {
      this.updateFromGameState(this.lastState, this.currentPlayerId || undefined);
    }
  }

  private animate(): void {
    if (this.isDisposed) return;
    
    this.animationId = requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  public resize(gridSize: GridSize): void {
    this.gridSize = gridSize;
    
    while (this.gridGroup.children.length > 0) {
      this.gridGroup.remove(this.gridGroup.children[0]);
    }
    
    this.dots = [];
    this.drawnLines.clear();
    this.previewLine = null;
    this.completedSquares = [];
    this.possibleLines = []; // Clear pre-computed lines for re-computation
    this.cubeSpheres = [];
    this.lastState = null;
    this.renderedSquareKeys.clear();
    this.renderedSphereKeys.clear();
    
    this.createGrid();
    this.setupCamera();
  }

  public dispose(): void {
    // Mark as disposed to stop animation loop
    this.isDisposed = true;
    
    // Cancel animation frame
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
    
    // Remove event listeners
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('mousemove', this.boundOnMouseMove);
      this.renderer.domElement.removeEventListener('mousedown', this.boundOnMouseDown);
      this.renderer.domElement.removeEventListener('mouseup', this.boundOnMouseUp);
      this.renderer.domElement.removeEventListener('wheel', this.boundOnWheel);
      this.renderer.domElement.removeEventListener('contextmenu', this.boundOnContextMenu);
    }
    window.removeEventListener('resize', this.boundOnWindowResize);
    
    // Dispose all managed resources
    this.resourceManager.dispose();
    
    // Dispose Three.js resources
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
  }
}