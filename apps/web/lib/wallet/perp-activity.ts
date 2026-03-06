import type { BffPerpOrderRequest, BffVenueId } from '@dexera/api-types/openapi';

export const PERP_ACTIVITY_STORAGE_KEY = 'dexera-prototype.perp-activity.v1';
export const PERP_ACTIVITY_STORAGE_VERSION = 1;
export const MAX_PERP_ACTION_ROWS = 50;
export const MAX_PERP_FILL_ROWS = 50;

const DEFAULT_MARK_PRICE_BY_INSTRUMENT: Readonly<Record<string, number>> = {
  'BTC-PERP': 68000,
  'ETH-PERP': 3200,
  'SOL-PERP': 150,
};

export type SubmittedPerpActionRow = {
  id: string;
  orderId: string;
  actionHash: string;
  unsignedActionPayloadId: string;
  accountId: string;
  venue: BffVenueId;
  venueOrderId?: string;
  instrument: string;
  side: BffPerpOrderRequest['side'];
  type: BffPerpOrderRequest['type'];
  size: string;
  limitPrice?: string;
  markPrice?: string;
  reduceOnly: boolean;
  submittedAt: string;
};

export type PerpFillRow = {
  id: string;
  orderId: string;
  accountId: string;
  venue: BffVenueId;
  instrument: string;
  side: BffPerpOrderRequest['side'];
  size: string;
  price: string;
  feeAmount: string;
  feeAsset: 'USD';
  filledAt: string;
  source: 'simulated';
};

export type WalletPerpActivityBucket = {
  actions: SubmittedPerpActionRow[];
  fills: PerpFillRow[];
};

export type PerpActivityLedger = Record<string, WalletPerpActivityBucket>;

export type RecordSubmittedPerpActionInput = {
  orderId: string;
  actionHash: string;
  unsignedActionPayloadId: string;
  accountId: string;
  venue: BffVenueId;
  venueOrderId?: string;
  instrument: string;
  side: BffPerpOrderRequest['side'];
  type: BffPerpOrderRequest['type'];
  size: string;
  limitPrice?: string;
  markPrice?: string;
  reduceOnly: boolean;
  submittedAt: string;
};

const EMPTY_ACTIVITY_BUCKET: WalletPerpActivityBucket = {
  actions: [],
  fills: [],
};

type PerpActivityStorePayload = {
  version: number;
  buckets: Record<string, unknown>;
};

function normalizeString(value: string): string {
  return value.trim();
}

function normalizeAccountId(accountId: string): string {
  return normalizeString(accountId).toLowerCase();
}

function normalizeVenue(venue: BffVenueId): BffVenueId {
  return normalizeString(venue).toLowerCase() as BffVenueId;
}

