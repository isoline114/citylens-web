import { describe, expect, it } from 'vitest';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

import { boundsFromGeojson, getGeojsonChangeKindCounts, getGeojsonCoordinateSpace } from '@/lib/geojson';

describe('geojson helpers', () => {
  it('detects pixel-space GeoJSON', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { crs: 'pixel', kind: 'added' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
          },
        },
      ],
    };

    expect(getGeojsonCoordinateSpace(fc)).toBe('pixel');
  });

  it('computes geographic bounds when coordinates exist', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[10, 20], [15, 20], [15, 30], [10, 30], [10, 20]]],
          },
        },
      ],
    };

    expect(boundsFromGeojson(fc)).toEqual({ sw: [20, 10], ne: [30, 15] });
  });

  it('counts change kinds for the legend', () => {
    const degeneratePolygon: Geometry = {
      type: 'Polygon',
      coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0]]],
    };
    const makeFeature = (kind: string): Feature<Geometry> => ({
      type: 'Feature',
      properties: { kind },
      geometry: degeneratePolygon,
    });

    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        makeFeature('added'),
        makeFeature('removed'),
        makeFeature('unknown'),
      ],
    };

    expect(getGeojsonChangeKindCounts(fc)).toEqual({ added: 1, removed: 1, other: 1 });
  });
});
