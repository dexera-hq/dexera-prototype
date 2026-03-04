import type { Wallet } from './wallets.js';

export interface PerpOrderPreviewBreakdown {
  estimatedFee: string;
  estimatedFunding?: string;
  slippageBps?: number;
}

export interface PerpOrderPreview extends Wallet {
  previewId: string;
  instrument: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  size: string;
  limitPrice?: string;
  markPrice?: string;
  estimatedNotional: string;
  breakdown: PerpOrderPreviewBreakdown;
  createdAt: string;
  expiresAt: string;
}
