import type { UnsignedActionPayload } from '@dexera/shared-types';

import {
  TransactionGuardrailError,
  assertClientSigningContext,
  assertPayloadMatchesActiveWallet,
  assertUnsignedActionPayload,
} from './transaction-guardrails';
import type { ActionSubmissionResult, WalletSlot } from './types';

export interface ClientActionSubmitter {
  sendAction: (parameters: {
    orderId: string;
    accountId: string;
    payload: UnsignedActionPayload;
  }) => Promise<{ actionHash: string; orderId?: string; venueOrderId?: string }>;
}

export async function submitUnsignedAction(parameters: {
  orderId: string;
  payload: unknown;
  activeWallet: WalletSlot | null;
  submitter: ClientActionSubmitter;
}): Promise<ActionSubmissionResult> {
  assertClientSigningContext();
  assertUnsignedActionPayload(parameters.payload);
  assertPayloadMatchesActiveWallet(parameters.payload, parameters.activeWallet);
  const activeWallet = parameters.activeWallet;

  if (!activeWallet) {
    throw new TransactionGuardrailError('missing-wallet', 'Connect a wallet before signing.');
  }
  const orderId = parameters.orderId.trim();
  if (orderId.length === 0) {
    throw new TransactionGuardrailError(
      'invalid-payload',
      'Unsigned action response is missing orderId.',
    );
  }

  const submission = await parameters.submitter.sendAction({
    orderId,
    accountId: activeWallet.accountId,
    payload: parameters.payload,
  });
  const actionHash = submission.actionHash.trim();

  if (actionHash.length === 0) {
    throw new TransactionGuardrailError(
      'signing-failed',
      'Wallet submission returned an empty action hash.',
    );
  }

  return {
    orderId: submission.orderId?.trim() || orderId,
    actionHash,
    unsignedActionPayloadId: parameters.payload.id,
    accountId: activeWallet.accountId,
    venue: activeWallet.venue,
    venueOrderId: submission.venueOrderId?.trim() || undefined,
  };
}
