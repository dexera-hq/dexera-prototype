import type {
  BffSubmitSignedActionRequest,
  BffSubmitSignedActionResponse,
} from '@dexera/api-types/openapi';

import { TransactionGuardrailError } from './transaction-guardrails';

const DEFAULT_SIGNED_ACTION_SUBMIT_ENDPOINT = '/api/v1/perp/actions/submit';

type FetchLike = typeof fetch;

export type SubmitSignedActionClientResponse = BffSubmitSignedActionResponse & {
  debugReason?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function submitSignedAction(
  request: BffSubmitSignedActionRequest,
  options?: {
    endpoint?: string;
    fetchImpl?: FetchLike;
  },
): Promise<SubmitSignedActionClientResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? DEFAULT_SIGNED_ACTION_SUBMIT_ENDPOINT;

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new TransactionGuardrailError(
      'signing-failed',
      `Signed action submission failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;
  if (!isRecord(payload)) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Signed action submit response must be a JSON object.',
    );
  }

  if (typeof payload.orderId !== 'string' || payload.orderId.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Signed submit response is missing orderId.',
    );
  }
  if (typeof payload.actionHash !== 'string' || payload.actionHash.trim().length === 0) {
    throw new TransactionGuardrailError(
      'signing-failed',
      'Signed submit response is missing actionHash.',
    );
  }
  if (typeof payload.venue !== 'string' || payload.venue.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Signed submit response is missing venue.',
    );
  }
  if (typeof payload.status !== 'string' || payload.status.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Signed submit response is missing status.',
    );
  }
  if (typeof payload.source !== 'string' || payload.source.trim().length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Signed submit response is missing source.',
    );
  }
  if (
    payload.venueOrderId !== undefined &&
    (typeof payload.venueOrderId !== 'string' || payload.venueOrderId.trim().length === 0)
  ) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Signed submit response venueOrderId must be a non-empty string when provided.',
    );
  }
  if (
    payload.debugReason !== undefined &&
    (typeof payload.debugReason !== 'string' || payload.debugReason.trim().length === 0)
  ) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Signed submit response debugReason must be a non-empty string when provided.',
    );
  }

  return {
    orderId: payload.orderId,
    actionHash: payload.actionHash,
    venue: payload.venue as BffSubmitSignedActionResponse['venue'],
    status: payload.status,
    venueOrderId: payload.venueOrderId as string | undefined,
    debugReason: payload.debugReason as string | undefined,
    source: payload.source,
  };
}
