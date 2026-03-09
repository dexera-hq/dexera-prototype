import type { InstrumentMetadata, MarkPrice, PerpFill, PerpPosition } from '@/lib/market-data/types';

const MOCK_INSTRUMENTS: readonly InstrumentMetadata[] = [
  {
    instrument: 'BTC-PERP',
    name: 'Bitcoin Perpetual',
    venue: 'hyperliquid',
    baseAsset: 'BTC',
    quoteAsset: 'USD',
  },
  {
    instrument: 'ETH-PERP',
    name: 'Ether Perpetual',
    venue: 'hyperliquid',
    baseAsset: 'ETH',
    quoteAsset: 'USD',
  },
  {
    instrument: 'SOL-PERP',
    name: 'Solana Perpetual',
    venue: 'hyperliquid',
    baseAsset: 'SOL',
    quoteAsset: 'USD',
  },
  {
    instrument: 'BTC-PERP',
    name: 'Bitcoin Perpetual',
    venue: 'aster',
    baseAsset: 'BTC',
    quoteAsset: 'USD',
  },
  {
    instrument: 'ETH-PERP',
    name: 'Ether Perpetual',
    venue: 'aster',
    baseAsset: 'ETH',
    quoteAsset: 'USD',
  },
];

const BASE_MARK_BY_INSTRUMENT: Readonly<Record<string, number>> = {
  'BTC-PERP': 68450.25,
  'ETH-PERP': 3200.15,
  'SOL-PERP': 145.4,
};

const BASE_POSITIONS: ReadonlyArray<PerpPosition> = [
  {
    instrument: 'BTC-PERP',
    direction: 'long',
    size: '0.25',
    entryPrice: '68120.0',
    markPrice: '68450.25',
    unrealizedPnlUsd: '82.56',
    notionalValue: '17112.56',
    leverage: '4',
    status: 'open',
  },
  {
    instrument: 'ETH-PERP',
    direction: 'short',
    size: '1.60',
    entryPrice: '3221.8',
    markPrice: '3200.15',
    unrealizedPnlUsd: '34.64',
    notionalValue: '5120.24',
    leverage: '3',
    status: 'open',
  },
];

const BASE_FILLS: ReadonlyArray<PerpFill> = [
  {
    id: 'fill_hl_btc_1',
    accountId: 'acct_demo',
    venue: 'hyperliquid',
    instrument: 'BTC-PERP',
    side: 'buy',
    size: '0.120',
    price: '68410.25',
    orderId: 'ord_hl_btc_1',
    filledAt: '2026-03-09T09:42:00.000Z',
  },
  {
    id: 'fill_hl_eth_1',
    accountId: 'acct_demo',
    venue: 'hyperliquid',
    instrument: 'ETH-PERP',
    side: 'sell',
    size: '1.250',
    price: '3204.80',
    orderId: 'ord_hl_eth_1',
    filledAt: '2026-03-09T09:39:00.000Z',
  },
  {
    id: 'fill_ast_btc_1',
    accountId: 'acct_demo',
    venue: 'aster',
    instrument: 'BTC-PERP',
    side: 'sell',
    size: '0.080',
    price: '68395.50',
    orderId: 'ord_ast_btc_1',
    filledAt: '2026-03-09T09:36:00.000Z',
  },
  {
    id: 'fill_ast_eth_1',
    accountId: 'acct_demo',
    venue: 'aster',
    instrument: 'ETH-PERP',
    side: 'buy',
    size: '0.900',
    price: '3198.35',
    orderId: 'ord_ast_eth_1',
    filledAt: '2026-03-09T09:33:00.000Z',
  },
];

const JITTER_WINDOW_MS = 30_000;

