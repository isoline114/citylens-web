import * as THREE from 'three';

export type PlyVertex = [number, number, number];
export type PlyVertexColor = [number, number, number]; // 0..1 floats
export type PlyFace = number[];

export type PlyMesh = {
  vertices: PlyVertex[];
  faces: PlyFace[];
  /** Per-vertex sRGB color in 0..1, when the source PLY had `red/green/blue`
   *  uchar properties. Undefined when the source has only positions —
   *  callers fall back to a flat material color. */
  vertexColors?: PlyVertexColor[];
};

export type ProjectedFace = {
  points: Array<{ x: number; y: number }>;
};

export type ProjectedMesh = {
  faces: ProjectedFace[];
  vertexCount: number;
  faceCount: number;
};

export type MeshSceneData = {
  geometry: THREE.BufferGeometry;
  vertexCount: number;
  faceCount: number;
  /** True when the source PLY supplied per-vertex RGB and the geometry
   *  has a populated `color` attribute. The mesh material should set
   *  `vertexColors: true` and skip its flat fallback color in this case. */
  hasVertexColors: boolean;
};

export function parseAsciiPly(text: string): PlyMesh | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if ((lines[0] ?? '').trim() !== 'ply') return null;

  let isAscii = false;
  let vertexCount = 0;
  let faceCount = 0;
  let headerEnd = -1;
  // Order of vertex properties as declared in the header. Used to find
  // x/y/z and (optionally) red/green/blue offsets in each vertex line.
  const vertexProps: string[] = [];
  let inVertexElement = false;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line === 'end_header') {
      headerEnd = i;
      break;
    }
    if (line.startsWith('format ')) {
      isAscii = line.includes('ascii');
    } else if (line.startsWith('element vertex ')) {
      const n = Number.parseInt(line.split(/\s+/)[2] ?? '', 10);
      if (Number.isFinite(n)) vertexCount = n;
      inVertexElement = true;
    } else if (line.startsWith('element ')) {
      // Any other element ends the vertex-property block.
      inVertexElement = false;
      if (line.startsWith('element face ')) {
        const n = Number.parseInt(line.split(/\s+/)[2] ?? '', 10);
        if (Number.isFinite(n)) faceCount = n;
      }
    } else if (inVertexElement && line.startsWith('property ')) {
      // `property <type> <name>` — we only care about the name here.
      const parts = line.split(/\s+/);
      const name = parts[parts.length - 1];
      if (name) vertexProps.push(name);
    }
  }

  if (!isAscii || headerEnd < 0 || vertexCount < 0 || faceCount < 0) return null;
  if (vertexCount === 0) return { vertices: [], faces: [] };

  const xIdx = vertexProps.indexOf('x');
  const yIdx = vertexProps.indexOf('y');
  const zIdx = vertexProps.indexOf('z');
  const rIdx = vertexProps.indexOf('red');
  const gIdx = vertexProps.indexOf('green');
  const bIdx = vertexProps.indexOf('blue');
  const hasColor = rIdx >= 0 && gIdx >= 0 && bIdx >= 0;

  if (xIdx < 0 || yIdx < 0 || zIdx < 0) return null;

  const vertices: PlyVertex[] = [];
  const vertexColors: PlyVertexColor[] | null = hasColor ? [] : null;
  const vertexLines = lines.slice(headerEnd + 1, headerEnd + 1 + vertexCount);
  if (vertexLines.length !== vertexCount) return null;
  for (const line of vertexLines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < vertexProps.length) return null;
    const x = Number.parseFloat(parts[xIdx] ?? '');
    const y = Number.parseFloat(parts[yIdx] ?? '');
    const z = Number.parseFloat(parts[zIdx] ?? '');
    if (![x, y, z].every(Number.isFinite)) return null;
    vertices.push([x, y, z]);
    if (vertexColors) {
      const r = Number.parseInt(parts[rIdx] ?? '', 10);
      const g = Number.parseInt(parts[gIdx] ?? '', 10);
      const b = Number.parseInt(parts[bIdx] ?? '', 10);
      if (![r, g, b].every(Number.isFinite)) return null;
      vertexColors.push([r / 255, g / 255, b / 255]);
    }
  }

  const faces: PlyFace[] = [];
  const faceLines = lines.slice(headerEnd + 1 + vertexCount, headerEnd + 1 + vertexCount + faceCount);
  if (faceLines.length < faceCount) return null;
  for (const line of faceLines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) return null;
    const count = Number.parseInt(parts[0] ?? '', 10);
    if (!Number.isFinite(count) || count < 3 || parts.length < count + 1) return null;
    const indices = parts.slice(1, count + 1).map((part) => Number.parseInt(part, 10));
    if (indices.some((idx) => !Number.isFinite(idx) || idx < 0 || idx >= vertices.length)) return null;
    faces.push(indices);
  }

  return vertexColors
    ? { vertices, faces, vertexColors }
    : { vertices, faces };
}

