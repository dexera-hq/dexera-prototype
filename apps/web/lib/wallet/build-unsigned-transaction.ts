import type {
  BffBuildUnsignedTransactionRequest,
  BffBuildUnsignedTransactionResponse,
} from '@dexera/api-types/openapi';

import { TransactionGuardrailError, assertUnsignedTxPayload } from './transaction-guardrails';

const DEFAULT_UNSIGNED_TRANSACTION_ENDPOINT = '/api/v1/transactions/unsigned';
const CLIENT_SIGNING_ONLY_POLICY: BffBuildUnsignedTransactionResponse['signingPolicy'] =
  'client-signing-only';

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function buildUnsignedTransaction(
  request: BffBuildUnsignedTransactionRequest,
  options?: {
    endpoint?: string;
    fetchImpl?: FetchLike;
  },
): Promise<BffBuildUnsignedTransactionResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? DEFAULT_UNSIGNED_TRANSACTION_ENDPOINT;

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
      `Unsigned transaction build failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!isRecord(payload)) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Unsigned transaction build response must be a JSON object.',
    );
  }

  if (payload.signingPolicy !== CLIENT_SIGNING_ONLY_POLICY) {
    throw new TransactionGuardrailError(
      'server-signing-forbidden',
      'Server responded with an unexpected signing policy.',
    );
  }

  assertUnsignedTxPayload(payload.unsignedTxPayload);

  if (typeof payload.orderId !== 'string' || payload.orderId.trim().length === 0) {
    throw new TransactionGuardrailError('invalid-payload', 'Unsigned transaction response is missing orderId.');
  }

  if (typeof payload.disclaimer !== 'string' || payload.disclaimer.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Unsigned transaction response is missing a signing disclaimer.',
    );
  }

  return {
    orderId: payload.orderId,
    signingPolicy: CLIENT_SIGNING_ONLY_POLICY,
    disclaimer: payload.disclaimer,
    unsignedTxPayload: payload.unsignedTxPayload,
  };
}