function normalizeVenue(venue: string | undefined): string | undefined {
  if (typeof venue !== 'string') {
    return undefined;
  }

  const normalized = venue.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeInstrument(instrument: string): string {
  return instrument.trim().toUpperCase();
}

function roundTo(value: number, fractionDigits: number): number {
  return Number(value.toFixed(fractionDigits));
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function resolveInstruments(instruments: string[]): string[] {
  const requested = instruments
    .map(normalizeInstrument)
    .filter((instrument) => instrument.length > 0);
  return [...new Set(requested)];
}

function applyJitter(basePrice: number, instrument: string, timestampMs: number): number {
  const jitterBucket = Math.floor(timestampMs / JITTER_WINDOW_MS);
  const seed = fnv1a32(`${instrument}:${jitterBucket}`);
  const offset = ((seed % 101) - 50) / 10_000;
  return roundTo(basePrice * (1 + offset), 2);
}

function getAccountScaleFactor(accountId: string): number {
  const hash = fnv1a32(accountId.trim().toLowerCase());
  return 0.85 + (hash % 31) / 100;
}

function getInstrumentScaleFactor(accountId: string, instrument: string): number {
  const hash = fnv1a32(`${accountId}:${instrument}`);
  return 0.92 + (hash % 17) / 100;
}

function shiftIsoTimestamp(isoTimestamp: string, accountId: string, seedKey: string): string {
  const baseTimestamp = Date.parse(isoTimestamp);
  if (!Number.isFinite(baseTimestamp)) {
    return isoTimestamp;
  }

  const hash = fnv1a32(`${accountId}:${seedKey}`);
  const offsetMinutes = hash % 37;
  return new Date(baseTimestamp - offsetMinutes * 60_000).toISOString();
}

export function getMockInstruments(venue?: string): InstrumentMetadata[] {
  const normalizedVenue = normalizeVenue(venue);
  const instruments =
    normalizedVenue === undefined
      ? MOCK_INSTRUMENTS
      : MOCK_INSTRUMENTS.filter((instrument) => instrument.venue.toLowerCase() === normalizedVenue);

  return instruments.map((instrument) => ({ ...instrument }));
}

export function getMockMarkPrices(
  instruments: string[],
  opts?: { jitter?: boolean },
): Record<string, MarkPrice> {
  const timestampMs = Date.now();
  const resolvedInstruments = resolveInstruments(instruments);
  const marks: Record<string, MarkPrice> = {};

  for (const instrument of resolvedInstruments) {
    const basePrice = BASE_MARK_BY_INSTRUMENT[instrument];
    if (basePrice === undefined) {
      continue;
    }

    const price = opts?.jitter ? applyJitter(basePrice, instrument, timestampMs) : basePrice;
    marks[instrument] = {
      instrument,
      price,
      timestampMs,
    };
  }

  return marks;
}

export function getMockPositions(accountId?: string): PerpPosition[] {
  const normalizedAccountId = accountId?.trim().toLowerCase();
  if (!normalizedAccountId) {
    return BASE_POSITIONS.map((position) => ({ ...position }));
  }

  const accountScaleFactor = getAccountScaleFactor(normalizedAccountId);
  return BASE_POSITIONS.map((position) => {
    const instrumentScaleFactor = getInstrumentScaleFactor(
      normalizedAccountId,
      position.instrument,
    );
    const scaledSize = Number(position.size) * accountScaleFactor * instrumentScaleFactor;
    const scaledNotional =
      Number(position.notionalValue) * accountScaleFactor * instrumentScaleFactor;

    return {
      ...position,
      size: scaledSize.toFixed(3),
      notionalValue: scaledNotional.toFixed(2),
    };
  });
}

export function getMockPerpFills(accountId?: string, venue?: string): PerpFill[] {
  const normalizedVenue = normalizeVenue(venue);
  const fills =
    normalizedVenue === undefined
      ? BASE_FILLS
      : BASE_FILLS.filter((fill) => fill.venue.toLowerCase() === normalizedVenue);

  const normalizedAccountId = accountId?.trim().toLowerCase();
  if (!normalizedAccountId) {
    return fills.map((fill) => ({ ...fill }));
  }

  const accountScaleFactor = getAccountScaleFactor(normalizedAccountId);
  return fills.map((fill) => {
    const instrumentScaleFactor = getInstrumentScaleFactor(normalizedAccountId, fill.instrument);
    const scaledSize = Number(fill.size) * accountScaleFactor * instrumentScaleFactor;
    const priceFactor = 0.998 + ((fnv1a32(`${normalizedAccountId}:${fill.id}`) % 9) - 4) / 10_000;

    return {
      ...fill,
      accountId: normalizedAccountId,
      size: scaledSize.toFixed(3),
      price: (Number(fill.price) * priceFactor).toFixed(2),
      filledAt: shiftIsoTimestamp(fill.filledAt, normalizedAccountId, fill.id),
    };
  });
}
