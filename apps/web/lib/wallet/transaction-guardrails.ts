import type { UnsignedTxPayload } from '@dexera/shared-types';

import type { WalletSlot } from './types';

const FORBIDDEN_SIGNED_FIELDS = [
  'from',
  'signature',
  'rawTransaction',
  'signedTransaction',
  'txHash',
] as const;

export const SIGNING_ONLY_DISCLAIMER_LINES = [
  'Transactions are prepared server-side as unsigned payloads only.',
  'Your wallet signs locally in the browser. Private keys never leave your wallet.',
  'Verify the chain, destination, value, and calldata before approving.',
] as const;

export type TransactionGuardrailCode =
  | 'invalid-payload'
  | 'missing-wallet'
  | 'chain-mismatch'
  | 'wallet-mismatch'
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

function normalizeWalletAddress(walletAddress: string): string {
  return walletAddress.trim().toLowerCase();
}

export function validateUnsignedTxPayload(
  payload: unknown,
): { ok: true; payload: UnsignedTxPayload } | { ok: false; error: TransactionGuardrailError } {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: new TransactionGuardrailError('invalid-payload', 'Unsigned transaction payload must be an object.'),
    };
  }

  for (const key of ['id', 'walletAddress', 'kind', 'to', 'data', 'value']) {
    if (!hasNonEmptyString(payload, key)) {
      return {
        ok: false,
        error: new TransactionGuardrailError(
          'invalid-payload',
          `Unsigned transaction payload is missing a valid "${key}" field.`,
        ),
      };
    }
  }

  if (typeof payload.chainId !== 'number' || !Number.isInteger(payload.chainId) || payload.chainId <= 0) {
    return {
      ok: false,
      error: new TransactionGuardrailError(
        'invalid-payload',
        'Unsigned transaction payload must include a positive integer chainId.',
      ),
    };
  }

  for (const field of FORBIDDEN_SIGNED_FIELDS) {
    if (field in payload) {
      return {
        ok: false,
        error: new TransactionGuardrailError(
          'signed-field-present',
          `Unsigned transaction payload must not include "${field}".`,
        ),
      };
    }
  }

  return {
    ok: true,
    payload: payload as unknown as UnsignedTxPayload,
  };
}

export function assertUnsignedTxPayload(payload: unknown): asserts payload is UnsignedTxPayload {
  const result = validateUnsignedTxPayload(payload);

  if (!result.ok) {
    throw result.error;
  }
}

export function assertPayloadMatchesActiveWallet(
  payload: UnsignedTxPayload,
  activeWallet: Pick<WalletSlot, 'walletAddress' | 'chainId'> | null | undefined,
): void {
  if (!activeWallet) {
    throw new TransactionGuardrailError(
      'missing-wallet',
      'Connect a wallet before attempting to sign an unsigned transaction.',
    );
  }

  if (payload.chainId !== activeWallet.chainId) {
    throw new TransactionGuardrailError(
      'chain-mismatch',
      `Unsigned transaction chain ${payload.chainId} does not match active wallet chain ${activeWallet.chainId}.`,
    );
  }

  if (normalizeWalletAddress(payload.walletAddress) !== normalizeWalletAddress(activeWallet.walletAddress)) {
    throw new TransactionGuardrailError(
      'wallet-mismatch',
      `Unsigned transaction wallet ${payload.walletAddress} does not match active wallet ${activeWallet.walletAddress}.`,
    );
  }
}

export function assertClientSigningContext(): void {
  if (typeof window === 'undefined') {
    throw new TransactionGuardrailError(
      'server-signing-forbidden',
      'Transactions may only be signed from the client runtime.',
    );
  }
}
