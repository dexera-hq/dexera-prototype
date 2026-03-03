import type { UnsignedTxPayload } from '@dexera/shared-types';

import {
  TransactionGuardrailError,
  assertClientSigningContext,
  assertPayloadMatchesActiveWallet,
  assertUnsignedTxPayload,
} from './transaction-guardrails';
import type { TransactionSigningResult, WalletSlot } from './types';

export interface ClientTransactionSigner {
  signTransaction: (parameters: {
    walletAddress: string;
    payload: UnsignedTxPayload;
  }) => Promise<string>;
}

export async function signUnsignedTransaction(parameters: {
  payload: unknown;
  activeWallet: WalletSlot | null;
  signer: ClientTransactionSigner;
}): Promise<TransactionSigningResult> {
  assertClientSigningContext();
  assertUnsignedTxPayload(parameters.payload);
  assertPayloadMatchesActiveWallet(parameters.payload, parameters.activeWallet);
  const activeWallet = parameters.activeWallet;

  if (!activeWallet) {
    throw new TransactionGuardrailError('missing-wallet', 'Connect a wallet before signing.');
  }

  const signedTransaction = await parameters.signer.signTransaction({
    walletAddress: activeWallet.walletAddress,
    payload: parameters.payload,
  });

  if (signedTransaction.trim().length === 0) {
    throw new TransactionGuardrailError('signing-failed', 'Wallet signer returned an empty signed transaction.');
  }

  return {
    signedTransaction,
    unsignedTxPayloadId: parameters.payload.id,
    walletAddress: activeWallet.walletAddress,
    chainId: activeWallet.chainId,
  };
}
