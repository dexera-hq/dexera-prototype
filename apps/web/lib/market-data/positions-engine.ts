import type { BffPerpPosition, BffPerpPositionsResponse, BffVenueId } from '@dexera/api-types/openapi';

import type { PerpPosition } from '@/lib/market-data/types';
import type { WalletSlot } from '@/lib/wallet/types';

export type PositionWallet = {
  accountId: string;
  venue: BffVenueId;
};

function normalizeAccountId(accountId: string): string {
  return accountId.trim().toLowerCase();
}

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}

function formatSignedDecimal(value: number): string {
  return Object.is(value, -0) ? '0.00' : value.toFixed(2);
}

export function collectConnectedPositionWallets(
  slots: readonly WalletSlot[],
): PositionWallet[] {
  const seenKeys = new Set<string>();
  const wallets: PositionWallet[] = [];

  for (const slot of slots) {
    if (slot.status !== 'connected') {
      continue;
    }

    const accountId = slot.accountId.trim();
    if (accountId.length === 0) {
      continue;
    }

    const key = `${normalizeAccountId(accountId)}:${slot.venue}`;
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    wallets.push({
      accountId,
      venue: slot.venue,
    });
  }

  return wallets;
}

export function computePerpPositionMetrics(position: {
  direction: BffPerpPosition['direction'];
  size: string;
  entryPrice: string;
  markPrice: string;
}): {
  unrealizedPnlUsd: string;
  notionalValue: string;
} {
  const size = Math.abs(parseNumber(position.size));
  const entryPrice = parseNumber(position.entryPrice);
  const markPrice = parseNumber(position.markPrice);
  const pnlMultiplier = position.direction === 'short' ? -1 : 1;
  const unrealizedPnlUsd = (markPrice - entryPrice) * size * pnlMultiplier;
  const notionalValue = markPrice * size;

  return {
    unrealizedPnlUsd: formatSignedDecimal(unrealizedPnlUsd),
    notionalValue: formatDecimal(Math.abs(notionalValue)),
  };
}

export function toWorkspacePerpPosition(position: BffPerpPosition): PerpPosition {
  const metrics = computePerpPositionMetrics(position);

  return {
    positionId: position.positionId,
    accountId: position.accountId,
    venue: position.venue,
    instrument: position.instrument,
    direction: position.direction,
    size: position.size,
    entryPrice: position.entryPrice,
    markPrice: position.markPrice,
    unrealizedPnlUsd: metrics.unrealizedPnlUsd,
    notionalValue: metrics.notionalValue,
    leverage: position.leverage,
    status: position.status,
    lastUpdatedAt: position.lastUpdatedAt,
  };
}

export function aggregateWalletPositions(
  responses: readonly BffPerpPositionsResponse[],
): PerpPosition[] {
  return responses
    .flatMap((response) => response.positions.map(toWorkspacePerpPosition))
    .toSorted((left, right) => {
      const venueOrder = left.venue.localeCompare(right.venue);
      if (venueOrder !== 0) {
        return venueOrder;
      }

      const accountOrder = normalizeAccountId(left.accountId).localeCompare(
        normalizeAccountId(right.accountId),
      );
      if (accountOrder !== 0) {
        return accountOrder;
      }

      const instrumentOrder = left.instrument.localeCompare(right.instrument);
      if (instrumentOrder !== 0) {
        return instrumentOrder;
      }

      return left.positionId.localeCompare(right.positionId);
    });
}
