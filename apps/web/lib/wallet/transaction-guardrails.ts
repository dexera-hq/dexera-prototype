import type { UnsignedActionPayload } from '@dexera/shared-types';

import type { WalletSlot } from './types';

const FORBIDDEN_SIGNED_FIELDS = ['signature', 'rawAction', 'signedAction', 'actionHash'] as const;

export const SIGNING_ONLY_DISCLAIMER_LINES = [
  'Actions are prepared server-side as unsigned payloads only.',
  'Your wallet signs locally in the browser. Private keys never leave your wallet runtime.',
  'Verify venue, account, instrument, side, and size before approving.',
] as const;

export type TransactionGuardrailCode =
  | 'invalid-payload'
  | 'network-failure'
  | 'missing-wallet'
  | 'venue-mismatch'
  | 'account-mismatch'
  | 'signed-field-present'
  | 'server-signing-forbidden'
  | 'signing-failed';

export class TransactionGuardrailError extends Error {
  constructor(
    public readonly code: TransactionGuardrailCode,
    message: string,
  ) {
    super(message);
    this.name = 'TransactionGuardrailError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasNonEmptyString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'string' && record[key].trim().length > 0;
}

function normalizeAccountId(accountId: string): string {
  return accountId.trim().toLowerCase();
}

export function validateUnsignedActionPayload(
  payload: unknown,
): { ok: true; payload: UnsignedActionPayload } | { ok: false; error: TransactionGuardrailError } {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: new TransactionGuardrailError(
        'invalid-payload',
        'Unsigned action payload must be an object.',
      ),
    };
  }

  for (const key of ['id', 'accountId', 'venue', 'kind']) {
    if (!hasNonEmptyString(payload, key)) {
      return {
        ok: false,
        error: new TransactionGuardrailError(
          'invalid-payload',
          `Unsigned action payload is missing a valid "${key}" field.`,
        ),
      };
    }
  }

  if (!isRecord(payload.action)) {
    return {
      ok: false,
      error: new TransactionGuardrailError(
        'invalid-payload',
        'Unsigned action payload must include an action object.',
      ),
    };
  }

  if (!isRecord(payload.walletRequest)) {
    return {
      ok: false,
      error: new TransactionGuardrailError(
        'invalid-payload',
        'Unsigned action payload must include a walletRequest object.',
      ),
    };
  }

  if (!hasNonEmptyString(payload.walletRequest, 'method')) {
    return {
      ok: false,
      error: new TransactionGuardrailError(
        'invalid-payload',
        'Unsigned action payload walletRequest.method is required.',
      ),
    };
  }

  if (
    'params' in payload.walletRequest &&
    !Array.isArray((payload.walletRequest as Record<string, unknown>).params)
  ) {
    return {
      ok: false,
      error: new TransactionGuardrailError(
        'invalid-payload',
        'Unsigned action payload walletRequest.params must be an array when provided.',
      ),
    };
  }

  if (payload.kind !== 'perp_order_action') {
    return {
      ok: false,
      error: new TransactionGuardrailError(
        'invalid-payload',
        'Unsupported unsigned action payload kind.',
      ),
    };
  }

  for (const field of FORBIDDEN_SIGNED_FIELDS) {
    if (field in payload) {
      return {
        ok: false,
        error: new TransactionGuardrailError(
          'signed-field-present',
          `Unsigned action payload must not include "${field}".`,
        ),
      };
    }
  }

  return {
    ok: true,
    payload: payload as unknown as UnsignedActionPayload,
  };
}

export function assertUnsignedActionPayload(
  payload: unknown,
): asserts payload is UnsignedActionPayload {
  const result = validateUnsignedActionPayload(payload);

  if (!result.ok) {
    throw result.error;
  }
}

export function assertPayloadMatchesActiveWallet(
  payload: UnsignedActionPayload,
  activeWallet: Pick<WalletSlot, 'accountId' | 'venue'> | null | undefined,
): void {
  if (!activeWallet) {
    throw new TransactionGuardrailError(
      'missing-wallet',
      'Connect a wallet before attempting to sign an unsigned action.',
    );
  }

  if (payload.venue !== activeWallet.venue) {
    throw new TransactionGuardrailError(
      'venue-mismatch',
      `Unsigned action venue ${payload.venue} does not match active wallet venue ${activeWallet.venue}.`,
    );
  }

  if (normalizeAccountId(payload.accountId) !== normalizeAccountId(activeWallet.accountId)) {
    throw new TransactionGuardrailError(
      'account-mismatch',
      `Unsigned action account ${payload.accountId} does not match active wallet ${activeWallet.accountId}.`,
    );
  }
}

export function assertClientSigningContext(): void {
  if (typeof window === 'undefined') {
    throw new TransactionGuardrailError(
      'server-signing-forbidden',
      'Actions may only be signed from the client runtime.',
    );
  }
}
