import { describe, expect, it } from 'vitest';

import {
  computeTickerBaseVelocity,
  easeTickerVelocity,
  wrapTickerOffset,
} from '@/components/workspace/overview-ticker-motion';

describe('overview ticker motion helpers', () => {
  it('derives a stable base velocity from sequence width', () => {
    expect(computeTickerBaseVelocity(0)).toBe(0);
    expect(computeTickerBaseVelocity(480, 24_000)).toBeCloseTo(0.02);
  });

  it('eases velocity toward the target without snapping', () => {
    expect(easeTickerVelocity(0.02, 0, 16, 220)).toBeGreaterThan(0);
    expect(easeTickerVelocity(0.02, 0, 16, 220)).toBeLessThan(0.02);
    expect(easeTickerVelocity(0.005, 0.02, 220, 220)).toBeCloseTo(0.0145, 3);
  });

  it('wraps offsets back into a seamless ticker range', () => {
    expect(wrapTickerOffset(-230, 100)).toBe(-30);
    expect(wrapTickerOffset(230, 100)).toBe(-70);
    expect(wrapTickerOffset(-100, 100)).toBe(0);
  });
});
