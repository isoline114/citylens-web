export type CitylensArtifactName = 'preview.png' | 'change.geojson' | 'mesh.ply' | 'run_summary.json';

export type ArtifactRecord = {
  // The backend may include different fields; only `signed_url` is relied on for downloads.
  signed_url?: string;
  url?: string;
  gcs_uri?: string;
  content_type?: string;
  size_bytes?: number;
  sha256?: string;
  name?: string;
} & Record<string, unknown>;

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | (string & {});

export type RunResponse = {
  run_id?: string;
  id?: string;
  status?: RunStatus;
  stage?: string;
  progress?: number;
  created_at?: string;
  updated_at?: string;
  error?: string;
  request?: Record<string, unknown>;
  artifacts?: Record<string, ArtifactRecord>;
} & Record<string, unknown>;

export type CreateRunResponse = {
  run_id?: string;
  id?: string;
  runId?: string;
} & Record<string, unknown>;
