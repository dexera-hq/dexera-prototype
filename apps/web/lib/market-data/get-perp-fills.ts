import type { BffPerpFillsResponse } from '@dexera/api-types/openapi';

const DEFAULT_PERP_FILLS_ENDPOINT = '/api/v1/perp/fills';

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Perp fills response is missing "${key}".`);
  }

  return value;
}

export async function getPerpFills(
  request: {
    accountId: string;
    venue: 'hyperliquid' | 'aster';
    instrument?: string;
  },
  options?: {
    endpoint?: string;
    fetchImpl?: FetchLike;
  },
): Promise<BffPerpFillsResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? DEFAULT_PERP_FILLS_ENDPOINT;

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
    throw new Error(`Perp fills request failed with status ${response.status}.`);
  }

  if (!isRecord(payload)) {
    throw new Error('Perp fills response must be a JSON object.');
  }

  const venue = readString(payload, 'venue');
  if (venue !== 'hyperliquid' && venue !== 'aster') {
    throw new Error('Perp fills response includes an unsupported venue.');
  }

  if (!Array.isArray(payload.fills)) {
    throw new Error('Perp fills response is missing fills.');
  }

  return {
    accountId: readString(payload, 'accountId'),
    venue,
    fills: payload.fills.map((fill) => {
      if (!isRecord(fill)) {
        throw new Error('Perp fill item must be an object.');
      }

      const fillVenue = readString(fill, 'venue');
      if (fillVenue !== 'hyperliquid' && fillVenue !== 'aster') {
        throw new Error('Perp fill item includes an unsupported venue.');
      }

      const side = readString(fill, 'side');
      if (side !== 'buy' && side !== 'sell') {
        throw new Error('Perp fill item includes an unsupported side.');
      }

      return {
        id: readString(fill, 'id'),
        accountId: readString(fill, 'accountId'),
        venue: fillVenue,
        orderId: readString(fill, 'orderId'),
        instrument: readString(fill, 'instrument'),
        side,
        size: readString(fill, 'size'),
        price: readString(fill, 'price'),
        feeAmount: typeof fill.feeAmount === 'string' ? fill.feeAmount : undefined,
        feeAsset: typeof fill.feeAsset === 'string' ? fill.feeAsset : undefined,
        filledAt: readString(fill, 'filledAt'),
      };
    }),
    source: readString(payload, 'source'),
  };
}
