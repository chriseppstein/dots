/**
 * The lattice is the geometry oracle for a gridSize³ dot grid: every edge,
 * face, and unit cube gets one stable integer id, with all adjacency
 * precomputed at construction. Nothing else in the codebase derives
 * geometry from coordinates — the prototype's chain-reaction bug came from
 * exactly that kind of re-derivation drifting between call sites.
 *
 * Id schemes (n = dots per axis):
 *  - edge  = axis-major: axis a ∈ {0,1,2}, then min-corner linearized with
 *    the a-th dimension shrunk to n-1. Per-axis block: n·n·(n-1).
 *  - face  = normal-axis-major: normal a, min-corner linearized with the
 *    two in-plane dimensions shrunk to n-1. Per-normal block: n·(n-1)².
 *  - cube  = min-corner linearized over (n-1)³.
 */

export type GridSize = 3 | 4 | 5 | 6;

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

const AXES = [0, 1, 2] as const;
export type Axis = (typeof AXES)[number];

const UNIT: readonly Point3[] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

function coord(p: Point3, axis: Axis): number {
  return axis === 0 ? p.x : axis === 1 ? p.y : p.z;
}

function add(p: Point3, q: Point3): Point3 {
  return { x: p.x + q.x, y: p.y + q.y, z: p.z + q.z };
}

export class Lattice {
  readonly n: GridSize;
  readonly edgeCount: number;
  readonly faceCount: number;
  readonly cubeCount: number;

  private readonly edgesPerAxis: number;
  private readonly facesPerNormal: number;

  /** 4 edge ids per face. */
  private readonly faceEdgeTable: Int32Array;
  /** Up to 4 face ids per edge, -1 padded. */
  private readonly edgeFaceTable: Int32Array;
  /** 6 face ids per cube. */
  private readonly cubeFaceTable: Int32Array;
  /** Up to 2 cube ids per face, -1 padded. */
  private readonly faceCubeTable: Int32Array;

  constructor(n: GridSize) {
    this.n = n;
    this.edgesPerAxis = n * n * (n - 1);
    this.facesPerNormal = n * (n - 1) * (n - 1);
    this.edgeCount = 3 * this.edgesPerAxis;
    this.faceCount = 3 * this.facesPerNormal;
    this.cubeCount = (n - 1) ** 3;

    this.faceEdgeTable = new Int32Array(this.faceCount * 4);
    this.edgeFaceTable = new Int32Array(this.edgeCount * 4).fill(-1);
    this.cubeFaceTable = new Int32Array(this.cubeCount * 6);
    this.faceCubeTable = new Int32Array(this.faceCount * 2).fill(-1);

    this.buildFaceEdges();
    this.buildCubeFaces();
    this.invert(this.faceEdgeTable, 4, this.edgeFaceTable, 4);
    this.invert(this.cubeFaceTable, 6, this.faceCubeTable, 2);
  }

  // ---- id computation ----

  /** Edge along `axis` whose min corner is `o`; null if out of bounds. */
  edgeIdAt(axis: Axis, o: Point3): number | null {
    const { n } = this;
    for (const a of AXES) {
      const limit = a === axis ? n - 1 : n;
      const c = coord(o, a);
      if (c < 0 || c >= limit) return null;
    }
    const dx = axis === 0 ? n - 1 : n;
    const dy = axis === 1 ? n - 1 : n;
    return axis * this.edgesPerAxis + o.x + o.y * dx + o.z * dx * dy;
  }

  /** Face with normal `axis` whose min corner is `o`; null if out of bounds. */
  faceIdAt(axis: Axis, o: Point3): number | null {
    const { n } = this;
    for (const a of AXES) {
      const limit = a === axis ? n : n - 1;
      const c = coord(o, a);
      if (c < 0 || c >= limit) return null;
    }
    const dx = axis === 0 ? n : n - 1;
    const dy = axis === 1 ? n : n - 1;
    return axis * this.facesPerNormal + o.x + o.y * dx + o.z * dx * dy;
  }

  /** Cube whose min corner is `o`; null if out of bounds. */
  cubeIdAt(o: Point3): number | null {
    const m = this.n - 1;
    if (o.x < 0 || o.y < 0 || o.z < 0 || o.x >= m || o.y >= m || o.z >= m) return null;
    return o.x + o.y * m + o.z * m * m;
  }

  // ---- adjacency lookups ----

  faceEdges(faceId: number): number[] {
    return [...this.faceEdgeTable.subarray(faceId * 4, faceId * 4 + 4)];
  }

  edgeFaces(edgeId: number): number[] {
    return [...this.edgeFaceTable.subarray(edgeId * 4, edgeId * 4 + 4)].filter((f) => f !== -1);
  }

  cubeFaces(cubeId: number): number[] {
    return [...this.cubeFaceTable.subarray(cubeId * 6, cubeId * 6 + 6)];
  }

