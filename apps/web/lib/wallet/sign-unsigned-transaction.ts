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
    accountId: string;
    payload: UnsignedActionPayload;
  }) => Promise<string>;
}

export async function submitUnsignedAction(parameters: {
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

  const actionHash = await parameters.submitter.sendAction({
    accountId: activeWallet.accountId,
    payload: parameters.payload,
  });

  if (actionHash.trim().length === 0) {
    throw new TransactionGuardrailError(
      'signing-failed',
      'Wallet submission returned an empty action hash.',
    );
  }

  return {
    actionHash,
    unsignedActionPayloadId: parameters.payload.id,
    accountId: activeWallet.accountId,
    venue: activeWallet.venue,
  };
}
