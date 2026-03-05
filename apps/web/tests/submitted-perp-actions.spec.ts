import { describe, expect, it } from 'vitest';

import {
  formatTrackedPerpActionStatusLabel,
  resolveTrackedPerpActionStatus,
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
});
