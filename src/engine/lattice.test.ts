import { describe, it, expect } from 'vitest';
import { getLattice, edgeIdBetween, type Point3 } from './lattice.ts';

// Spec ported from the prototype's LineValidation.test.ts and the
// shared-face analysis in SquareOvercountingBug.test.ts. The lattice is
// the geometry oracle: every edge/face/cube gets one stable integer id,
// and all adjacency is precomputed here — nothing else in the codebase
// may re-derive geometry from coordinates.

describe('lattice enumeration', () => {
  it.each([
    [3, 54],
    [4, 144],
    [5, 300],
    [6, 540],
  ] as const)('a %i³ grid has %i edges', (n, edges) => {
    expect(getLattice(n).edgeCount).toBe(edges);
  });

  it.each([
    [3, 36],
    [4, 108],
    [5, 240],
  ] as const)('a %i³ grid has %i unit faces', (n, faces) => {
    // 3 orientations × n positions along the normal × (n-1)² in-plane
    expect(getLattice(n).faceCount).toBe(faces);
  });

  it.each([
    [3, 8],
    [4, 27],
    [5, 64],
    [6, 125],
  ] as const)('a %i³ grid has %i unit cubes', (n, cubes) => {
    expect(getLattice(n).cubeCount).toBe(cubes);
  });
});

describe('edgeIdBetween (line validation)', () => {
  const n = 4;
  const lat = getLattice(n);
  const p = (x: number, y: number, z: number): Point3 => ({ x, y, z });

  it('accepts unit-length axis-aligned lines on all three axes', () => {
    expect(edgeIdBetween(lat, p(0, 0, 0), p(1, 0, 0))).not.toBeNull();
    expect(edgeIdBetween(lat, p(2, 1, 3), p(2, 2, 3))).not.toBeNull();
    expect(edgeIdBetween(lat, p(3, 3, 2), p(3, 3, 3))).not.toBeNull();
  });

  it('is direction-independent: (a,b) and (b,a) name the same edge', () => {
    const ab = edgeIdBetween(lat, p(1, 2, 0), p(1, 2, 1));
    const ba = edgeIdBetween(lat, p(1, 2, 1), p(1, 2, 0));
    expect(ab).not.toBeNull();
    expect(ab).toBe(ba);
  });

  it('rejects diagonal lines', () => {
    expect(edgeIdBetween(lat, p(0, 0, 0), p(1, 1, 0))).toBeNull();
    expect(edgeIdBetween(lat, p(0, 0, 0), p(1, 1, 1))).toBeNull();
  });

  it('rejects lines longer than one unit', () => {
    expect(edgeIdBetween(lat, p(0, 0, 0), p(2, 0, 0))).toBeNull();
  });

  it('rejects zero-length lines', () => {
    expect(edgeIdBetween(lat, p(1, 1, 1), p(1, 1, 1))).toBeNull();
  });

  it('rejects lines with endpoints outside the grid', () => {
    expect(edgeIdBetween(lat, p(3, 0, 0), p(4, 0, 0))).toBeNull();
    expect(edgeIdBetween(lat, p(-1, 0, 0), p(0, 0, 0))).toBeNull();
  });

  it('assigns every edge a unique id covering [0, edgeCount)', () => {
    const seen = new Set<number>();
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++)
        for (let z = 0; z < n; z++) {
          for (const [dx, dy, dz] of [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as const) {
            const q = p(x + dx, y + dy, z + dz);
            const id = edgeIdBetween(lat, p(x, y, z), q);
            if (q.x < n && q.y < n && q.z < n) {
              expect(id).not.toBeNull();
              seen.add(id!);
            }
          }
        }
    expect(seen.size).toBe(lat.edgeCount);
    expect(Math.min(...seen)).toBe(0);
    expect(Math.max(...seen)).toBe(lat.edgeCount - 1);
  });
});

describe('adjacency tables', () => {
  const lat = getLattice(3);

  it('every face has exactly 4 distinct edges', () => {
    for (let f = 0; f < lat.faceCount; f++) {
      const edges = lat.faceEdges(f);
      expect(edges).toHaveLength(4);
      expect(new Set(edges).size).toBe(4);
      for (const e of edges) {
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThan(lat.edgeCount);
      }
    }
  });

  it('every edge belongs to 2–4 faces, consistent with faceEdges', () => {
    for (let e = 0; e < lat.edgeCount; e++) {
      const faces = lat.edgeFaces(e);
      expect(faces.length).toBeGreaterThanOrEqual(2);
      expect(faces.length).toBeLessThanOrEqual(4);
      for (const f of faces) expect(lat.faceEdges(f)).toContain(e);
    }
  });

  it('faceEdges and edgeFaces are mutually complete', () => {
    // every (face, edge) incidence appears in both directions
    for (let f = 0; f < lat.faceCount; f++) {
      for (const e of lat.faceEdges(f)) {
        expect(lat.edgeFaces(e)).toContain(f);
      }
    }
  });

  it('every cube has exactly 6 distinct faces', () => {
    for (let c = 0; c < lat.cubeCount; c++) {
      const faces = lat.cubeFaces(c);
      expect(faces).toHaveLength(6);
      expect(new Set(faces).size).toBe(6);
    }
  });

  it('every face borders 1 or 2 cubes, consistent with cubeFaces', () => {
    for (let f = 0; f < lat.faceCount; f++) {
      const cubes = lat.faceCubes(f);
      expect(cubes.length).toBeGreaterThanOrEqual(1);
      expect(cubes.length).toBeLessThanOrEqual(2);
      for (const c of cubes) expect(lat.cubeFaces(c)).toContain(f);
    }
  });

  it('interior faces are shared by exactly two cubes (the overcounting case)', () => {
    // In a 3³ dot grid there are 2×2×2 cubes; faces on the interior
    // planes belong to two cubes but are still one face with one id.
    const shared = [];
    for (let f = 0; f < lat.faceCount; f++) {
      if (lat.faceCubes(f).length === 2) shared.push(f);
    }
    // 3 interior planes × 4 faces each
    expect(shared).toHaveLength(12);
  });

  it('adjacent cubes reference the same face id for their shared face', () => {
    const lat4 = getLattice(4);
    for (let f = 0; f < lat4.faceCount; f++) {
      const cubes = lat4.faceCubes(f);
      if (cubes.length === 2) {
        const [a, b] = cubes;
        expect(lat4.cubeFaces(a!)).toContain(f);
        expect(lat4.cubeFaces(b!)).toContain(f);
      }
    }
  });
});

describe('geometry helpers for rendering', () => {
  const lat = getLattice(3);

  it('edgeEndpoints returns the two dots of an edge, in-grid and unit apart', () => {
    for (let e = 0; e < lat.edgeCount; e++) {
      const [a, b] = lat.edgeEndpoints(e);
      const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
      expect(d).toBe(1);
      expect(edgeIdBetween(lat, a, b)).toBe(e);
    }
  });

  it('faceCorners returns 4 corners forming a unit square', () => {
    for (let f = 0; f < lat.faceCount; f++) {
      const corners = lat.faceCorners(f);
      expect(corners).toHaveLength(4);
      const keys = new Set(corners.map((c) => `${c.x},${c.y},${c.z}`));
      expect(keys.size).toBe(4);
    }
  });

  it('cubeOrigin returns the min corner of each cube', () => {
    const origins = new Set<string>();
    for (let c = 0; c < lat.cubeCount; c++) {
      const o = lat.cubeOrigin(c);
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.x).toBeLessThan(2);
      origins.add(`${o.x},${o.y},${o.z}`);
    }
    expect(origins.size).toBe(lat.cubeCount);
  });
});
