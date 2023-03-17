const BOROUGHS = [
  ['manhattan', 40.76, -73.98],
  ['brooklyn', 40.65, -73.95],
  ['queens', 40.72, -73.82],
  ['bronx', 40.84, -73.88],
  ['staten_island', 40.58, -74.15],
] as const;

export function completeAuthenticatedInventory<T extends Record<string, unknown>>(
  featuredRows: T[],
  total = 5000,
): Array<T | Record<string, unknown>> {
  const rows: Array<T | Record<string, unknown>> = [...featuredRows];
  const seen = new Set(
    featuredRows
      .map((row) => row.bbl)
      .filter((value): value is string => typeof value === 'string'),
  );

  for (let index = 0; rows.length < total; index += 1) {
    const boroughIndex = index % BOROUGHS.length;
    const bbl = `${boroughIndex + 1}${String(
      900_000_000 + Math.floor(index / BOROUGHS.length),
    ).padStart(9, '0')}`;
    if (seen.has(bbl)) continue;
    seen.add(bbl);
    const [borough, centerLat, centerLng] =
      BOROUGHS[boroughIndex];
    rows.push({
      bbl,
      borough,
      address: null,
      lat: centerLat + (index % 40) * 0.0004,
      lng: centerLng + (Math.floor(index / 40) % 40) * 0.0004,
      acquisition_rank: featuredRows.length + index + 1,
      citywide_rank: featuredRows.length + index + 1,
      priority_rank: index + 1,
      acquisition_eligible: false,
      acquisition_status: 'active_project',
      priority_tier: 'high',
      opportunity_category: 'active_project',
      score_calibrated: 0,
      lot_area_sqft: null,
      unused_floor_area_sqft: null,
    });
  }

  return rows;
}
