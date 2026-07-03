/**
 * The 3D board — a pure view over engine state. It owns the Three.js
 * scene, camera, and input, and reports intent upward (hover/select of
 * edge ids); it never mutates game state and derives nothing about rules
 * (consequence analyses are handed in, already computed by the engine).
 *
 * Rendering approach: physically-based materials under an environment
 * map with ACES tone mapping; fog for depth cueing. Geometry is drawn
 * with per-seat InstancedMeshes rebuilt on every update — the whole
 * board is at most ~540 edges, so a rebuild is trivially cheap and keeps
 * the view a stateless function of GameState.
 *
 * Interaction: precise raycast picking against invisible fat cylinders
 * (replacing the prototype's nearest-midpoint guess). Left-drag or
 * touch-drag orbits, wheel/pinch zooms, click/tap on an edge selects it.
 * Slicing isolates one slab of the lattice so interior edges are
 * reachable — the prototype's biggest playability gap.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getLattice, type Axis, type GridSize, type Point3 } from '../engine/lattice.ts';
import type { GameState, Seat } from '../engine/game.ts';
import type { MoveAnalysis } from '../engine/analyzer.ts';
import { CONSEQUENCE_COLORS, PLAYER_COLORS, SCENE } from '../app/theme.ts';

export interface BoardView {
  state: GameState;
  /** Consequence analyses for hover coloring; omit when not interactive. */
  analyses?: Map<number, MoveAnalysis>;
  /** Whether the local user may select edges right now. */
  interactive: boolean;
  /** Most recent move, highlighted with a fading glow. */
  lastMove?: { edgeId: number; seat: Seat } | null;
}

export interface Slice {
  axis: Axis;
  /** Slab [layer, layer+1] in dot coordinates; layer ∈ [0, gridSize-2]. */
  layer: number;
}

export interface BoardRendererOptions {
  container: HTMLElement;
  gridSize: GridSize;
  onEdgeSelect: (edgeId: number) => void;
  onEdgeHover: (edgeId: number | null, analysis: MoveAnalysis | null) => void;
}

const DOT_RADIUS = 0.07;
const EDGE_RADIUS = 0.028;
const DRAWN_EDGE_RADIUS = 0.045;
const PICK_RADIUS = 0.16;
const FACE_OPACITY = 0.3;
const CUBE_OPACITY = 0.16;
const LAST_MOVE_FADE_MS = 4000;
const DRAG_THRESHOLD_PX = 6;

const UP = new THREE.Object3D();

function edgeTransform(a: Point3, b: Point3, radius: number, lengthScale = 1): THREE.Matrix4 {
  const from = new THREE.Vector3(a.x, a.y, a.z);
  const to = new THREE.Vector3(b.x, b.y, b.z);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dir = to.clone().sub(from);
  const len = dir.length();
  UP.position.copy(mid);
  UP.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  UP.scale.set(radius, len * lengthScale, radius);
  UP.updateMatrix();
  return UP.matrix.clone();
}

export class BoardRenderer {
  private readonly lat;
  private readonly n: GridSize;
  private readonly opts: BoardRendererOptions;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly center: THREE.Vector3;
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // orbit state (spherical around center, with inertial damping)
  private theta = Math.PI / 4;
  private phi = Math.PI / 3;
  private distance: number;
  private thetaVel = 0;
  private phiVel = 0;

  // pointer state
  private pointers = new Map<number, { x: number; y: number }>();
  private dragging = false;
  private downPos: { x: number; y: number } | null = null;
  private pinchDistance: number | null = null;
  private hoveredEdge: number | null = null;

  // scene objects rebuilt per update
  private dynamic = new THREE.Group();
  private pickMesh: THREE.InstancedMesh | null = null;
  private pickEdgeIds: number[] = [];
  private hoverMesh: THREE.Group;
  private lastMoveMesh: THREE.Mesh;
  private lastMoveShownAt = 0;
  private lastMoveKey: number | null = null;

  private view: BoardView | null = null;
  private slice: Slice | null = null;
  private disposed = false;
  private animationHandle = 0;

