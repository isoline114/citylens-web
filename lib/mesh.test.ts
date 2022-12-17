import { describe, expect, it } from 'vitest';

import { buildCenteredMeshGeometry, parseAsciiPly, projectMesh } from '@/lib/mesh';

describe('mesh helpers', () => {
  it('parses a simple ASCII PLY mesh', () => {
    const mesh = parseAsciiPly(`ply
format ascii 1.0
element vertex 4
property float x
property float y
property float z
element face 2
property list uchar int vertex_indices
end_header
0 0 0
1 0 0
1 1 0
0 1 0
3 0 1 2
3 0 2 3
`);

    expect(mesh?.vertices).toHaveLength(4);
    expect(mesh?.faces).toHaveLength(2);
    expect(projectMesh(mesh ?? { vertices: [], faces: [] }).faces).toHaveLength(2);
    expect(buildCenteredMeshGeometry(mesh ?? { vertices: [], faces: [] })?.vertexCount).toBe(4);
  });

  it('parses an empty PLY mesh (0 vertices) as a valid empty mesh', () => {
    const mesh = parseAsciiPly(`ply
format ascii 1.0
element vertex 0
property float x
property float y
property float z
element face 0
property list uchar int vertex_indices
end_header
`);

    expect(mesh).not.toBeNull();
    expect(mesh?.vertices).toHaveLength(0);
    expect(mesh?.faces).toHaveLength(0);
  });

  it('parses per-vertex RGB and surfaces them on the geometry', () => {
    const mesh = parseAsciiPly(`ply
format ascii 1.0
element vertex 4
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
element face 2
property list uchar int vertex_indices
end_header
0 0 0 140 140 140
1 0 0 255 200 0
1 1 0 220 30 30
0 1 0 0 200 60
3 0 1 2
3 0 2 3
`);

    expect(mesh?.vertexColors).toHaveLength(4);
    expect(mesh?.vertexColors?.[0]).toEqual([140 / 255, 140 / 255, 140 / 255]);
    const scene = buildCenteredMeshGeometry(mesh ?? { vertices: [], faces: [] });
    expect(scene?.hasVertexColors).toBe(true);
    expect(scene?.geometry.getAttribute('color')).toBeTruthy();
  });

  it('keeps hasVertexColors false when the PLY has no color properties', () => {
    const mesh = parseAsciiPly(`ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
element face 1
property list uchar int vertex_indices
end_header
0 0 0
1 0 0
0 1 0
3 0 1 2
`);

    expect(mesh?.vertexColors).toBeUndefined();
    const scene = buildCenteredMeshGeometry(mesh ?? { vertices: [], faces: [] });
    expect(scene?.hasVertexColors).toBe(false);
    expect(scene?.geometry.getAttribute('color')).toBeUndefined();
  });
});
