import type { BffPerpPositionsResponse } from '@dexera/api-types/openapi';

const DEFAULT_PERP_POSITIONS_ENDPOINT = '/api/v1/perp/positions';

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Perp positions response is missing "${key}".`);
  }

  return value;
}

export async function getPerpPositions(
  request: {
    accountId: string;
    venue: 'hyperliquid' | 'aster';
    instrument?: string;
  },
  options?: {
    endpoint?: string;
    fetchImpl?: FetchLike;
  },
): Promise<BffPerpPositionsResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? DEFAULT_PERP_POSITIONS_ENDPOINT;

  const params = new URLSearchParams({
    accountId: request.accountId,
    venue: request.venue,
  });
  if (request.instrument && request.instrument.trim().length > 0) {
    params.set('instrument', request.instrument);
  }

  const response = await fetchImpl(`${endpoint}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const rawBody = await response.text();
  const trimmedBody = rawBody.trim();
  let payload: unknown = null;

  if (trimmedBody.length > 0) {
    try {
      payload = JSON.parse(trimmedBody) as unknown;
    } catch {
      payload = trimmedBody;
    }
  }

  if (!response.ok) {
    if (typeof payload === 'string' && payload.trim().length > 0) {
      throw new Error(payload);
    }
    if (isRecord(payload) && typeof payload.error === 'string' && payload.error.trim().length > 0) {
      throw new Error(payload.error);
    }
    throw new Error(`Perp positions request failed with status ${response.status}.`);
  }

  if (!isRecord(payload)) {
    throw new Error('Perp positions response must be a JSON object.');
  }

  const venue = readString(payload, 'venue');
  if (venue !== 'hyperliquid' && venue !== 'aster') {
    throw new Error('Perp positions response includes an unsupported venue.');
  }

  if (!Array.isArray(payload.positions)) {
    throw new Error('Perp positions response is missing positions.');
  }

  return {
    accountId: readString(payload, 'accountId'),
    venue,
    positions: payload.positions.map((position) => {
      if (!isRecord(position)) {
        throw new Error('Perp position item must be an object.');
      }

      const positionVenue = readString(position, 'venue');
      if (positionVenue !== 'hyperliquid' && positionVenue !== 'aster') {
        throw new Error('Perp position item includes an unsupported venue.');
      }

      const direction = readString(position, 'direction');
      if (direction !== 'long' && direction !== 'short') {
        throw new Error('Perp position item includes an unsupported direction.');
      }

      const status = readString(position, 'status');
      if (status !== 'open' && status !== 'closed' && status !== 'liquidated') {
        throw new Error('Perp position item includes an unsupported status.');
      }

      return {
        positionId: readString(position, 'positionId'),
        accountId: readString(position, 'accountId'),
        venue: positionVenue,
        instrument: readString(position, 'instrument'),
        direction,
        status,
        size: readString(position, 'size'),
        entryPrice: readString(position, 'entryPrice'),
        markPrice: readString(position, 'markPrice'),
        notionalValue: readString(position, 'notionalValue'),
        leverage: typeof position.leverage === 'string' ? position.leverage : undefined,
        unrealizedPnlUsd: readString(position, 'unrealizedPnlUsd'),
        lastUpdatedAt: readString(position, 'lastUpdatedAt'),
      };
    }),
    source: readString(payload, 'source'),
  };
}
