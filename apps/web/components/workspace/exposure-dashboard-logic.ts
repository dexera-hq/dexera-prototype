import type { PerpPosition } from '@/lib/market-data/types';

const SUPPORTED_EXPOSURE_VENUES = new Set<PerpPosition['venue']>(['hyperliquid', 'aster']);
const TOP_EXPOSURE_ITEMS_LIMIT = 3;

export type ExposureInstrumentSummary = {
  instrument: string;
  totalNotionalValue: number;
  totalUnrealizedPnlUsd: number;
  totalLongNotionalValue: number;
  totalShortNotionalValue: number;
  openPositionCount: number;
  walletCount: number;
};

export type ExposureVenueSummary = {
  venue: PerpPosition['venue'];
  totalNotionalValue: number;
  totalUnrealizedPnlUsd: number;
  totalLongNotionalValue: number;
  totalShortNotionalValue: number;
  openPositionCount: number;
  walletCount: number;
};

export type ExposureDashboardViewModel = {
  connectedWalletCount: number;
  activeWalletCount: number;
  openPositionCount: number;
  totalNotionalValue: number;
  totalLongNotionalValue: number;
  totalShortNotionalValue: number;
  totalUnrealizedPnlUsd: number;
  topInstruments: ExposureInstrumentSummary[];
  topVenues: ExposureVenueSummary[];
};

type MutableExposureInstrumentSummary = ExposureInstrumentSummary & {
  walletKeys: Set<string>;
};

type MutableExposureVenueSummary = ExposureVenueSummary & {
  walletKeys: Set<string>;
};

function normalizeAccountId(accountId: string): string {
  return accountId.trim().toLowerCase();
}

function toWalletKey(position: Pick<PerpPosition, 'accountId' | 'venue'>): string {
  return `${normalizeAccountId(position.accountId)}:${position.venue}`;
}

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareByExposureThenName(
  left: { totalNotionalValue: number },
  right: { totalNotionalValue: number },
  leftName: string,
  rightName: string,
): number {
  const exposureOrder = right.totalNotionalValue - left.totalNotionalValue;
  if (exposureOrder !== 0) {
    return exposureOrder;
  }

  return leftName.localeCompare(rightName);
}

export function buildExposureDashboardViewModel(
  positions: readonly PerpPosition[],
  connectedWalletCount: number,
): ExposureDashboardViewModel {
  const instrumentSummaries = new Map<string, MutableExposureInstrumentSummary>();
  const venueSummaries = new Map<PerpPosition['venue'], MutableExposureVenueSummary>();
  const activeWalletKeys = new Set<string>();

  let openPositionCount = 0;
  let totalNotionalValue = 0;
  let totalLongNotionalValue = 0;
  let totalShortNotionalValue = 0;
  let totalUnrealizedPnlUsd = 0;

  for (const position of positions) {
    if (position.status !== 'open' || !SUPPORTED_EXPOSURE_VENUES.has(position.venue)) {
      continue;
    }

    const walletKey = toWalletKey(position);
    const instrumentKey = position.instrument.trim().toUpperCase();
    const notionalValue = parseNumber(position.notionalValue);
    const unrealizedPnlUsd = parseNumber(position.unrealizedPnlUsd);
    const longNotionalValue = position.direction === 'long' ? notionalValue : 0;
    const shortNotionalValue = position.direction === 'short' ? notionalValue : 0;

    activeWalletKeys.add(walletKey);
    openPositionCount += 1;
    totalNotionalValue += notionalValue;
    totalLongNotionalValue += longNotionalValue;
    totalShortNotionalValue += shortNotionalValue;
    totalUnrealizedPnlUsd += unrealizedPnlUsd;

    const instrumentSummary = instrumentSummaries.get(instrumentKey) ?? {
      instrument: instrumentKey,
      totalNotionalValue: 0,
      totalUnrealizedPnlUsd: 0,
      totalLongNotionalValue: 0,
      totalShortNotionalValue: 0,
      openPositionCount: 0,
      walletCount: 0,
      walletKeys: new Set<string>(),
    };

    instrumentSummary.totalNotionalValue += notionalValue;
    instrumentSummary.totalUnrealizedPnlUsd += unrealizedPnlUsd;
    instrumentSummary.totalLongNotionalValue += longNotionalValue;
    instrumentSummary.totalShortNotionalValue += shortNotionalValue;
    instrumentSummary.openPositionCount += 1;
    instrumentSummary.walletKeys.add(walletKey);
    instrumentSummaries.set(instrumentKey, instrumentSummary);

    const venueSummary = venueSummaries.get(position.venue) ?? {
      venue: position.venue,
      totalNotionalValue: 0,
      totalUnrealizedPnlUsd: 0,
      totalLongNotionalValue: 0,
      totalShortNotionalValue: 0,
      openPositionCount: 0,
      walletCount: 0,
      walletKeys: new Set<string>(),
    };

    venueSummary.totalNotionalValue += notionalValue;
    venueSummary.totalUnrealizedPnlUsd += unrealizedPnlUsd;
    venueSummary.totalLongNotionalValue += longNotionalValue;
    venueSummary.totalShortNotionalValue += shortNotionalValue;
    venueSummary.openPositionCount += 1;
    venueSummary.walletKeys.add(walletKey);
    venueSummaries.set(position.venue, venueSummary);
  }

  const topInstruments = Array.from(instrumentSummaries.values())
    .map(({ walletKeys, ...summary }) => ({
      ...summary,
      walletCount: walletKeys.size,
    }))
    .toSorted((left, right) =>
      compareByExposureThenName(left, right, left.instrument, right.instrument),
    )
    .slice(0, TOP_EXPOSURE_ITEMS_LIMIT);

  const topVenues = Array.from(venueSummaries.values())
    .map(({ walletKeys, ...summary }) => ({
      ...summary,
      walletCount: walletKeys.size,
    }))
    .toSorted((left, right) => compareByExposureThenName(left, right, left.venue, right.venue))
    .slice(0, TOP_EXPOSURE_ITEMS_LIMIT);

  return {
    connectedWalletCount,
    activeWalletCount: activeWalletKeys.size,
    openPositionCount,
    totalNotionalValue,
    totalLongNotionalValue,
    totalShortNotionalValue,
    totalUnrealizedPnlUsd,
    topInstruments,
    topVenues,
  };
}
