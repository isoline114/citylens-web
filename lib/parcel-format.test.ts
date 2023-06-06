import { describe, expect, it } from 'vitest';

import { formatAddress, formatBbl, parcelLabel } from './parcel-format';

describe('formatBbl', () => {
  it('writes borough-block-lot with dashes', () => {
    expect(formatBbl('4027990131')).toBe('4-02799-0131');
    expect(formatBbl(1006650011)).toBe('1-00665-0011');
  });

  it('leaves malformed identifiers visible and unchanged', () => {
    expect(formatBbl('402799013')).toBe('402799013');
    expect(formatBbl('9027990131')).toBe('9027990131');
    expect(formatBbl(null)).toBe('');
  });
});

describe('formatAddress', () => {
  it('title-cases all-caps PLUTO addresses', () => {
    expect(formatAddress('70-25 QUEENS MIDTOWN EXPRESSWAY')).toBe('70-25 Queens Midtown Expressway');
    expect(formatAddress('100 EAST 21ST STREET')).toBe('100 East 21st Street');
    expect(formatAddress('TAYLOR STREET')).toBe('Taylor Street');
  });

  it('keeps small words lower case after the first word', () => {
    expect(formatAddress('1 AVENUE OF THE AMERICAS')).toBe('1 Avenue of the Americas');
  });

  it('keeps known abbreviations and apostrophes readable', () => {
    expect(formatAddress('500 FDR DRIVE')).toBe('500 FDR Drive');
    expect(formatAddress("12 O'BRIEN PLACE")).toBe("12 O'Brien Place");
  });

  it('returns mixed-case input unchanged', () => {
    expect(formatAddress('5-49 Borden Ave')).toBe('5-49 Borden Ave');
  });
});

describe('parcelLabel', () => {
  it('falls back to the formatted BBL for unnumbered lots', () => {
    expect(parcelLabel(null, '5001980042')).toBe('BBL 5-00198-0042');
    expect(parcelLabel('TAYLOR STREET', '5001980042')).toBe('Taylor Street');
  });
});
