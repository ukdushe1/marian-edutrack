import { describe, it, expect } from 'vitest';
import { fitScale, printableWidthPx } from '../src/lib/printFit';

describe('printing fits the page width', () => {
  it('A4 printable width with 10 mm margins', () => {
    expect(Math.round(printableWidthPx(false))).toBe(718);  // portrait 190 mm
    expect(Math.round(printableWidthPx(true))).toBe(1047);  // landscape 277 mm
  });
  it('only wider content is scaled down, exactly to the page', () => {
    expect(fitScale(600, 718)).toBe(1);
    expect(fitScale(2094, 1047)).toBe(0.5);
  });
});