  faceCubes(faceId: number): number[] {
    return [...this.faceCubeTable.subarray(faceId * 2, faceId * 2 + 2)].filter((c) => c !== -1);
  }

  // ---- geometry for rendering / tooling ----

  edgeEndpoints(edgeId: number): [Point3, Point3] {
    const { axis, origin } = this.edgeParts(edgeId);
    return [origin, add(origin, UNIT[axis]!)];
  }

  edgeAxis(edgeId: number): Axis {
    return this.edgeParts(edgeId).axis;
  }

  faceCorners(faceId: number): [Point3, Point3, Point3, Point3] {
    const { normal, origin } = this.faceParts(faceId);
    const [u, v] = AXES.filter((a) => a !== normal) as [Axis, Axis];
    return [
      origin,
      add(origin, UNIT[u]!),
      add(add(origin, UNIT[u]!), UNIT[v]!),
      add(origin, UNIT[v]!),
    ];
  }

  faceNormal(faceId: number): Axis {
    return this.faceParts(faceId).normal;
  }

  cubeOrigin(cubeId: number): Point3 {
    const m = this.n - 1;
    return {
      x: cubeId % m,
      y: Math.floor(cubeId / m) % m,
      z: Math.floor(cubeId / (m * m)),
    };
  }

  // ---- internals ----

  private edgeParts(edgeId: number): { axis: Axis; origin: Point3 } {
    const { n } = this;
    const axis = Math.floor(edgeId / this.edgesPerAxis) as Axis;
    let i = edgeId % this.edgesPerAxis;
    const dx = axis === 0 ? n - 1 : n;
    const dy = axis === 1 ? n - 1 : n;
    const x = i % dx;
    i = Math.floor(i / dx);
    return { axis, origin: { x, y: i % dy, z: Math.floor(i / dy) } };
  }

  private faceParts(faceId: number): { normal: Axis; origin: Point3 } {
    const { n } = this;
    const normal = Math.floor(faceId / this.facesPerNormal) as Axis;
    let i = faceId % this.facesPerNormal;
    const dx = normal === 0 ? n : n - 1;
    const dy = normal === 1 ? n : n - 1;
    const x = i % dx;
    i = Math.floor(i / dx);
    return { normal, origin: { x, y: i % dy, z: Math.floor(i / dy) } };
  }

  private buildFaceEdges(): void {
    for (let f = 0; f < this.faceCount; f++) {
      const { normal, origin } = this.faceParts(f);
      const [u, v] = AXES.filter((a) => a !== normal) as [Axis, Axis];
      const edges = [
        this.edgeIdAt(u, origin),
        this.edgeIdAt(v, origin),
        this.edgeIdAt(u, add(origin, UNIT[v]!)),
        this.edgeIdAt(v, add(origin, UNIT[u]!)),
      ];
      edges.forEach((e, i) => {
        if (e === null) throw new Error(`face ${f} has out-of-bounds edge`);
        this.faceEdgeTable[f * 4 + i] = e;
      });
    }
  }

  private buildCubeFaces(): void {
    for (let c = 0; c < this.cubeCount; c++) {
      const origin = this.cubeOrigin(c);
      let i = 0;
      for (const a of AXES) {
        for (const offset of [origin, add(origin, UNIT[a]!)]) {
          const f = this.faceIdAt(a, offset);
          if (f === null) throw new Error(`cube ${c} has out-of-bounds face`);
          this.cubeFaceTable[c * 6 + i++] = f;
        }
      }
    }
  }

  /** Invert a dense (owner → members) table into a -1-padded reverse table. */
  private invert(forward: Int32Array, arity: number, reverse: Int32Array, revArity: number): void {
    const fill = new Int32Array(reverse.length / revArity);
    for (let owner = 0; owner < forward.length / arity; owner++) {
      for (let i = 0; i < arity; i++) {
        const member = forward[owner * arity + i]!;
        const slot = fill[member]!;
        if (slot >= revArity) throw new Error(`reverse table overflow at ${member}`);
        reverse[member * revArity + slot] = owner;
        fill[member] = slot + 1;
      }
    }
  }
}

const cache = new Map<GridSize, Lattice>();

/** Memoized lattice for a grid size — construction is O(n³), reuse is free. */
export function getLattice(n: GridSize): Lattice {
  let lat = cache.get(n);
  if (!lat) {
    lat = new Lattice(n);
    cache.set(n, lat);
  }
  return lat;
}

/**
 * The id of the edge between two dots, or null if the pair is not a valid
 * move (not unit-length, not axis-aligned, or outside the grid).
 */
export function edgeIdBetween(lat: Lattice, a: Point3, b: Point3): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) !== 1) return null;
  const axis: Axis = dx !== 0 ? 0 : dy !== 0 ? 1 : 2;
  const origin = coord(a, axis) < coord(b, axis) ? a : b;
  return lat.edgeIdAt(axis, origin);
}
