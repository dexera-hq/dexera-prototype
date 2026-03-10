import type { PerpPosition } from '@/lib/market-data/types';

export type PositionDisplayRow = {
  positionId: string;
  instrument: string;
  direction: PerpPosition['direction'];
  size: string;
  entryPrice: string;
  currentPrice: string;
  unrealizedPnlUsd: string;
  notionalValue: string;
};

export type PositionWalletGroup = {
  key: string;
  accountId: string;
  venue: PerpPosition['venue'];
  openPositionCount: number;
  totalNotionalValue: number;
  totalUnrealizedPnlUsd: number;
  positions: PositionDisplayRow[];
};

export type OpenPositionsViewModel = {
  totalNotionalValue: number;
  totalUnrealizedPnlUsd: number;
  openPositionCount: number;
  groups: PositionWalletGroup[];
};

function normalizeAccountId(accountId: string): string {
  return accountId.trim().toLowerCase();
}

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareByExposure(left: PositionDisplayRow, right: PositionDisplayRow): number {
  const exposureOrder = parseNumber(right.notionalValue) - parseNumber(left.notionalValue);
  if (exposureOrder !== 0) {
    return exposureOrder;
  }

  const instrumentOrder = left.instrument.localeCompare(right.instrument);
  if (instrumentOrder !== 0) {
    return instrumentOrder;
  }

  return left.positionId.localeCompare(right.positionId);
}

export function buildOpenPositionsViewModel(
  positions: readonly PerpPosition[],
): OpenPositionsViewModel {
  const groupsByKey = new Map<string, PositionWalletGroup>();
  let totalNotionalValue = 0;
  let totalUnrealizedPnlUsd = 0;
  let openPositionCount = 0;

  for (const position of positions) {
    if (position.status !== 'open') {
      continue;
    }

    const groupKey = `${normalizeAccountId(position.accountId)}:${position.venue}`;
    let group = groupsByKey.get(groupKey);

    if (!group) {
      group = {
        key: groupKey,
        accountId: position.accountId,
        venue: position.venue,
        openPositionCount: 0,
        totalNotionalValue: 0,
        totalUnrealizedPnlUsd: 0,
        positions: [],
      };
      groupsByKey.set(groupKey, group);
    }

    const notionalValue = parseNumber(position.notionalValue);
    const unrealizedPnlUsd = parseNumber(position.unrealizedPnlUsd);

    group.openPositionCount += 1;
    group.totalNotionalValue += notionalValue;
    group.totalUnrealizedPnlUsd += unrealizedPnlUsd;
    group.positions.push({
      positionId: position.positionId,
      instrument: position.instrument,
      direction: position.direction,
      size: position.size,
      entryPrice: position.entryPrice,
      currentPrice: position.markPrice,
      unrealizedPnlUsd: position.unrealizedPnlUsd,
      notionalValue: position.notionalValue,
    });

    totalNotionalValue += notionalValue;
    totalUnrealizedPnlUsd += unrealizedPnlUsd;
    openPositionCount += 1;
  }

  const groups = Array.from(groupsByKey.values())
    .map((group) => ({
      ...group,
      positions: group.positions.toSorted(compareByExposure),
    }))
    .toSorted((left, right) => {
      const exposureOrder = right.totalNotionalValue - left.totalNotionalValue;
      if (exposureOrder !== 0) {
        return exposureOrder;
      }

      const accountOrder = normalizeAccountId(left.accountId).localeCompare(
        normalizeAccountId(right.accountId),
      );
      if (accountOrder !== 0) {
        return accountOrder;
      }

      return left.venue.localeCompare(right.venue);
    });

  return {
    totalNotionalValue,
    totalUnrealizedPnlUsd,
    openPositionCount,
    groups,
  };
}
