import { describe, expect, it } from 'vitest';
import {
  appendSubmittedPerpAction,
  createPerpActivityWalletKey,
  getWalletPerpActivity,
  MAX_PERP_ACTION_ROWS,
  MAX_PERP_FILL_ROWS,
  parsePerpActivityStore,
  serializePerpActivityStore,
  type RecordSubmittedPerpActionInput,
} from '@/lib/wallet/perp-activity';

function createSubmission(
  overrides?: Partial<RecordSubmittedPerpActionInput>,
): RecordSubmittedPerpActionInput {
  return {
    orderId: overrides?.orderId ?? 'order-1',
    actionHash: overrides?.actionHash ?? '0xabc',
    unsignedActionPayloadId: overrides?.unsignedActionPayloadId ?? 'payload-1',
    accountId: overrides?.accountId ?? '0x1234',
    venue: overrides?.venue ?? 'hyperliquid',
    venueOrderId: overrides?.venueOrderId,
    instrument: overrides?.instrument ?? 'ETH-PERP',
    side: overrides?.side ?? 'buy',
    type: overrides?.type ?? 'limit',
    size: overrides?.size ?? '1.25',
    limitPrice: overrides?.limitPrice ?? '3200',
    markPrice: overrides?.markPrice ?? '3198.5',
    reduceOnly: overrides?.reduceOnly ?? false,
    submittedAt: overrides?.submittedAt ?? '2026-03-06T10:00:00.000Z',
  };
}

describe('perp activity ledger', () => {
  it('generates deterministic fill rows for the same submitted action', () => {
    const submission = createSubmission();
    const firstLedger = appendSubmittedPerpAction({}, submission);
    const secondLedger = appendSubmittedPerpAction({}, submission);

    expect(firstLedger).toEqual(secondLedger);
    const activity = getWalletPerpActivity(firstLedger, submission.accountId, submission.venue);
    expect(activity.actions).toHaveLength(1);
    expect(activity.fills.length).toBeGreaterThan(0);
  });

  it('isolates history by wallet key', () => {
    const first = createSubmission({ accountId: '0xaaa', venue: 'hyperliquid', orderId: 'a-1' });
    const second = createSubmission({ accountId: '0xbbb', venue: 'aster', orderId: 'b-1' });

    const ledger = appendSubmittedPerpAction(appendSubmittedPerpAction({}, first), second);

    expect(getWalletPerpActivity(ledger, '0xaaa', 'hyperliquid').actions).toHaveLength(1);
    expect(getWalletPerpActivity(ledger, '0xbbb', 'aster').actions).toHaveLength(1);
    expect(Object.keys(ledger)).toContain(createPerpActivityWalletKey('0xaaa', 'hyperliquid'));
    expect(Object.keys(ledger)).toContain(createPerpActivityWalletKey('0xbbb', 'aster'));
  });

  it('caps actions and fills at configured limits', () => {
    let ledger = {};
    for (let index = 0; index < 120; index += 1) {
      ledger = appendSubmittedPerpAction(
        ledger,
        createSubmission({
          orderId: `order-${index}`,
          actionHash: `0x${index.toString(16).padStart(4, '0')}`,
          unsignedActionPayloadId: `payload-${index}`,
          submittedAt: new Date(1_700_000_000_000 + index * 1000).toISOString(),
        }),
      );
    }

    const activity = getWalletPerpActivity(ledger, '0x1234', 'hyperliquid');
    expect(activity.actions).toHaveLength(MAX_PERP_ACTION_ROWS);
    expect(activity.fills.length).toBeLessThanOrEqual(MAX_PERP_FILL_ROWS);
    expect(activity.actions[0]?.orderId).toBe('order-119');
  });

  it('round-trips persisted payload and rejects malformed payloads', () => {
    const ledger = appendSubmittedPerpAction({}, createSubmission());
    const serialized = serializePerpActivityStore(ledger);

    expect(parsePerpActivityStore(serialized)).toEqual(ledger);
    expect(parsePerpActivityStore('not-json')).toEqual({});
    expect(parsePerpActivityStore(JSON.stringify({ version: 2, buckets: {} }))).toEqual({});
  });
});
