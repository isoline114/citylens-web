import { z } from 'zod';

// Server-locked run options for the public MVP. Match
// citylens-engine/api/app/services/run_options.py — fields the server forbids
// (aoi_radius_m, sam2_*, orthophoto_*) must NOT appear in the public payload.
export const segmentationBackendSchema = z.literal('sam2');
export const outputsSchema = z.array(z.enum(['previews', 'change', 'mesh'])).min(1);

export const CITYLENS_SUPPORTED_IMAGERY_YEAR = 2024 as const;
export const CITYLENS_SUPPORTED_BASELINE_YEAR = 2017 as const;
// Server-side fixed AOI radius. Public clients do NOT send this; the engine
// injects it when materializing the canonical CitylensRequest.
export const CITYLENS_DEFAULT_AOI_RADIUS_M = 250 as const;

export const citylensCreateRunSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  imagery_year: z.literal(CITYLENS_SUPPORTED_IMAGERY_YEAR).default(CITYLENS_SUPPORTED_IMAGERY_YEAR),
  baseline_year: z.literal(CITYLENS_SUPPORTED_BASELINE_YEAR).default(CITYLENS_SUPPORTED_BASELINE_YEAR),
  segmentation_backend: segmentationBackendSchema.default('sam2'),
  outputs: outputsSchema.default(['previews', 'change', 'mesh']),
  notes: z.string().optional(),
});

export type CitylensCreateRunInput = z.infer<typeof citylensCreateRunSchema>;

// Payload sent to the backend. Currently identical to the input — the engine
// rejects any extra fields in POST /v1/runs.
export type CitylensCreateRunPayload = CitylensCreateRunInput;

export function buildCitylensCreateRunPayload(input: CitylensCreateRunInput): CitylensCreateRunPayload {
  return { ...input };
}
