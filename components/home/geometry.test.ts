import { describe, expect, it } from 'vitest';
import type { ParcelIntelRow } from '@/lib/api';
import { IMAGE_HEIGHT, IMAGE_WIDTH, imagePoint, lotBbox, lotPath, orthoUrl, projectMercator } from './geometry';
const lot = { parcel_geometry: { type: 'Polygon', coordinates: [[[-74, 40.7], [-73.999, 40.7], [-73.999, 40.701], [-74, 40.7]]] } } as unknown as ParcelIntelRow;
describe('homepage aerial geometry', () => {
  it('projects known positions into Web Mercator metres', () => {
    expect(projectMercator(0, 0)).toEqual([0, 0]);
    expect(projectMercator(180, 0)[0]).toBeCloseTo(20037508.342789, 4);
    expect(projectMercator(-74, 40.7)[1]).toBeCloseTo(4968191.930188, 3);
    expect(Number.isFinite(projectMercator(0, 90)[1])).toBe(true);
  });
  it('uses the same 3:2 frame for image pixels, bbox and polygon paths', () => {
    const bbox = lotBbox([lot])!;
    expect((bbox[2] - bbox[0]) / (bbox[3] - bbox[1])).toBeCloseTo(IMAGE_WIDTH / IMAGE_HEIGHT);
    expect(lotPath(lot, bbox)).toMatch(/^M[\d.,]+ L[\d.,]+ L[\d.,]+ L[\d.,]+ Z$/);
    const p = imagePoint(-74, 40.7, bbox);
    expect(p[0]).toBeGreaterThan(0); expect(p[0]).toBeLessThan(IMAGE_WIDTH);
    expect(p[1]).toBeGreaterThan(0); expect(p[1]).toBeLessThan(IMAGE_HEIGHT);
    const params = new URL(orthoUrl(bbox)).searchParams;
    expect(params.get('bbox')).toBe(bbox.join(',')); expect(params.get('imageSR')).toBe('3857'); expect(params.get('size')).toBe('900,600');
  });
  it('encloses all partner polygons and supports MultiPolygon holes', () => {
    const partner = { parcel_geometry: { type: 'MultiPolygon', coordinates: [[[[ -74.01, 40.71], [-74.009, 40.71], [-74.009, 40.711], [-74.01, 40.71]]]] } } as unknown as ParcelIntelRow;
    const bbox = lotBbox([lot, partner])!;
    for (const [lng, lat] of [[-74, 40.7], [-74.01, 40.71]]) { const point = imagePoint(lng, lat, bbox); expect(point[0]).toBeGreaterThan(0); expect(point[1]).toBeLessThan(IMAGE_HEIGHT); }
    expect(lotPath(partner, bbox)).toContain(' Z');
  });
  it('fails safely for absent or malformed geometry', () => {
    expect(lotBbox([])).toBeNull();
    expect(lotBbox([{ parcel_geometry: { type: 'Polygon', coordinates: [[[NaN, 0]]] } } as unknown as ParcelIntelRow])).toBeNull();
  });
});