  constructor(opts: BoardRendererOptions) {
    this.opts = opts;
    this.n = opts.gridSize;
    this.lat = getLattice(this.n);
    const c = (this.n - 1) / 2;
    this.center = new THREE.Vector3(c, c, c);
    this.distance = this.frameDistance();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    opts.container.appendChild(canvas);

    this.scene.background = new THREE.Color(SCENE.background);
    this.scene.fog = new THREE.Fog(SCENE.fog, this.distance, this.distance * 2.6);

    const env = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = env.fromScene(new RoomEnvironment(), 0.04).texture;
    env.dispose();

    // key + fill ride with the camera so orbiting never changes which
    // side of the board is lit (a prototype complaint)
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 5, 4);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.add(key);
    const fill = new THREE.DirectionalLight(0x99bbff, 0.35);
    fill.position.set(-4, -2, 2);
    this.camera.add(fill);
    this.scene.add(this.camera);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    this.scene.add(this.dynamic);
    this.hoverMesh = this.buildHoverMesh();
    this.scene.add(this.hoverMesh);
    this.lastMoveMesh = this.buildLastMoveMesh();
    this.scene.add(this.lastMoveMesh);
    this.buildDots();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(opts.container);
    this.resize();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.animate();
  }

  /** Re-render the board from a new game state / interaction context. */
  update(view: BoardView): void {
    this.view = view;
    this.rebuild();
    if (view.lastMove && view.lastMove.edgeId !== this.lastMoveKey) {
      this.lastMoveKey = view.lastMove.edgeId;
      this.lastMoveShownAt = performance.now();
      const [a, b] = this.lat.edgeEndpoints(view.lastMove.edgeId);
      this.lastMoveMesh.matrix.copy(edgeTransform(a, b, DRAWN_EDGE_RADIUS * 1.9));
      (this.lastMoveMesh.material as THREE.MeshBasicMaterial).color.set(
        PLAYER_COLORS[view.lastMove.seat],
      );
    }
    if (!view.lastMove) this.lastMoveKey = null;
  }

  /** Isolate one slab of the lattice (null = show everything). */
  setSlice(slice: Slice | null): void {
    this.slice = slice;
    this.setHovered(null);
    this.rebuild();
  }

  getSlice(): Slice | null {
    return this.slice;
  }

  resetView(): void {
    this.theta = Math.PI / 4;
    this.phi = Math.PI / 3;
    this.distance = this.frameDistance();
    this.thetaVel = 0;
    this.phiVel = 0;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationHandle);
    this.resizeObserver.disconnect();
    this.clearGroup(this.dynamic);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---- scene construction ----

  private frameDistance(): number {
    return (this.n - 1) * 2.6 + 1.6;
  }

  private buildDots(): void {
    const count = this.n ** 3;
    const geo = new THREE.SphereGeometry(DOT_RADIUS, 16, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: SCENE.dot,
      roughness: 0.4,
      metalness: 0.1,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let z = 0; z < this.n; z++)
      for (let y = 0; y < this.n; y++)
        for (let x = 0; x < this.n; x++) {
          m.setPosition(x, y, z);
          mesh.setMatrixAt(i++, m);
        }
    this.scene.add(mesh);
  }

  private buildHoverMesh(): THREE.Group {
    const group = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 16),
      new THREE.MeshStandardMaterial({
        emissive: '#ffffff',
        emissiveIntensity: 0.9,
        color: '#ffffff',
        roughness: 0.3,
      }),
    );
    cyl.matrixAutoUpdate = false;
    group.add(cyl);
    for (let i = 0; i < 2; i++) {
      const end = new THREE.Mesh(
        new THREE.SphereGeometry(DOT_RADIUS * 1.7, 16, 12),
        new THREE.MeshStandardMaterial({ emissive: '#ffffff', emissiveIntensity: 0.9 }),
      );
      group.add(end);
    }
    group.visible = false;
    return group;
  }

  private buildLastMoveMesh(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 16),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    );
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    return mesh;
  }

  private inSlab(points: Point3[]): boolean {
    if (!this.slice) return true;
    const { axis, layer } = this.slice;
    return points.every((p) => {
      const c = axis === 0 ? p.x : axis === 1 ? p.y : p.z;
      return c >= layer && c <= layer + 1;
    });
  }

  private rebuild(): void {
    this.clearGroup(this.dynamic);
    this.pickMesh = null;
    this.pickEdgeIds = [];
    if (!this.view) return;
    const { state } = this.view;

    // classify edges
    const undrawn: number[] = [];
    const drawnBySeat: [number[], number[]] = [[], []];
    for (let e = 0; e < state.edges.length; e++) {
      const [a, b] = this.lat.edgeEndpoints(e);
      if (!this.inSlab([a, b])) continue;
      const owner = state.edges[e]!;
      if (owner === 0) undrawn.push(e);
      else drawnBySeat[(owner - 1) as Seat].push(e);
    }

    // undrawn edges: subtle guides + invisible fat pick targets
    if (undrawn.length > 0) {
      const guideMat = new THREE.MeshBasicMaterial({
        color: SCENE.undrawnEdge,
        transparent: true,
        opacity: this.view.interactive ? 0.38 : 0.2,
      });
      const guides = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(1, 1, 1, 6),
        guideMat,
        undrawn.length,
      );
      const picks = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(1, 1, 1, 6),
        new THREE.MeshBasicMaterial({ visible: false }),
        undrawn.length,
      );
      undrawn.forEach((e, i) => {
        const [a, b] = this.lat.edgeEndpoints(e);
        guides.setMatrixAt(i, edgeTransform(a, b, EDGE_RADIUS, 0.86));
        picks.setMatrixAt(i, edgeTransform(a, b, PICK_RADIUS, 0.9));
      });
      this.dynamic.add(guides);
      this.dynamic.add(picks);
      this.pickMesh = picks;
      this.pickEdgeIds = undrawn;
    }

    // drawn edges per seat
    for (const seat of [0, 1] as const) {
      const edges = drawnBySeat[seat];
      if (edges.length === 0) continue;
      const mat = new THREE.MeshStandardMaterial({
        color: PLAYER_COLORS[seat],
        emissive: PLAYER_COLORS[seat],
        emissiveIntensity: 0.28,
        roughness: 0.35,
        metalness: 0.1,
      });
      const mesh = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(1, 1, 1, 12),
        mat,
        edges.length,
      );
      edges.forEach((e, i) => {
        const [a, b] = this.lat.edgeEndpoints(e);
        mesh.setMatrixAt(i, edgeTransform(a, b, DRAWN_EDGE_RADIUS));
      });
      this.dynamic.add(mesh);
    }

    // completed faces per seat
    for (const seat of [0, 1] as const) {
      const faces: number[] = [];
      for (let f = 0; f < state.faces.length; f++) {
        if (state.faces[f] === seat + 1 && this.inSlab(this.lat.faceCorners(f))) faces.push(f);
      }
      if (faces.length === 0) continue;
      const mat = new THREE.MeshStandardMaterial({
        color: PLAYER_COLORS[seat],
        transparent: true,
        opacity: FACE_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.6,
      });
      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, faces.length);
      const obj = new THREE.Object3D();
      faces.forEach((f, i) => {
        const corners = this.lat.faceCorners(f);
        const normal = this.lat.faceNormal(f);
        const cx = corners.reduce((s, p) => s + p.x, 0) / 4;
        const cy = corners.reduce((s, p) => s + p.y, 0) / 4;
        const cz = corners.reduce((s, p) => s + p.z, 0) / 4;
        obj.position.set(cx, cy, cz);
        obj.rotation.set(0, 0, 0);
        if (normal === 0) obj.rotation.y = Math.PI / 2;
        else if (normal === 1) obj.rotation.x = Math.PI / 2;
        obj.updateMatrix();
        mesh.setMatrixAt(i, obj.matrix);
      });
      this.dynamic.add(mesh);
    }

    // claimed cubes per seat — a soft volume tint, not an occluding ball
    for (const seat of [0, 1] as const) {
      const cubes: number[] = [];
      for (let c = 0; c < state.cubes.length; c++) {
        if (state.cubes[c] !== seat + 1) continue;
        const o = this.lat.cubeOrigin(c);
        if (this.inSlab([o, { x: o.x + 1, y: o.y + 1, z: o.z + 1 }])) cubes.push(c);
      }
      if (cubes.length === 0) continue;
      const mat = new THREE.MeshStandardMaterial({
        color: PLAYER_COLORS[seat],
        emissive: PLAYER_COLORS[seat],
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: CUBE_OPACITY,
        depthWrite: false,
        roughness: 0.5,
      });
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.86, 0.86, 0.86), mat, cubes.length);
      const m = new THREE.Matrix4();
      cubes.forEach((c, i) => {
        const o = this.lat.cubeOrigin(c);
        m.setPosition(o.x + 0.5, o.y + 0.5, o.z + 0.5);
        mesh.setMatrixAt(i, m);
      });
      this.dynamic.add(mesh);
    }

    // keep hover coherent after a rebuild
    if (this.hoveredEdge !== null && state.edges[this.hoveredEdge] !== 0) this.setHovered(null);
    else if (this.hoveredEdge !== null) this.applyHoverVisual(this.hoveredEdge);
  }

  private clearGroup(group: THREE.Group): void {
    for (const child of [...group.children]) {
      group.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  }

  // ---- picking & hover ----

  private pick(clientX: number, clientY: number): number | null {
    if (!this.pickMesh || !this.view?.interactive) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.pickMesh);
    const hit = hits[0];
    if (hit?.instanceId === undefined) return null;
    return this.pickEdgeIds[hit.instanceId] ?? null;
  }

  private setHovered(edgeId: number | null): void {
    if (edgeId === this.hoveredEdge) return;
    this.hoveredEdge = edgeId;
    if (edgeId === null) {
      this.hoverMesh.visible = false;
      this.renderer.domElement.style.cursor = 'grab';
      this.opts.onEdgeHover(null, null);
      return;
    }
    this.applyHoverVisual(edgeId);
    const analysis = this.view?.analyses?.get(edgeId) ?? null;
    this.renderer.domElement.style.cursor = 'pointer';
    this.opts.onEdgeHover(edgeId, analysis);
  }

  private applyHoverVisual(edgeId: number): void {
    const analysis = this.view?.analyses?.get(edgeId) ?? null;
    const color = analysis ? CONSEQUENCE_COLORS[analysis.kind] : '#ffffff';
    const [a, b] = this.lat.edgeEndpoints(edgeId);
    const [cyl, endA, endB] = this.hoverMesh.children as [THREE.Mesh, THREE.Mesh, THREE.Mesh];
    cyl.matrix.copy(edgeTransform(a, b, DRAWN_EDGE_RADIUS * 1.4));
    endA.position.set(a.x, a.y, a.z);
    endB.position.set(b.x, b.y, b.z);
    for (const part of [cyl, endA, endB]) {
      const mat = part.material as THREE.MeshStandardMaterial;
      mat.color.set(color);
      mat.emissive.set(color);
    }
    this.hoverMesh.visible = true;
  }

  // ---- input ----

  private onPointerDown = (ev: PointerEvent): void => {
    this.renderer.domElement.setPointerCapture(ev.pointerId);
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this.pointers.size === 1) {
      this.downPos = { x: ev.clientX, y: ev.clientY };
      this.dragging = false;
    } else if (this.pointers.size === 2) {
      const [p1, p2] = [...this.pointers.values()];
      this.pinchDistance = Math.hypot(p1!.x - p2!.x, p1!.y - p2!.y);
      this.downPos = null; // a second finger cancels tap-select
    }
  };

  private onPointerMove = (ev: PointerEvent): void => {
    const prev = this.pointers.get(ev.pointerId);
    if (!prev) {
      // pure hover (mouse, no button)
      this.setHovered(this.pick(ev.clientX, ev.clientY));
      return;
    }
    const dx = ev.clientX - prev.x;
    const dy = ev.clientY - prev.y;
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (this.pointers.size === 2) {
      const [p1, p2] = [...this.pointers.values()];
      const dist = Math.hypot(p1!.x - p2!.x, p1!.y - p2!.y);
      if (this.pinchDistance !== null && this.pinchDistance > 0) {
        this.zoomBy(this.pinchDistance / dist);
      }
      this.pinchDistance = dist;
      return;
    }

    if (
      !this.dragging &&
      this.downPos &&
      Math.hypot(ev.clientX - this.downPos.x, ev.clientY - this.downPos.y) > DRAG_THRESHOLD_PX
    ) {
      this.dragging = true;
      this.setHovered(null);
      this.renderer.domElement.style.cursor = 'grabbing';
    }
    if (this.dragging) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.thetaVel = (-dx / rect.width) * Math.PI * 1.6;
      this.phiVel = (-dy / rect.height) * Math.PI * 1.2;
      this.theta += this.thetaVel;
      this.phi = THREE.MathUtils.clamp(this.phi + this.phiVel, 0.15, Math.PI - 0.15);
    }
  };

  private onPointerUp = (ev: PointerEvent): void => {
    this.pointers.delete(ev.pointerId);
    this.pinchDistance = null;
    if (!this.dragging && this.downPos) {
      const edge = this.pick(ev.clientX, ev.clientY);
      if (edge !== null) {
        // touch flow: first tap previews, tap on the previewed edge confirms
        if (ev.pointerType === 'touch' && this.hoveredEdge !== edge) {
          this.setHovered(edge);
        } else {
          this.opts.onEdgeSelect(edge);
          if (ev.pointerType === 'touch') this.setHovered(null);
        }
      } else if (ev.pointerType === 'touch') {
        this.setHovered(null);
      }
    }
    this.downPos = null;
    this.dragging = false;
    this.renderer.domElement.style.cursor = 'grab';
  };

  private onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    this.zoomBy(Math.exp(ev.deltaY * 0.001));
  };

  private zoomBy(factor: number): void {
    const max = this.frameDistance() * 2.2;
    const min = 1.5;
    this.distance = THREE.MathUtils.clamp(this.distance * factor, min, max);
  }

  // ---- frame loop ----

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.opts.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.animationHandle = requestAnimationFrame(this.animate);

    // orbit inertia
    if (!this.dragging && !this.reducedMotion) {
      this.thetaVel *= 0.92;
      this.phiVel *= 0.92;
      if (Math.abs(this.thetaVel) > 1e-4) this.theta += this.thetaVel;
      if (Math.abs(this.phiVel) > 1e-4) {
        this.phi = THREE.MathUtils.clamp(this.phi + this.phiVel, 0.15, Math.PI - 0.15);
      }
    }

    const sinPhi = Math.sin(this.phi);
    this.camera.position.set(
      this.center.x + this.distance * sinPhi * Math.cos(this.theta),
      this.center.y + this.distance * Math.cos(this.phi),
      this.center.z + this.distance * sinPhi * Math.sin(this.theta),
    );
    this.camera.lookAt(this.center);

    // hover pulse
    if (this.hoverMesh.visible && !this.reducedMotion) {
      const s = 1 + 0.12 * Math.sin(performance.now() / 180);
      this.hoverMesh.children.forEach((c, i) => {
        if (i > 0) c.scale.setScalar(s);
      });
    }

    // last-move glow fade
    if (this.lastMoveKey !== null) {
      const age = performance.now() - this.lastMoveShownAt;
      const t = Math.max(0, 1 - age / LAST_MOVE_FADE_MS);
      this.lastMoveMesh.visible = t > 0;
      (this.lastMoveMesh.material as THREE.MeshBasicMaterial).opacity = 0.5 * t;
    } else {
      this.lastMoveMesh.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  };
}
