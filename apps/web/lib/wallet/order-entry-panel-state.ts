import type { InstrumentMetadata } from '@/lib/market-data/types';
import type { OrderEntryDraft } from '@/lib/wallet/order-entry-logic';

type ResolveLimitPriceAutofillParameters = {
  orderType: OrderEntryDraft['type'];
  instrument: string;
  currentLimitPrice: string;
  markPrice?: number;
  lastSyncedInstrument: string;
};

export function collectOrderEntryInstruments(instruments: InstrumentMetadata[]): string[] {
  const set = new Set<string>();
  for (const instrument of instruments) {
    set.add(instrument.instrument.toUpperCase());
  }

  return [...set];
}

export function resolveLimitPriceAutofill(
  parameters: ResolveLimitPriceAutofillParameters,
): { nextLimitPrice: string; nextSyncedInstrument: string } | null {
  if (parameters.orderType !== 'limit' || parameters.markPrice === undefined) {
    return null;
  }

  const normalizedInstrument = parameters.instrument.trim().toUpperCase();
  const instrumentChangedSinceLastSync =
    normalizedInstrument !== parameters.lastSyncedInstrument.trim().toUpperCase();
  const limitPriceMissing = parameters.currentLimitPrice.trim().length === 0;

  if (!instrumentChangedSinceLastSync && !limitPriceMissing) {
    return null;
  }

  return {
    nextLimitPrice: parameters.markPrice.toFixed(2),
    nextSyncedInstrument: normalizedInstrument,
  };
}
