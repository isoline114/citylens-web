import { z } from 'zod';

// UI schema for creating runs.
// Note: CitylensRequest in citylens-core includes aoi_radius_m, but the MVP UI does not expose it.
// We inject a fixed default into the request payload internally.
export const segmentationBackendSchema = z.enum(['unet', 'smp', 'sam2']);
export const outputsSchema = z.array(z.enum(['previews', 'change', 'mesh'])).min(1);

export const CITYLENS_DEFAULT_AOI_RADIUS_M = 250 as const;

export const citylensCreateRunSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  imagery_year: z.number().int().min(1990).max(2100).default(2024),
  baseline_year: z.number().int().min(1990).max(2100).default(2017),
  segmentation_backend: segmentationBackendSchema.default('sam2'),
  // Optional in CitylensRequest (defaults exist server-side).
  sam2_cfg: z.string().min(1).optional(),
  sam2_checkpoint: z.string().min(1).optional(),
  outputs: outputsSchema.default(['previews', 'change', 'mesh']),
  notes: z.string().optional(),
});

export type CitylensCreateRunInput = z.infer<typeof citylensCreateRunSchema>;

// Payload sent to the backend.
export type CitylensCreateRunPayload = CitylensCreateRunInput & {
  aoi_radius_m: number;
};

export function buildCitylensCreateRunPayload(input: CitylensCreateRunInput): CitylensCreateRunPayload {
  return {
    ...input,
    // TODO: Remove once backend schema no longer requires aoi_radius_m.
    aoi_radius_m: CITYLENS_DEFAULT_AOI_RADIUS_M,
  };
}
