import * as THREE from 'three';
import { GridSize, Point3D, Line, GameState } from './types';

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
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.renderer.domElement.addEventListener('wheel', this.onWheel.bind(this));
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private createGrid(): void {
    const dotGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const dotMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    
    const offset = (this.gridSize - 1) / 2;
    
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
        }
      }
    }
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
        this.handleLineClick(line);
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
      this.previewLine = this.createLineMesh(line, 0xffff00, 0.5);
      this.gridGroup.add(this.previewLine);
    }
  }

  private getHoveredLine(): Line | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get all possible lines
    const possibleLines: { line: Line; distance: number }[] = [];
    
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        for (let z = 0; z < this.gridSize; z++) {
          const point = { x, y, z };
          
          // Check horizontal lines (x direction)
          if (x < this.gridSize - 1) {
            const line: Line = { start: point, end: { x: x + 1, y, z }, player: null };
            const distance = this.getLineDistanceFromRay(line);
            if (distance !== null) {
              possibleLines.push({ line, distance });
            }
          }
          
          // Check vertical lines (y direction)
          if (y < this.gridSize - 1) {
            const line: Line = { start: point, end: { x, y: y + 1, z }, player: null };
            const distance = this.getLineDistanceFromRay(line);
            if (distance !== null) {
              possibleLines.push({ line, distance });
            }
          }
          
          // Check depth lines (z direction)
          if (z < this.gridSize - 1) {
            const line: Line = { start: point, end: { x, y, z: z + 1 }, player: null };
            const distance = this.getLineDistanceFromRay(line);
            if (distance !== null) {
              possibleLines.push({ line, distance });
            }
          }
        }
      }
    }
    
    // Find the closest line
    if (possibleLines.length === 0) return null;
    
    possibleLines.sort((a, b) => a.distance - b.distance);
    
    // Return the closest line if it's within a reasonable distance
    if (possibleLines[0].distance < 0.5) {
      return possibleLines[0].line;
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

  private handleLineClick(line: Line): void {
    if (this.lineClickCallback && !this.isLineDrawn(line)) {
      this.lineClickCallback(line.start, line.end);
    }
  }

  private lineClickCallback?: (start: Point3D, end: Point3D) => void;

  public onLineClick(callback: (start: Point3D, end: Point3D) => void): void {
    this.lineClickCallback = callback;
  }

  public updateFromGameState(state: GameState): void {
    for (const [key, mesh] of this.drawnLines) {
      this.gridGroup.remove(mesh);
    }
    this.drawnLines.clear();
    
    for (const line of state.lines) {
      const color = line.player?.color ? parseInt(line.player.color.replace('#', '0x')) : 0xffffff;
      const mesh = this.createLineMesh(line, color);
      const key = this.getLineKey(line);
      this.drawnLines.set(key, mesh);
      this.gridGroup.add(mesh);
    }
    
    for (const cube of state.cubes) {
      if (cube.owner) {
        this.highlightCube(cube.position, cube.owner.color);
      }
    }
  }

  private highlightCube(position: Point3D, color: string): void {
    const offset = (this.gridSize - 1) / 2;
    const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const material = new THREE.MeshPhongMaterial({
      color: parseInt(color.replace('#', '0x')),
      opacity: 0.3,
      transparent: true
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      position.x - offset + 0.5,
      position.y - offset + 0.5,
      position.z - offset + 0.5
    );
    
    this.gridGroup.add(mesh);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
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
    
    this.createGrid();
    this.setupCamera();
  }

  public dispose(): void {
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}