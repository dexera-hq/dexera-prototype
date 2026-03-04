import type { VenueId } from './index.js';

export interface Wallet {
  accountId: string;
  venue: VenueId;
}

export interface ConnectedWallet extends Wallet {
  label?: string;
}
