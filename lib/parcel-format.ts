/**
 * Display helpers for NYC parcel identity. Values stay as the API sends them;
 * these only change how they are written on screen.
 */

const SMALL_WORDS = new Set(['of', 'and', 'the', 'at', 'on', 'in', 'to', 'by', 'for']);
// Directional and street-type abbreviations that NYC addresses keep upper case.
const KEEP_UPPER = new Set(['NE', 'NW', 'SE', 'SW', 'FDR', 'JFK', 'US', 'NYC', 'II', 'III', 'IV']);

/**
 * Formats a 10-digit borough-block-lot identifier the way the city writes it:
 * `4027990131` -> `4-02799-0131`. Anything that is not exactly 10 digits is
 * returned unchanged so malformed input stays visible rather than hidden.
 */
export function formatBbl(bbl: string | number | null | undefined): string {
  if (bbl == null) return '';
  const raw = String(bbl).trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10 || !/^[1-5]/.test(digits)) return raw;
  return `${digits[0]}-${digits.slice(1, 6)}-${digits.slice(6)}`;
}

/**
 * Converts an all-caps PLUTO/PAD address to title case for display:
 * `70-25 QUEENS MIDTOWN EXPRESSWAY` -> `70-25 Queens Midtown Expressway`.
 * Mixed-case input is assumed to be intentional and returned unchanged.
 */
export function formatAddress(address: string | null | undefined): string {
  if (address == null) return '';
  const trimmed = address.trim();
  if (!trimmed || trimmed !== trimmed.toUpperCase()) return trimmed;
  let wordIndex = 0;
  return trimmed
    .split(/(\s+|-|\/)/)
    .map((part) => {
      if (/^(\s+|-|\/)$/.test(part) || part === '') return part;
      const index = wordIndex++;
      if (/^\d/.test(part)) return part.toLowerCase(); // 21ST -> 21st, 70 -> 70
      if (KEEP_UPPER.has(part)) return part;
      const lower = part.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      // O'BRIEN -> O'Brien, MCDONALD stays Mcdonald (no reliable rule)
      return lower.replace(/(^|')([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
    })
    .join('');
}

/** Address for display, falling back to the formatted BBL for unnumbered lots. */
export function parcelLabel(address: string | null | undefined, bbl: string | number | null | undefined): string {
  const formatted = formatAddress(address);
  return formatted || `BBL ${formatBbl(bbl)}`;
}
