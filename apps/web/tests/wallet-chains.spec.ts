import { describe, expect, it } from 'vitest';

import { SUPPORTED_VENUES, getWalletVenueLabel } from '../lib/wallet/chains';

describe('wallet venues', () => {
  it('defines supported perp venues', () => {
    expect(SUPPORTED_VENUES).toEqual(['hyperliquid', 'aster']);
  });

  it('resolves venue labels', () => {
    expect(getWalletVenueLabel('hyperliquid')).toBe('Hyperliquid');
    expect(getWalletVenueLabel('aster')).toBe('Aster');
  });
});