function rotatePoint([x, y, z]: PlyVertex, yawDeg: number, pitchDeg: number): [number, number] {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  const x1 = x * cosYaw + z * sinYaw;
  const z1 = -x * sinYaw + z * cosYaw;
  const y1 = y;

  const y2 = y1 * cosPitch - z1 * sinPitch;
  return [x1, y2];
}

export function projectMesh(
  mesh: PlyMesh,
  opts?: { yawDeg?: number; pitchDeg?: number },
): ProjectedMesh {
  const yawDeg = opts?.yawDeg ?? 35;
  const pitchDeg = opts?.pitchDeg ?? 25;

  const projectedVertices = mesh.vertices.map((vertex) => rotatePoint(vertex, yawDeg, pitchDeg));
  const xs = projectedVertices.map(([x]) => x);
  const ys = projectedVertices.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);

  return {
    vertexCount: mesh.vertices.length,
    faceCount: mesh.faces.length,
    faces: mesh.faces.map((face) => ({
      points: face.map((index) => {
        const [x, y] = projectedVertices[index] ?? [0, 0];
        return {
          x: ((x - minX) / spanX) * 100,
          y: 100 - ((y - minY) / spanY) * 100,
        };
      }),
    })),
  };
}

export function buildCenteredMeshGeometry(mesh: PlyMesh): MeshSceneData | null {
  if (mesh.vertices.length === 0 || mesh.faces.length === 0) return null;

  const xs = mesh.vertices.map((v) => v[0]);
  const ys = mesh.vertices.map((v) => v[1]);
  const zs = mesh.vertices.map((v) => v[2]);
  const min = [Math.min(...xs), Math.min(...ys), Math.min(...zs)];
  const max = [Math.max(...xs), Math.max(...ys), Math.max(...zs)];
  const center: PlyVertex = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const spans = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const scale = 2 / Math.max(...spans, 1e-6);

  const positions: number[] = [];
  const colors: number[] = [];
  const hasColor = Array.isArray(mesh.vertexColors) && mesh.vertexColors.length === mesh.vertices.length;
  for (const face of mesh.faces) {
    if (face.length < 3) continue;
    const [first, ...rest] = face;
    if (typeof first !== 'number' || rest.length < 2) continue;
    for (let i = 0; i < rest.length - 1; i += 1) {
      const tri = [first, rest[i], rest[i + 1]];
      for (const index of tri) {
        const vertex = mesh.vertices[index];
        if (!vertex) continue;
        positions.push(
          (vertex[0] - center[0]) * scale,
          (vertex[1] - center[1]) * scale,
          (vertex[2] - center[2]) * scale,
        );
        if (hasColor) {
          const c = mesh.vertexColors![index] ?? [1, 1, 1];
          colors.push(c[0], c[1], c[2]);
        }
      }
    }
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (hasColor && colors.length === positions.length) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return {
    geometry,
    vertexCount: mesh.vertices.length,
    faceCount: mesh.faces.length,
    hasVertexColors: hasColor && colors.length === positions.length,
  };
}
