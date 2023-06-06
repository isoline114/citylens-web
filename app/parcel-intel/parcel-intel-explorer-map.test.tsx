import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParcelIntelRow } from '@/lib/api';

const harness = vi.hoisted(() => ({
  width: 800,
  height: 500,
  container: null as HTMLDivElement | null,
  events: {} as Record<string, () => void>,
  map: {
    getContainer: vi.fn(),
    getZoom: vi.fn(),
    getBounds: vi.fn(),
    fitBounds: vi.fn(),
    setView: vi.fn(),
    flyTo: vi.fn(),
    invalidateSize: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('react-leaflet', () => {
  const children = ({ children }: { children?: ReactNode }) => children ?? null;
  return {
    MapContainer: children,
    CircleMarker: ({ children, radius, pathOptions }: { children?: ReactNode; radius: number; pathOptions: { color?: string; fillColor?: string; fill?: boolean } }) => (
      <div data-testid="canvas-circle" data-radius={radius} data-stroke={pathOptions.color} data-fill={pathOptions.fillColor} data-ring={pathOptions.fill === false ? 'true' : 'false'}>{children}</div>
    ),
    Marker: children,
    Tooltip: children,
    GeoJSON: ({ style }: { style: { color: string } }) => <div data-testid="parcel-outline" data-stroke={style.color} />,
    TileLayer: () => null,
    useMap: () => harness.map,
    useMapEvents: (events: Record<string, () => void>) => {
      harness.events = events;
      return harness.map;
    },
  };
});

import { ParcelIntelExplorerMap } from './parcel-intel-explorer-map';

const row: ParcelIntelRow = {
  bbl: '3012340001',
  address: null,
  borough: 'brooklyn',
  lat: 40.68,
  lng: -73.95,
  priority_tier: 'high',
  opportunity_category: 'ground_up_candidate',
  score_calibrated: null,
  score_calibrated_p10: null,
  score_calibrated_p90: null,
  lot_area_sqft: null,
  allowed_far: null,
  max_floor_area_sqft: null,
  unused_floor_area_sqft: null,
  far_utilization_pct: null,
  zoning_district_1: null,
  land_use: null,
  year_built: null,
  num_floors: null,
  last_sale_price: null,
  last_sale_year: null,
  years_held: null,
  has_recent_sale_5yr: false,
  is_landmark: false,
  is_historic_district: false,
  block_id: null,
  block_rank: null,
  owner_name: null,
  top_features: [],
  redev_status: 'still_vacant',
};
const rows = [row];
const props = {
  rows,
  selectedBbl: null,
  overlay: 'priority' as const,
  inventoryScope: 'public_preview' as const,
  inventoryLoadedCount: 1,
  inventoryAvailableCount: 5_000,
  onSelect: vi.fn(),
};

let frameId = 0;
let frames: Map<number, FrameRequestCallback>;
let observers: Set<() => void>;

function flushFrames() {
  const queued = [...frames.values()];
  frames.clear();
  queued.forEach((callback) => callback(0));
}

function resize(width: number, height: number) {
  harness.width = width;
  harness.height = height;
  act(() => {
    observers.forEach((callback) => callback());
    flushFrames();
  });
}

beforeEach(() => {
  harness.width = 800;
  harness.height = 500;
  harness.container = document.createElement('div');
  Object.defineProperties(harness.container, {
    clientWidth: { get: () => harness.width },
    clientHeight: { get: () => harness.height },
  });
  harness.map.getContainer.mockReturnValue(harness.container);
  harness.map.getZoom.mockReturnValue(12);
  harness.map.getBounds.mockReturnValue({
    getWest: () => -74.25,
    getSouth: () => 40.47,
    getEast: () => -73.7,
    getNorth: () => 40.92,
  });
  frames = new Map();
  observers = new Set();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: () => void) {}
    observe() { observers.add(this.callback); }
    disconnect() { observers.delete(this.callback); }
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('parcel map visibility', () => {
  it('defers a selection made from mobile results until the map is visible', () => {
    const { rerender } = render(<ParcelIntelExplorerMap {...props} />);
    act(flushFrames);
    harness.map.setView.mockClear();
    harness.map.invalidateSize.mockClear();

    resize(0, 0);
    rerender(<ParcelIntelExplorerMap {...props} selectedBbl={row.bbl} />);
    act(flushFrames);
    expect(harness.map.setView).not.toHaveBeenCalled();
    expect(harness.map.flyTo).not.toHaveBeenCalled();
    expect(harness.map.invalidateSize).not.toHaveBeenCalled();

    resize(390, 500);
    expect(harness.map.invalidateSize).toHaveBeenCalledOnce();
    expect(harness.map.setView).toHaveBeenLastCalledWith(
      [row.lat, row.lng], 15, { animate: false },
    );
  });

  it('retains the last geographic ranking scope while its map is hidden', () => {
    const onViewportRowsChange = vi.fn();
    render(<ParcelIntelExplorerMap {...props} onViewportRowsChange={onViewportRowsChange} />);
    act(flushFrames);
    expect(onViewportRowsChange).toHaveBeenLastCalledWith([row.bbl]);
    onViewportRowsChange.mockClear();
    harness.map.getBounds.mockClear();

    resize(0, 0);
    act(() => {
      harness.events.moveend();
      harness.events.zoomend();
    });
    expect(harness.map.getBounds).not.toHaveBeenCalled();
    expect(onViewportRowsChange).not.toHaveBeenCalled();
  });

  it('fits a map first mounted in a hidden mobile pane once it opens', () => {
    harness.width = 0;
    harness.height = 0;
    render(<ParcelIntelExplorerMap {...props} />);
    act(flushFrames);
    expect(harness.map.setView).not.toHaveBeenCalled();
    expect(harness.map.invalidateSize).not.toHaveBeenCalled();

    resize(390, 500);
    expect(harness.map.setView).toHaveBeenLastCalledWith(
      [row.lat, row.lng], 15, { animate: false },
    );
  });
});

describe('rank map encoding', () => {
  it('renders every located parcel as a graduated ink dot without cluster controls', () => {
    const points = [
      { ...row, bbl: '3012340001', address: '10 EXAMPLE AVENUE', citywide_rank: 1 },
      { ...row, bbl: '3012340002', citywide_rank: 500 },
      { ...row, bbl: '3012340003', citywide_rank: 5000 },
      { ...row, bbl: '3012340004', lat: NaN },
    ];
    const { container } = render(<ParcelIntelExplorerMap {...props} rows={points} overlay="priority" />);
    const dots = screen.getAllByTestId('canvas-circle');
    expect(dots).toHaveLength(3);
    expect(dots.map((dot) => dot.dataset.radius)).toEqual(['5.5', '4.5', '3.5']);
    expect(dots[0]).toHaveAttribute('data-fill', 'rgb(20,23,28)');
    expect(dots[2]).toHaveAttribute('data-fill', 'rgb(120,126,135)');
    expect(container.querySelector('.parcel-map-cluster-icon')).toBeNull();
    expect(screen.getByText('10 Example Avenue')).toBeInTheDocument();
    expect(screen.getByTestId('parcel-map-inventory-scope')).toHaveTextContent('3 of 5,000 ranked parcels shown · public preview');
  });

  it('keeps the selected rank dot and adds a blue ring and parcel outline', () => {
    render(<ParcelIntelExplorerMap {...props} rows={[{ ...row, citywide_rank: 1 }]} overlay="priority" selectedBbl={row.bbl}
      selectedRow={{ ...row, parcel_geometry: { type: 'Polygon', coordinates: [] } }} />);
    const dots = screen.getAllByTestId('canvas-circle');
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute('data-fill', 'rgb(20,23,28)');
    expect(dots[1]).toHaveAttribute('data-ring', 'true');
    expect(dots[1]).toHaveAttribute('data-stroke', '#2150d0');
    expect(screen.getByTestId('parcel-outline')).toHaveAttribute('data-stroke', '#2150d0');
  });
});
