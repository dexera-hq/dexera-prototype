import type { UnsignedTxPayload } from '@dexera/shared-types';

import {
  TransactionGuardrailError,
  assertClientSigningContext,
  assertPayloadMatchesActiveWallet,
  assertUnsignedTxPayload,
} from './transaction-guardrails';
import type { TransactionSubmissionResult, WalletSlot } from './types';

export interface ClientTransactionSubmitter {
  sendTransaction: (parameters: {
    walletAddress: string;
    payload: UnsignedTxPayload;
  }) => Promise<string>;
}

export async function submitUnsignedTransaction(parameters: {
  payload: unknown;
  activeWallet: WalletSlot | null;
  submitter: ClientTransactionSubmitter;
}): Promise<TransactionSubmissionResult> {
  assertClientSigningContext();
  assertUnsignedTxPayload(parameters.payload);
  assertPayloadMatchesActiveWallet(parameters.payload, parameters.activeWallet);
  const activeWallet = parameters.activeWallet;

  if (!activeWallet) {
    throw new TransactionGuardrailError('missing-wallet', 'Connect a wallet before signing.');
  }

  const transactionHash = await parameters.submitter.sendTransaction({
    walletAddress: activeWallet.walletAddress,
    payload: parameters.payload,
  });

  if (transactionHash.trim().length === 0) {
    throw new TransactionGuardrailError(
      'signing-failed',
      'Wallet submission returned an empty transaction hash.',
    );
  }

  return {
    transactionHash,
    unsignedTxPayloadId: parameters.payload.id,
    walletAddress: activeWallet.walletAddress,
    chainId: activeWallet.chainId,
  };
}
