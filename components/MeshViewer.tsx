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
        color: hasVertexColors ? '#ffffff' : '#38bdf8',
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
      <div className="flex h-96 items-center justify-center border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600">
        Mesh data is empty or unsupported. Download the file to inspect it locally.
      </div>
    );
  }

  return (
    <div className="relative h-96 overflow-hidden rounded-b-lg bg-slate-950" data-testid="mesh-ready">
      <Canvas
        className="h-full w-full"
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
      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-950/70 px-3 py-1 text-xs text-slate-100 backdrop-blur">
        Drag to orbit, scroll to zoom, right-drag to pan
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-slate-950/70 px-3 py-2 text-xs text-slate-100 backdrop-blur">
        <div className="flex items-center gap-2">
          <Move3D className="h-3.5 w-3.5" />
          <span>{scene.vertexCount} vertices</span>
          <span>•</span>
          <span>{scene.faceCount} faces</span>
        </div>
      </div>
      {hasVertexColors && (
        <div className="pointer-events-none absolute right-3 bottom-3 rounded-md bg-slate-950/70 px-3 py-2 text-[11px] text-slate-100 backdrop-blur">
          <div className="font-medium">Change overlay</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#8c8c8c]" /> unchanged</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#ffc800]" /> modified</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#dc1e1e]" /> demolished</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#00c83c]" /> added</span>
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
          className="flex h-96 items-center justify-center border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600"
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
          className="flex h-48 items-center justify-center border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600"
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
          className="rounded-b-lg border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-800"
          data-testid="mesh-error"
        >
          <div className="flex items-center gap-2 font-medium">
            <TriangleAlert className="h-4 w-4" />
            Mesh viewer could not render this file.
          </div>
          <div className="mt-2 whitespace-pre-wrap text-rose-700">{error}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50"
              data-testid="mesh-error-download"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="h-4 w-4" />
              Download mesh.ply
            </a>
            <span className="text-xs text-rose-700">Use the download if your browser cannot render the mesh.</span>
          </div>
        </div>
      );
    }

    if (!mesh) {
      return (
        <div
          className="flex h-96 items-center justify-center border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600"
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
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white" data-testid="mesh-viewer">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">mesh.ply</div>
          <div
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
            data-testid="mesh-status"
          >
            {status}
          </div>
        </div>
        <a
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          data-testid="mesh-viewer-download"
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
