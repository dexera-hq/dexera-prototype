import {
  BFF_PUBLIC_PATHS,
  type BffBuildUnsignedActionResponse,
  type BffPerpFillsResponse,
  type BffPerpOrderStatusResponse,
  type BffPerpOrderPreviewResponse,
  type BffSubmitSignedActionResponse,
  type BffWalletChallengeResponse,
  type BffWalletVerifyResponse,
} from '@dexera/api-types/openapi';
import { describe, expect, it } from 'vitest';

describe('generated api contracts', () => {
  it('exposes expected public paths', () => {
    expect(BFF_PUBLIC_PATHS).toContain('/health');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/placeholder');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/wallet/challenge');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/wallet/verify');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/perp/orders/preview');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/perp/actions/unsigned');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/perp/actions/submit');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/perp/positions');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/perp/fills');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/perp/orders/status');
  });

  it('exposes perp order preview fields in generated types', () => {
    const responseFixture: BffPerpOrderPreviewResponse = {
      previewId: 'prv_1',
      accountId: 'acct_1',
      venue: 'hyperliquid',
      instrument: 'BTC-PERP',
      side: 'buy',
      type: 'limit',
      size: '0.25',
      markPrice: '68450.25',
      limitPrice: '68400.00',
      estimatedNotional: '17100.00',
      estimatedFee: '8.55',
      expiresAt: '2026-01-01T00:00:00Z',
      source: 'hyperliquid',
    };

    expect(responseFixture.estimatedNotional).toBe('17100.00');
  });

  it('exposes unsigned perp action fields in generated types', () => {
    const responseFixture: BffBuildUnsignedActionResponse = {
      orderId: 'ord_1',
      signingPolicy: 'client-signing-only',
      disclaimer: 'Actions are prepared server-side as unsigned payloads only.',
      unsignedActionPayload: {
        id: 'uap_1',
        accountId: 'acct_1',
        venue: 'hyperliquid',
        kind: 'perp_order_action',
        action: {
          instrument: 'BTC-PERP',
          side: 'buy',
          type: 'limit',
          size: '0.25',
          limitPrice: '68400.00',
        },
        walletRequest: {
          method: 'wallet_perp_submitAction',
          params: [{ payloadId: 'uap_1' }],
        },
      },
    };

    expect(responseFixture.unsignedActionPayload.accountId).toBe('acct_1');
  });

  it('exposes wallet verification endpoints in generated types', () => {
    const challengeFixture: BffWalletChallengeResponse = {
      challengeId: 'wch_1',
      message: 'sign this challenge',
      issuedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-01T00:05:00Z',
    };
    const verifyFixture: BffWalletVerifyResponse = {
      ownershipVerified: true,
      venue: 'hyperliquid',
      eligible: true,
      reason: 'address is accepted by venue account checks',
      checkedAt: '2026-01-01T00:00:02Z',
      source: 'hyperliquid',
    };

    expect(challengeFixture.challengeId).toBe('wch_1');
    expect(verifyFixture.ownershipVerified).toBe(true);
  });

  it('exposes signed submission response fields in generated types', () => {
    const responseFixture: BffSubmitSignedActionResponse = {
      orderId: 'ord_hl_1',
      actionHash: '0xhash',
      venue: 'hyperliquid',
      status: 'submitted',
      venueOrderId: '918273',
      source: 'hyperliquid',
    };

    expect(responseFixture.actionHash).toBe('0xhash');
  });

  it('exposes perp order status response fields in generated types', () => {
    const responseFixture: BffPerpOrderStatusResponse = {
      accountId: 'acct_1',
      venue: 'hyperliquid',
      orderId: 'ord_hl_1',
      venueOrderId: '918273',
      status: 'open',
      venueStatus: 'open',
      isTerminal: false,
      lastUpdatedAt: '2026-01-01T00:00:00Z',
      source: 'hyperliquid',
    };

    expect(responseFixture.venueOrderId).toBe('918273');
  });

  it('exposes perp fills response fields in generated types', () => {
    const responseFixture: BffPerpFillsResponse = {
      accountId: 'acct_1',
      venue: 'hyperliquid',
      fills: [
        {
          id: 'fill_1',
          accountId: 'acct_1',
          venue: 'hyperliquid',
          orderId: 'ord_1',
          instrument: 'BTC-PERP',
          side: 'buy',
          size: '0.25',
          price: '68450.25',
          filledAt: '2026-01-01T00:00:00Z',
        },
      ],
      source: 'hyperliquid',
    };

    expect(responseFixture.fills[0]?.orderId).toBe('ord_1');
  });
});
