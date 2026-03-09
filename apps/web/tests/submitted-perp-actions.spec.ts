import { describe, expect, it } from 'vitest';

import {
  deserializeTrackedPerpActions,
  formatTrackedPerpActionStatusLabel,
  resolveTrackedPerpActionCancelState,
  resolveTrackedPerpActionStatus,
  serializeTrackedPerpActions,
} from '../lib/wallet/use-submitted-perp-actions';

describe('submitted perp actions tracker helpers', () => {
  it('maps venue statuses into tracked action statuses', () => {
    expect(resolveTrackedPerpActionStatus({ status: 'filled', isTerminal: true })).toBe('filled');
    expect(resolveTrackedPerpActionStatus({ status: 'cancelled', isTerminal: true })).toBe(
      'cancelled',
    );
    expect(resolveTrackedPerpActionStatus({ status: 'rejected', isTerminal: true })).toBe(
      'rejected',
    );
    expect(resolveTrackedPerpActionStatus({ status: 'open', isTerminal: false })).toBe('open');
    expect(resolveTrackedPerpActionStatus({ status: 'submitted', isTerminal: false })).toBe(
      'reconciling',
    );
    expect(resolveTrackedPerpActionStatus({ status: 'mystery', isTerminal: false })).toBe(
      'reconciling',
    );
    expect(resolveTrackedPerpActionStatus({ status: 'mystery', isTerminal: true })).toBe('failed');
  });

  it('formats labels for tracked status pills', () => {
    expect(formatTrackedPerpActionStatusLabel('optimistic_submitting')).toBe('optimistic');
    expect(formatTrackedPerpActionStatusLabel('reconciling')).toBe('reconciling');
    expect(formatTrackedPerpActionStatusLabel('filled')).toBe('filled');
  });

  it('resolves cancel states for tracked actions', () => {
    expect(
      resolveTrackedPerpActionCancelState({
        venue: 'hyperliquid',
        status: 'open',
        isTerminal: false,
        venueOrderId: '918273',
        orderId: 'ord_1',
        isCancelPending: false,
      }),
    ).toBe('available');
    expect(
      resolveTrackedPerpActionCancelState({
        venue: 'hyperliquid',
        status: 'open',
        isTerminal: false,
        venueOrderId: '918273',
        orderId: 'ord_1',
        isCancelPending: true,
      }),
    ).toBe('pending');
    expect(
      resolveTrackedPerpActionCancelState({
        venue: 'hyperliquid',
        status: 'reconciling',
        isTerminal: false,
        venueOrderId: '918273',
        orderId: 'ord_1',
        isCancelPending: false,
      }),
    ).toBe('unsupported');
  });

  it('round-trips persisted tracked actions and filters invalid rows', () => {
    const serialized = serializeTrackedPerpActions({
      'hyperliquid:0xabc123': [
        {
          id: 'tracked_1',
          accountId: '0xAbC123',
          venue: 'hyperliquid',
          instrument: 'btc-perp',
          side: 'buy',
          type: 'limit',
          size: '0.01',
          limitPrice: '68000',
          orderId: 'ord_1',
          actionHash: '0xhash',
          venueOrderId: '918273',
          status: 'open',
          venueStatus: 'open',
          submittedAt: '2026-03-09T10:00:00.000Z',
          updatedAt: '2026-03-09T10:00:30.000Z',
          isTerminal: false,
          reconciliationAttempts: 2,
          isCancelPending: true,
          cancelActionHash: '0xcancelhash',
          cancelRequestedAt: '2026-03-09T10:00:31.000Z',
          cancelError: undefined,
          lastError: undefined,
        },
        {
          id: 'broken',
          accountId: '0xabc123',
          venue: 'hyperliquid',
          instrument: 'eth-perp',
          side: 'buy',
          type: 'limit',
          size: '0.01',
          status: 'not-a-real-status',
          submittedAt: '2026-03-09T10:00:00.000Z',
          updatedAt: '2026-03-09T10:00:30.000Z',
          isTerminal: false,
          reconciliationAttempts: 0,
        } as never,
      ],
    });

    expect(deserializeTrackedPerpActions(serialized)).toEqual({
      'hyperliquid:0xabc123': [
        {
          id: 'tracked_1',
          accountId: '0xabc123',
          venue: 'hyperliquid',
          instrument: 'BTC-PERP',
          side: 'buy',
          type: 'limit',
          size: '0.01',
          limitPrice: '68000',
          orderId: 'ord_1',
          actionHash: '0xhash',
          venueOrderId: '918273',
          status: 'open',
          venueStatus: 'open',
          submittedAt: '2026-03-09T10:00:00.000Z',
          updatedAt: '2026-03-09T10:00:30.000Z',
          isTerminal: false,
          reconciliationAttempts: 2,
          isCancelPending: true,
          cancelActionHash: '0xcancelhash',
          cancelRequestedAt: '2026-03-09T10:00:31.000Z',
          cancelError: undefined,
          lastError: undefined,
        },
      ],
    });
  });
});