function normalizeInstrument(instrument: string): string {
  return normalizeString(instrument).toUpperCase();
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parsePositiveNumber(value: string | undefined): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function resolveDecimalPlaces(input: string, defaultValue: number): number {
  const match = input.trim().match(/\.(\d+)$/);
  if (!match || !match[1]) {
    return defaultValue;
  }

  return Math.max(0, Math.min(8, match[1].length));
}

function formatFixed(value: number, decimals: number): string {
  const raw = value.toFixed(decimals);
  const normalized = raw.replace(/\.?0+$/, '');
  return normalized.length > 0 ? normalized : '0';
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createSubmittedActionId(parameters: {
  orderId: string;
  actionHash: string;
  accountId: string;
  venue: BffVenueId;
}): string {
  return [
    normalizeString(parameters.orderId),
    normalizeString(parameters.actionHash),
    normalizeAccountId(parameters.accountId),
    normalizeVenue(parameters.venue),
  ].join(':');
}

function fallbackMarkPriceForInstrument(instrument: string): number {
  const normalizedInstrument = normalizeInstrument(instrument);
  if (DEFAULT_MARK_PRICE_BY_INSTRUMENT[normalizedInstrument] !== undefined) {
    return DEFAULT_MARK_PRICE_BY_INSTRUMENT[normalizedInstrument] as number;
  }

  return 100;
}

function toSubmittedPerpActionRow(input: RecordSubmittedPerpActionInput): SubmittedPerpActionRow {
  const accountId = normalizeAccountId(input.accountId);
  const venue = normalizeVenue(input.venue);
  const orderId = normalizeString(input.orderId);
  const actionHash = normalizeString(input.actionHash);

  return {
    id: createSubmittedActionId({
      orderId,
      actionHash,
      accountId,
      venue,
    }),
    orderId,
    actionHash,
    unsignedActionPayloadId: normalizeString(input.unsignedActionPayloadId),
    accountId,
    venue,
    venueOrderId: normalizeOptionalString(input.venueOrderId),
    instrument: normalizeInstrument(input.instrument),
    side: input.side,
    type: input.type,
    size: normalizeString(input.size),
    limitPrice: normalizeOptionalString(input.limitPrice),
    markPrice: normalizeOptionalString(input.markPrice),
    reduceOnly: input.reduceOnly === true,
    submittedAt: input.submittedAt,
  };
}

function buildDeterministicFillRows(action: SubmittedPerpActionRow): PerpFillRow[] {
  const seed = fnv1a32(
    `${action.id}:${action.instrument}:${action.side}:${action.type}:${action.size}:${action.submittedAt}`,
  );
  const fillCount = seed % 3 === 0 ? 2 : 1;
  const sizeValue = parsePositiveNumber(action.size) ?? 0;
  const sizeDecimals = Math.max(2, resolveDecimalPlaces(action.size, 3));
  const markPrice =
    parsePositiveNumber(action.limitPrice) ??
    parsePositiveNumber(action.markPrice) ??
    fallbackMarkPriceForInstrument(action.instrument);
  const sideSign = action.side === 'buy' ? 1 : -1;
  const baseSlippageBps = 2 + (seed % 18);
  const submittedAtMs = Date.parse(action.submittedAt);
  const baseTimestampMs = Number.isNaN(submittedAtMs) ? Date.now() : submittedAtMs;

  const splitSizes =
    fillCount === 1
      ? [sizeValue]
      : (() => {
          const leadRatio = 0.58 + ((seed >>> 8) % 17) / 100;
          const first = sizeValue * leadRatio;
          const second = Math.max(0, sizeValue - first);
          return [first, second];
        })();

  return splitSizes.map((fillSize, index) => {
    const ladderBps = index * 3;
    const slippage = (baseSlippageBps + ladderBps) / 10_000;
    const fillPrice = markPrice * (1 + sideSign * slippage);
    const notional = Math.abs(fillSize * fillPrice);
    const feeAmount = notional * 0.0004;
    const fillTimeOffsetMs = (2 + (seed % 6) + index * 4) * 1000;

    return {
      id: `${action.id}:fill:${index + 1}`,
      orderId: action.orderId,
      accountId: action.accountId,
      venue: action.venue,
      instrument: action.instrument,
      side: action.side,
      size: formatFixed(fillSize, sizeDecimals),
      price: formatFixed(fillPrice, 2),
      feeAmount: formatFixed(feeAmount, 4),
      feeAsset: 'USD',
      filledAt: new Date(baseTimestampMs + fillTimeOffsetMs).toISOString(),
      source: 'simulated',
    };
  });
}

function parseSubmittedActionRow(value: unknown): SubmittedPerpActionRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const orderId = normalizeOptionalString(String(value.orderId ?? ''));
  const actionHash = normalizeOptionalString(String(value.actionHash ?? ''));
  const unsignedActionPayloadId = normalizeOptionalString(String(value.unsignedActionPayloadId ?? ''));
  const accountId = normalizeOptionalString(String(value.accountId ?? ''));
  const venueRaw = normalizeOptionalString(String(value.venue ?? ''));
  const sideRaw = normalizeOptionalString(String(value.side ?? ''));
  const typeRaw = normalizeOptionalString(String(value.type ?? ''));
  const instrument = normalizeOptionalString(String(value.instrument ?? ''));
  const size = normalizeOptionalString(String(value.size ?? ''));
  const submittedAt = normalizeOptionalString(String(value.submittedAt ?? ''));

  if (
    !orderId ||
    !actionHash ||
    !unsignedActionPayloadId ||
    !accountId ||
    !venueRaw ||
    !sideRaw ||
    !typeRaw ||
    !instrument ||
    !size ||
    !submittedAt
  ) {
    return null;
  }

  if ((venueRaw !== 'hyperliquid' && venueRaw !== 'aster') || (sideRaw !== 'buy' && sideRaw !== 'sell')) {
    return null;
  }

  if (typeRaw !== 'market' && typeRaw !== 'limit') {
    return null;
  }

  const venue = venueRaw as BffVenueId;
  const side = sideRaw as BffPerpOrderRequest['side'];
  const type = typeRaw as BffPerpOrderRequest['type'];
  const markPrice = normalizeOptionalString(String(value.markPrice ?? ''));
  const limitPrice = normalizeOptionalString(String(value.limitPrice ?? ''));
  const venueOrderId = normalizeOptionalString(String(value.venueOrderId ?? ''));

  return {
    id: createSubmittedActionId({
      orderId,
      actionHash,
      accountId,
      venue,
    }),
    orderId,
    actionHash,
    unsignedActionPayloadId,
    accountId: normalizeAccountId(accountId),
    venue,
    venueOrderId,
    instrument: normalizeInstrument(instrument),
    side,
    type,
    size,
    limitPrice,
    markPrice,
    reduceOnly: value.reduceOnly === true,
    submittedAt,
  };
}

function parsePerpFillRow(value: unknown): PerpFillRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeOptionalString(String(value.id ?? ''));
  const orderId = normalizeOptionalString(String(value.orderId ?? ''));
  const accountId = normalizeOptionalString(String(value.accountId ?? ''));
  const venueRaw = normalizeOptionalString(String(value.venue ?? ''));
  const instrument = normalizeOptionalString(String(value.instrument ?? ''));
  const sideRaw = normalizeOptionalString(String(value.side ?? ''));
  const size = normalizeOptionalString(String(value.size ?? ''));
  const price = normalizeOptionalString(String(value.price ?? ''));
  const feeAmount = normalizeOptionalString(String(value.feeAmount ?? ''));
  const feeAsset = normalizeOptionalString(String(value.feeAsset ?? ''));
  const filledAt = normalizeOptionalString(String(value.filledAt ?? ''));
  const source = normalizeOptionalString(String(value.source ?? ''));

  if (
    !id ||
    !orderId ||
    !accountId ||
    !venueRaw ||
    !instrument ||
    !sideRaw ||
    !size ||
    !price ||
    !feeAmount ||
    !feeAsset ||
    !filledAt ||
    !source
  ) {
    return null;
  }

  if ((venueRaw !== 'hyperliquid' && venueRaw !== 'aster') || (sideRaw !== 'buy' && sideRaw !== 'sell')) {
    return null;
  }

  if (feeAsset !== 'USD' || source !== 'simulated') {
    return null;
  }

  return {
    id,
    orderId,
    accountId: normalizeAccountId(accountId),
    venue: venueRaw as BffVenueId,
    instrument: normalizeInstrument(instrument),
    side: sideRaw as BffPerpOrderRequest['side'],
    size,
    price,
    feeAmount,
    feeAsset: 'USD',
    filledAt,
    source: 'simulated',
  };
}

