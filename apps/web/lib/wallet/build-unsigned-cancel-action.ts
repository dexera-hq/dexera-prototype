import type {
  BffBuildUnsignedActionResponse,
  BffBuildUnsignedCancelActionRequest,
} from '@dexera/api-types/openapi';

import { TransactionGuardrailError, assertUnsignedActionPayload } from './transaction-guardrails';

const DEFAULT_UNSIGNED_CANCEL_ACTION_ENDPOINT = '/api/v1/perp/cancels/unsigned';

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function buildUnsignedCancelAction(
  request: BffBuildUnsignedCancelActionRequest,
  options?: {
    endpoint?: string;
    fetchImpl?: FetchLike;
  },
): Promise<BffBuildUnsignedActionResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? DEFAULT_UNSIGNED_CANCEL_ACTION_ENDPOINT;

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      `Unsigned cancel action build failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!isRecord(payload)) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Unsigned cancel action build response must be a JSON object.',
    );
  }

  if (payload.signingPolicy !== 'client-signing-only') {
    throw new TransactionGuardrailError(
      'server-signing-forbidden',
      'Server responded with an unexpected signing policy.',
    );
  }

  assertUnsignedActionPayload(payload.unsignedActionPayload);
  if (payload.unsignedActionPayload.kind !== 'perp_cancel_action') {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Unsigned cancel action response must include a perp_cancel_action payload.',
    );
  }

  if (typeof payload.orderId !== 'string' || payload.orderId.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Unsigned cancel action response is missing orderId.',
    );
  }

  if (typeof payload.disclaimer !== 'string' || payload.disclaimer.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Unsigned cancel action response is missing a signing disclaimer.',
    );
  }

  return {
    orderId: payload.orderId,
    signingPolicy: 'client-signing-only',
    disclaimer: payload.disclaimer,
    unsignedActionPayload: payload.unsignedActionPayload,
  };
}
