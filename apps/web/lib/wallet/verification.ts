import type {
  BffWalletChallengeRequest,
  BffWalletChallengeResponse,
  BffWalletVerifyRequest,
  BffWalletVerifyResponse,
} from '@dexera/api-types/openapi';

const DEFAULT_CHALLENGE_ENDPOINT = '/api/v1/wallet/challenge';
const DEFAULT_VERIFY_ENDPOINT = '/api/v1/wallet/verify';

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Wallet verification response is missing "${key}".`);
  }

  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`Wallet verification response is missing "${key}".`);
  }

  return value;
}

async function decodeJSONResponse<T>(response: Response): Promise<T> {
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

    if (isRecord(payload)) {
      const errorMessage = payload.error;
      if (typeof errorMessage === 'string' && errorMessage.trim().length > 0) {
        throw new Error(errorMessage);
      }
    }

    throw new Error(`Wallet verification request failed with status ${response.status}.`);
  }

  return payload as T;
}

export async function requestWalletChallenge(
  request: BffWalletChallengeRequest,
  options?: {
    endpoint?: string;
    fetchImpl?: FetchLike;
  },
): Promise<BffWalletChallengeResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? DEFAULT_CHALLENGE_ENDPOINT;

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const payload = await decodeJSONResponse<unknown>(response);
  if (!isRecord(payload)) {
    throw new Error('Wallet challenge response must be a JSON object.');
  }

  return {
    challengeId: readString(payload, 'challengeId'),
    message: readString(payload, 'message'),
    issuedAt: readString(payload, 'issuedAt'),
    expiresAt: readString(payload, 'expiresAt'),
  };
}

export async function verifyWalletOwnership(
  request: BffWalletVerifyRequest,
  options?: {
    endpoint?: string;
    fetchImpl?: FetchLike;
  },
): Promise<BffWalletVerifyResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? DEFAULT_VERIFY_ENDPOINT;

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const payload = await decodeJSONResponse<unknown>(response);
  if (!isRecord(payload)) {
    throw new Error('Wallet verify response must be a JSON object.');
  }

  const venue = readString(payload, 'venue');
  if (venue !== 'hyperliquid' && venue !== 'aster') {
    throw new Error('Wallet verify response includes an unsupported venue.');
  }

  return {
    ownershipVerified: readBoolean(payload, 'ownershipVerified'),
    venue,
    eligible: readBoolean(payload, 'eligible'),
    reason: readString(payload, 'reason'),
    checkedAt: readString(payload, 'checkedAt'),
    source: readString(payload, 'source'),
  };
}
