import { describe, it, expect } from 'vitest';

// WCAG relative luminance, per https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
function luminance(hex: string): number {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`bad hex: ${hex}`);
  const n = parseInt(m[1], 16);
  const channels = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('Matrix palette contrast', () => {
  // Pinned to the colors declared in src/styles/global.css [data-theme='matrix'].
  // If you change them there, update them here too — the test will fail loudly.
  const MATRIX_FG = '#39ff14';
  const MATRIX_BG = '#050b06';

  it('foreground vs background ≥ WCAG AA (4.5:1)', () => {
    const ratio = contrast(MATRIX_FG, MATRIX_BG);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('accent vs background ≥ WCAG AA for large text (3:1)', () => {
    const ratio = contrast('#9dff70', MATRIX_BG);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});
