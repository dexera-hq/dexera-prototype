import type {
  BffBuildUnsignedActionRequest,
  BffBuildUnsignedActionResponse,
} from '@dexera/api-types/openapi';

import { TransactionGuardrailError, assertUnsignedActionPayload } from './transaction-guardrails';

const DEFAULT_UNSIGNED_ACTION_ENDPOINT = '/api/v1/perp/actions/unsigned';
const CLIENT_SIGNING_ONLY_POLICY: BffBuildUnsignedActionResponse['signingPolicy'] =
  'client-signing-only';

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function buildUnsignedAction(
  request: BffBuildUnsignedActionRequest,
  options?: {
    endpoint?: string;
    fetchImpl?: FetchLike;
  },
): Promise<BffBuildUnsignedActionResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? DEFAULT_UNSIGNED_ACTION_ENDPOINT;

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
      `Unsigned action build failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!isRecord(payload)) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Unsigned action build response must be a JSON object.',
    );
  }

  if (payload.signingPolicy !== CLIENT_SIGNING_ONLY_POLICY) {
    throw new TransactionGuardrailError(
      'server-signing-forbidden',
      'Server responded with an unexpected signing policy.',
    );
  }

  assertUnsignedActionPayload(payload.unsignedActionPayload);

  if (typeof payload.orderId !== 'string' || payload.orderId.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Unsigned action response is missing orderId.',
    );
  }

  if (typeof payload.disclaimer !== 'string' || payload.disclaimer.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Unsigned action response is missing a signing disclaimer.',
    );
  }

  return {
    orderId: payload.orderId,
    signingPolicy: CLIENT_SIGNING_ONLY_POLICY,
    disclaimer: payload.disclaimer,
    unsignedActionPayload: payload.unsignedActionPayload,
  };
}
