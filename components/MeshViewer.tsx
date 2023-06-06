'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as OrbitControlsImpl } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
import { AlertTriangle, Download, Loader2, Move3D, TriangleAlert } from 'lucide-react';

import { buildCenteredMeshGeometry, parseAsciiPly, type PlyMesh } from '@/lib/mesh';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function OrbitControls() {
  const { camera, gl } = useThree();
  const ref = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    const controls = new OrbitControlsImpl(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.75;
    controls.maxDistance = 10;
    ref.current = controls;
    return () => {
      controls.dispose();
      ref.current = null;
    };
  }, [camera, gl]);

  useFrame(() => {
    ref.current?.update();
  });

  return null;
}

function MeshScene({ mesh }: { mesh: PlyMesh }) {
  const scene = useMemo(() => buildCenteredMeshGeometry(mesh), [mesh]);
  // When the PLY carries per-vertex RGB, the change-detection palette is
  // already encoded on the mesh (gray=unchanged, yellow=modified,
  // red=demolished, green=added — see citylens-core stage_render).
  // We let the buffer geometry's color attribute drive shading and skip
  // the flat fallback fill. Without colors we fall back to sky-blue.
  const hasVertexColors = scene?.hasVertexColors ?? false;
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // Untextured meshes render in neutral gray so only change classes carry color.
        color: hasVertexColors ? '#ffffff' : '#9aa0a8',
        vertexColors: hasVertexColors,
        roughness: 0.45,
        metalness: 0.08,
        flatShading: true,
      }),
    [hasVertexColors],
  );

  useEffect(() => {
    return () => {
      scene?.geometry.dispose();
      material.dispose();
    };
  }, [material, scene]);

  if (!scene) {
    return (
      <div className="flex h-96 items-center justify-center border border-rule bg-paper-2 px-4 text-sm text-ink-2">
        Mesh data is empty or unsupported. Download the file to inspect it locally.
      </div>
    );
  }

  return (
    <div className="relative min-h-96 overflow-hidden" data-testid="mesh-ready">
      <Canvas
        className="!h-96 w-full"
        camera={{ position: [0, 0, 3.2], fov: 40, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#020617']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 6]} intensity={1.8} />
        <directionalLight position={[-3, -4, -2]} intensity={0.4} />
        <OrbitControls />
        <group>
          <mesh geometry={scene.geometry} castShadow receiveShadow>
            <primitive object={material} attach="material" />
          </mesh>
        </group>
      </Canvas>
      <div className="border-t border-rule bg-white px-4 py-2 text-xs text-ink-2">
        Drag to orbit, scroll to zoom, right-drag to pan
      </div>
      <div className="border-t border-rule bg-white px-4 py-2 font-mono text-xs tabular-nums text-ink-3">
        <div className="flex items-center gap-2">
          <Move3D className="h-3.5 w-3.5" />
          <span>{scene.vertexCount} vertices</span>
          <span>•</span>
          <span>{scene.faceCount} faces</span>
        </div>
      </div>
      {hasVertexColors && (
        <div className="border-t border-rule bg-white px-4 py-2 text-xs text-ink-2">
          <div className="font-medium">Model-detected change</div>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#00c83c]" /> Added</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#dc1e1e]" /> Demolished</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#ffc800]" /> Modified</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#8c8c8c]" /> Unchanged</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function MeshViewer({ url }: { url: string }) {
  const [mesh, setMesh] = useState<PlyMesh | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      setMesh(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`PLY fetch failed (${res.status})`);
        const text = await res.text();
        const parsed = parseAsciiPly(text);
        if (!parsed) {
          throw new Error('Unsupported PLY format. The browser viewer currently supports ASCII PLY meshes only.');
        }
        if (!cancelled) setMesh(parsed);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const isEmptyMesh = mesh !== null && mesh.vertices.length === 0;
  const status = loading ? 'Loading' : error ? 'Error' : isEmptyMesh ? 'Empty' : mesh ? 'Ready' : 'Unavailable';

  const statusBody = useMemo(() => {
    if (loading) {
      return (
        <div
          className="flex h-96 items-center justify-center border border-rule bg-paper-2 px-4 text-sm text-ink-2"
          data-testid="mesh-loading"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading mesh…
        </div>
      );
    }

    if (isEmptyMesh) {
      return (
        <div
          className="flex h-48 items-center justify-center border border-rule bg-paper-2 px-4 text-sm text-ink-2"
          data-testid="mesh-empty"
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Mesh is empty (0 vertices). Regenerate this run before using the 3D
          output.
        </div>
      );
    }

    if (error) {
      return (
        <div
          className="rounded-sm border border-rule bg-white px-4 py-6 text-sm text-red-700"
          data-testid="mesh-error"
        >
          <div className="flex items-center gap-2 font-medium">
            <TriangleAlert className="h-4 w-4" />
            Mesh viewer could not render this file.
          </div>
          <div className="mt-2 whitespace-pre-wrap text-red-700">{error}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              className="inline-flex items-center gap-2 rounded-sm border border-control bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-white"
              data-testid="mesh-error-download"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="h-4 w-4" />
              Download mesh.ply
            </a>
            <span className="text-xs text-red-700">Use the download if your browser cannot render the mesh.</span>
          </div>
        </div>
      );
    }

    if (!mesh) {
      return (
        <div
          className="flex h-96 items-center justify-center border border-rule bg-paper-2 px-4 text-sm text-ink-2"
          data-testid="mesh-unavailable"
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Mesh data is unavailable.
        </div>
      );
    }

    return (
      <ErrorBoundary
        title="mesh.ply"
        message="The mesh viewer could not be rendered."
        testId="mesh-boundary-error"
      >
        <MeshScene mesh={mesh} />
      </ErrorBoundary>
    );
  }, [error, loading, mesh, url, isEmptyMesh]);

  return (
    <div className="overflow-hidden border-t border-rule bg-white" data-testid="mesh-viewer">
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">mesh.ply</div>
          <div
            className="text-xs text-ink-2"
            data-testid="mesh-status"
          >
            {status}
          </div>
        </div>
        <a
          className="inline-flex items-center gap-2 text-sm text-ink-2 hover:text-ink"
          data-testid="artifact-mesh-download"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
      {statusBody}
    </div>
  );
}
