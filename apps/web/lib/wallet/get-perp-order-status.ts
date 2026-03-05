import type { BffPerpOrderStatusResponse } from '@dexera/api-types/openapi';

import { TransactionGuardrailError } from './transaction-guardrails';

const DEFAULT_PERP_ORDER_STATUS_ENDPOINT = '/api/v1/perp/orders/status';

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function getPerpOrderStatus(
  request: {
    accountId: string;
    venue: 'hyperliquid';
    venueOrderId: string;
    orderId?: string;
  },
  options?: {
    endpoint?: string;
    fetchImpl?: FetchLike;
  },
): Promise<BffPerpOrderStatusResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? DEFAULT_PERP_ORDER_STATUS_ENDPOINT;

  const params = new URLSearchParams({
    accountId: request.accountId,
    venue: request.venue,
    venueOrderId: request.venueOrderId,
  });
  if (request.orderId && request.orderId.trim().length > 0) {
    params.set('orderId', request.orderId);
  }

  const response = await fetchImpl(`${endpoint}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new TransactionGuardrailError(
      'network-failure',
      `Perp order status request failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;
  if (!isRecord(payload)) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Perp order status response must be a JSON object.',
    );
  }

  if (typeof payload.accountId !== 'string' || payload.accountId.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Perp order status response is missing accountId.',
    );
  }
  if (payload.venue !== 'hyperliquid') {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Perp order status response venue must be hyperliquid.',
    );
  }
  if (typeof payload.venueOrderId !== 'string' || payload.venueOrderId.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Perp order status response is missing venueOrderId.',
    );
  }
  if (typeof payload.status !== 'string' || payload.status.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Perp order status response is missing status.',
    );
  }
  if (typeof payload.venueStatus !== 'string' || payload.venueStatus.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Perp order status response is missing venueStatus.',
    );
  }
  if (typeof payload.isTerminal !== 'boolean') {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Perp order status response is missing isTerminal.',
    );
  }
  if (typeof payload.lastUpdatedAt !== 'string' || payload.lastUpdatedAt.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Perp order status response is missing lastUpdatedAt.',
    );
  }
  if (typeof payload.source !== 'string' || payload.source.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Perp order status response is missing source.',
    );
  }

  return {
    accountId: payload.accountId,
    venue: 'hyperliquid',
    orderId: typeof payload.orderId === 'string' ? payload.orderId : undefined,
    venueOrderId: payload.venueOrderId,
    status: payload.status,
    venueStatus: payload.venueStatus,
    isTerminal: payload.isTerminal,
    lastUpdatedAt: payload.lastUpdatedAt,
    source: payload.source,
  };
}
