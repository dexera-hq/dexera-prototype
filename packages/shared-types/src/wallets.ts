import type { ChainId } from './index.js';

export interface Wallet {
  address: string;
  chainId: ChainId;
}

export interface ConnectedWallet extends Wallet {
  label?: string;
}
