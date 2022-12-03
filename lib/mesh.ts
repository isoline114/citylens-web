import * as THREE from 'three';

export type PlyVertex = [number, number, number];
export type PlyFace = number[];

export type PlyMesh = {
  vertices: PlyVertex[];
  faces: PlyFace[];
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
};

export function parseAsciiPly(text: string): PlyMesh | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if ((lines[0] ?? '').trim() !== 'ply') return null;

  let isAscii = false;
  let vertexCount = 0;
  let faceCount = 0;
  let headerEnd = -1;

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
    } else if (line.startsWith('element face ')) {
      const n = Number.parseInt(line.split(/\s+/)[2] ?? '', 10);
      if (Number.isFinite(n)) faceCount = n;
    }
  }

  if (!isAscii || headerEnd < 0 || vertexCount < 0 || faceCount < 0) return null;
  if (vertexCount === 0) return { vertices: [], faces: [] };

  const vertices: PlyVertex[] = [];
  const vertexLines = lines.slice(headerEnd + 1, headerEnd + 1 + vertexCount);
  if (vertexLines.length !== vertexCount) return null;
  for (const line of vertexLines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) return null;
    const x = Number.parseFloat(parts[0] ?? '');
    const y = Number.parseFloat(parts[1] ?? '');
    const z = Number.parseFloat(parts[2] ?? '');
    if (![x, y, z].every(Number.isFinite)) return null;
    vertices.push([x, y, z]);
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

  return { vertices, faces };
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
      }
    }
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return {
    geometry,
    vertexCount: mesh.vertices.length,
    faceCount: mesh.faces.length,
  };
}
