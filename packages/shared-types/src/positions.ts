import type { Wallet } from './wallets.js';

export type PositionStatus = 'open' | 'closed' | 'liquidated';

export interface PositionPnlSnapshot {
  realizedPnl?: string;
  unrealizedPnl?: string;
  realizedPnlPct?: string;
  unrealizedPnlPct?: string;
  asOf: string;
}

export interface PerpPosition extends Wallet {
  id: string;
  instrument: string;
  direction: 'long' | 'short';
  status: PositionStatus;
  size: string;
  entryPrice: string;
  markPrice?: string;
  notionalValue?: string;
  leverage?: string;
  liquidationPrice?: string;
  marginMode?: 'cross' | 'isolated';
  openedAt: string;
  updatedAt: string;
  closedAt?: string;
  pnl?: PositionPnlSnapshot;
}
