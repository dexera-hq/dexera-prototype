import type { Balance, SpotPrice, TokenMetadata } from '@/lib/market-data/types';

export interface MarketDataProvider {
  getTokens(chain?: string): Promise<TokenMetadata[]>;
  getSpotPrices(symbols?: string[], chain?: string): Promise<Record<string, SpotPrice>>;
  getBalances(account?: string, chain?: string): Promise<Balance[]>;
}
