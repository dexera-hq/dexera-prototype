import type { BffPerpOrderRequest, BffVenueId } from '@dexera/api-types/openapi';

export type OrderEntryDraft = {
  venue: BffVenueId;
  instrument: string;
  side: BffPerpOrderRequest['side'];
  type: BffPerpOrderRequest['type'];
  size: string;
  limitPrice: string;
  leverage: string;
  reduceOnly: boolean;
};

export type OrderEntryValidationResult = { ok: true } | { ok: false; message: string };

type SubmitReadiness = {
  isSubmitting: boolean;
  hasTradableWallet: boolean;
  venueMatchesWallet: boolean;
  hasPreview: boolean;
  isPreviewDirty: boolean;
};

function parsePositiveNumber(candidate: string): number | null {
  const parsed = Number(candidate);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function createOrderEntryDraft(parameters?: Partial<OrderEntryDraft>): OrderEntryDraft {
  return {
    venue: parameters?.venue ?? 'hyperliquid',
    instrument: parameters?.instrument ?? '',
    side: parameters?.side ?? 'buy',
    type: parameters?.type ?? 'limit',
    size: parameters?.size ?? '0.10',
    limitPrice: parameters?.limitPrice ?? '',
    leverage: parameters?.leverage ?? '',
    reduceOnly: parameters?.reduceOnly ?? false,
  };
}

export function validateOrderEntryDraft(draft: OrderEntryDraft): OrderEntryValidationResult {
  if (draft.instrument.trim().length === 0) {
    return {
      ok: false,
      message: 'Select an instrument before previewing the unsigned payload.',
    };
  }

  if (parsePositiveNumber(draft.size.trim()) === null) {
    return {
      ok: false,
      message: 'Size must be a number greater than 0.',
    };
  }

  if (draft.leverage.trim().length > 0 && parsePositiveNumber(draft.leverage.trim()) === null) {
    return {
      ok: false,
      message: 'Leverage must be empty or a number greater than 0.',
    };
  }

  if (draft.type === 'limit' && parsePositiveNumber(draft.limitPrice.trim()) === null) {
    return {
      ok: false,
      message: 'Limit price must be a number greater than 0 for limit orders.',
    };
  }

  return { ok: true };
}

export function buildPerpOrderRequest(parameters: {
  draft: OrderEntryDraft;
  accountId: string;
}): BffPerpOrderRequest {
  const draft = parameters.draft;
  const leverage = draft.leverage.trim();
  const order: BffPerpOrderRequest = {
    accountId: parameters.accountId.trim(),
    venue: draft.venue,
    instrument: draft.instrument.trim().toUpperCase(),
    side: draft.side,
    type: draft.type,
    size: draft.size.trim(),
    reduceOnly: draft.reduceOnly,
  };

  if (draft.type === 'limit') {
    order.limitPrice = draft.limitPrice.trim();
  }

  if (leverage.length > 0) {
    order.leverage = leverage;
  }

  return order;
}

export function createOrderPreviewKey(order: BffPerpOrderRequest): string {
  return JSON.stringify({
    accountId: order.accountId.trim().toLowerCase(),
    venue: order.venue,
    instrument: order.instrument.trim().toUpperCase(),
    side: order.side,
    type: order.type,
    size: order.size.trim(),
    limitPrice: order.limitPrice?.trim() ?? '',
    leverage: order.leverage?.trim() ?? '',
    reduceOnly: order.reduceOnly === true,
  });
}

export function isVenueMismatched(
  selectedVenue: BffVenueId,
  activeWalletVenue: BffVenueId | null | undefined,
): boolean {
  return (
    activeWalletVenue !== undefined &&
    activeWalletVenue !== null &&
    selectedVenue !== activeWalletVenue
  );
}

export function canSubmitOrderEntry(parameters: SubmitReadiness): boolean {
  return (
    !parameters.isSubmitting &&
    parameters.hasTradableWallet &&
    parameters.venueMatchesWallet &&
    parameters.hasPreview &&
    !parameters.isPreviewDirty
  );
}
