import type { ChainId } from './index.js';

export type PositionSide = 'long' | 'short';
export type PositionStatus = 'open' | 'closed' | 'liquidated';

export interface PositionPnlPlaceholder {
  realizedPnl?: string;
  unrealizedPnl?: string;
  realizedPnlPct?: string;
  unrealizedPnlPct?: string;
  asOf: string;
}

export interface Position {
  id: string;
  walletAddress: string;
  chainId: ChainId;
  symbol: string;
  side: PositionSide;
  status: PositionStatus;
  quantity: string;
  entryPrice: string;
  markPrice?: string;
  notionalValue?: string;
  leverage?: string;
  openedAt: string;
  updatedAt: string;
  closedAt?: string;
  pnl?: PositionPnlPlaceholder;
}
