import type { ParcelIntelRow } from '@/lib/api';

export type Point = [number, number];
export type Bbox = [number, number, number, number];
export const IMAGE_WIDTH = 900;
export const IMAGE_HEIGHT = 600;
export function projectMercator(lng: number, lat: number): Point {
  const boundedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return [6378137 * lng * Math.PI / 180, 6378137 * Math.asinh(Math.tan(boundedLat * Math.PI / 180))];
}
export function geometryRings(geometry: ParcelIntelRow['parcel_geometry']): Point[][] {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.flatMap((polygon: unknown) => Array.isArray(polygon) ? polygon : []).filter((ring: unknown): ring is Point[] =>
    Array.isArray(ring) && ring.length >= 4 && ring.every((p: unknown) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90));
}
export function lotBbox(lots: ParcelIntelRow[]): Bbox | null {
  const points = lots.flatMap(lot => geometryRings(lot.parcel_geometry).flat().map(([lng, lat]) => projectMercator(lng, lat)));
  if (!points.length) return null;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = Math.max(180, (maxX - minX) * 2.4, (maxY - minY) * 2.4 * IMAGE_WIDTH / IMAGE_HEIGHT);
  const height = width * IMAGE_HEIGHT / IMAGE_WIDTH;
  return [(minX + maxX - width) / 2, (minY + maxY - height) / 2, (minX + maxX + width) / 2, (minY + maxY + height) / 2];
}
export function imagePoint(lng: number, lat: number, bbox: Bbox): Point {
  const [x, y] = projectMercator(lng, lat);
  return [(x - bbox[0]) / (bbox[2] - bbox[0]) * IMAGE_WIDTH, (bbox[3] - y) / (bbox[3] - bbox[1]) * IMAGE_HEIGHT];
}
export function lotPath(lot: ParcelIntelRow, bbox: Bbox): string {
  return geometryRings(lot.parcel_geometry).map(ring => ring.map(([lng, lat], i) => `${i ? 'L' : 'M'}${imagePoint(lng, lat, bbox).map(n => n.toFixed(2)).join(',')}`).join(' ') + ' Z').join(' ');
}
export function orthoUrl(bbox: Bbox): string {
  const params = new URLSearchParams({ bbox: bbox.join(','), bboxSR: '3857', imageSR: '3857', size: `${IMAGE_WIDTH},${IMAGE_HEIGHT}`, format: 'jpg', f: 'image' });
  return `https://orthos.its.ny.gov/arcgis/rest/services/wms/2024/MapServer/export?${params}`;
}
