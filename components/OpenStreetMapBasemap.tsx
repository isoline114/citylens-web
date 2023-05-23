'use client';

import { TileLayer } from 'react-leaflet';

/** Shared, key-free basemap for parcel exploration and change geometry. */
export function OpenStreetMapBasemap() {
  return (
    <TileLayer
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      maxNativeZoom={19}
      maxZoom={19}
    />
  );
}
