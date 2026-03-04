import { describe, expect, it } from 'vitest';

import {
  buildPerpOrderRequest,
  canSubmitOrderEntry,
  createOrderEntryDraft,
  createOrderPreviewKey,
  isVenueMismatched,
  validateOrderEntryDraft,
} from '../lib/wallet/order-entry-logic';

describe('order entry logic', () => {
  it('builds a valid limit order request with limit price', () => {
    const draft = createOrderEntryDraft({
      venue: 'hyperliquid',
      instrument: 'BTC-PERP',
      side: 'buy',
      type: 'limit',
      size: '0.25',
      limitPrice: '68500',
      leverage: '5',
      reduceOnly: true,
    });

    const request = buildPerpOrderRequest({
      draft,
      accountId: '0x0000000000000000000000000000000000000001',
    });

    expect(request.limitPrice).toBe('68500');
    expect(request.leverage).toBe('5');
    expect(request.reduceOnly).toBe(true);
  });

  it('omits limit price for market orders', () => {
    const draft = createOrderEntryDraft({
      venue: 'aster',
      instrument: 'ETH-PERP',
      side: 'sell',
      type: 'market',
      size: '1.0',
      limitPrice: '3200',
    });

    const request = buildPerpOrderRequest({
      draft,
      accountId: '0x0000000000000000000000000000000000000002',
    });

    expect(request.type).toBe('market');
    expect(request.limitPrice).toBeUndefined();
  });

  it('rejects invalid sizes', () => {
    for (const size of ['', '0', '-1', 'abc']) {
      const result = validateOrderEntryDraft(
        createOrderEntryDraft({
          instrument: 'BTC-PERP',
          size,
        }),
      );
      expect(result.ok).toBe(false);
    }
  });

  it('rejects invalid limit price for limit orders', () => {
    const result = validateOrderEntryDraft(
      createOrderEntryDraft({
        instrument: 'BTC-PERP',
        type: 'limit',
        size: '0.2',
        limitPrice: '0',
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation to fail');
    }
    expect(result.message).toContain('Limit price');
  });

  it('validates optional leverage', () => {
    const valid = validateOrderEntryDraft(
      createOrderEntryDraft({
        instrument: 'BTC-PERP',
        type: 'market',
        size: '0.2',
        leverage: '',
      }),
    );
    expect(valid.ok).toBe(true);

    const invalid = validateOrderEntryDraft(
      createOrderEntryDraft({
        instrument: 'BTC-PERP',
        type: 'market',
        size: '0.2',
        leverage: '0',
      }),
    );
    expect(invalid.ok).toBe(false);
  });

  it('changes preview key when order fields change', () => {
    const baseDraft = createOrderEntryDraft({
      instrument: 'BTC-PERP',
      size: '0.4',
      limitPrice: '68000',
    });
    const baseKey = createOrderPreviewKey(
      buildPerpOrderRequest({
        draft: baseDraft,
        accountId: '0x0000000000000000000000000000000000000001',
      }),
    );

    const changedKey = createOrderPreviewKey(
      buildPerpOrderRequest({
        draft: createOrderEntryDraft({
          ...baseDraft,
          size: '0.5',
        }),
        accountId: '0x0000000000000000000000000000000000000001',
      }),
    );

    expect(changedKey).not.toBe(baseKey);
  });

  it('detects venue mismatch against active wallet venue', () => {
    expect(isVenueMismatched('aster', 'hyperliquid')).toBe(true);
    expect(isVenueMismatched('hyperliquid', 'hyperliquid')).toBe(false);
    expect(isVenueMismatched('aster', null)).toBe(false);
  });

  it('requires a current preview to allow submit', () => {
    expect(
      canSubmitOrderEntry({
        isSubmitting: false,
        hasTradableWallet: true,
        venueMatchesWallet: true,
        hasPreview: true,
        isPreviewDirty: false,
      }),
    ).toBe(true);

    expect(
      canSubmitOrderEntry({
        isSubmitting: false,
        hasTradableWallet: true,
        venueMatchesWallet: true,
        hasPreview: false,
        isPreviewDirty: false,
      }),
    ).toBe(false);

    expect(
      canSubmitOrderEntry({
        isSubmitting: false,
        hasTradableWallet: true,
        venueMatchesWallet: true,
        hasPreview: true,
        isPreviewDirty: true,
      }),
    ).toBe(false);
  });
});