function parseActivityBucket(value: unknown): WalletPerpActivityBucket | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawActions = Array.isArray(value.actions) ? value.actions : [];
  const rawFills = Array.isArray(value.fills) ? value.fills : [];

  const actions = rawActions
    .map((candidate) => parseSubmittedActionRow(candidate))
    .filter((candidate): candidate is SubmittedPerpActionRow => candidate !== null)
    .slice(0, MAX_PERP_ACTION_ROWS);
  const fills = rawFills
    .map((candidate) => parsePerpFillRow(candidate))
    .filter((candidate): candidate is PerpFillRow => candidate !== null)
    .slice(0, MAX_PERP_FILL_ROWS);

  return { actions, fills };
}

export function createPerpActivityWalletKey(accountId: string, venue: BffVenueId): string {
  return `${normalizeAccountId(accountId)}:${normalizeVenue(venue)}`;
}

export function getWalletPerpActivity(
  ledger: PerpActivityLedger,
  accountId: string,
  venue: BffVenueId,
): WalletPerpActivityBucket {
  return ledger[createPerpActivityWalletKey(accountId, venue)] ?? EMPTY_ACTIVITY_BUCKET;
}

export function appendSubmittedPerpAction(
  ledger: PerpActivityLedger,
  input: RecordSubmittedPerpActionInput,
): PerpActivityLedger {
  const row = toSubmittedPerpActionRow(input);
  const walletKey = createPerpActivityWalletKey(row.accountId, row.venue);
  const currentBucket = ledger[walletKey] ?? EMPTY_ACTIVITY_BUCKET;
  const generatedFills = buildDeterministicFillRows(row);
  const generatedFillIds = new Set(generatedFills.map((fill) => fill.id));

  const actions = [row, ...currentBucket.actions.filter((action) => action.id !== row.id)].slice(
    0,
    MAX_PERP_ACTION_ROWS,
  );
  const fills = [
    ...generatedFills,
    ...currentBucket.fills.filter((fill) => !generatedFillIds.has(fill.id)),
  ].slice(0, MAX_PERP_FILL_ROWS);

  return {
    ...ledger,
    [walletKey]: { actions, fills },
  };
}

export function parsePerpActivityStore(rawValue: string | null): PerpActivityLedger {
  if (!rawValue || rawValue.trim().length === 0) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return {};
  }

  if (!isRecord(parsed)) {
    return {};
  }

  const payload = parsed as PerpActivityStorePayload;
  if (
    payload.version !== PERP_ACTIVITY_STORAGE_VERSION ||
    !isRecord(payload.buckets)
  ) {
    return {};
  }

  const ledger: PerpActivityLedger = {};
  for (const [walletKey, bucket] of Object.entries(payload.buckets)) {
    const parsedBucket = parseActivityBucket(bucket);
    if (!parsedBucket) {
      continue;
    }
    ledger[walletKey] = parsedBucket;
  }

  return ledger;
}

export function serializePerpActivityStore(ledger: PerpActivityLedger): string {
  return JSON.stringify({
    version: PERP_ACTIVITY_STORAGE_VERSION,
    buckets: ledger,
  });
}
