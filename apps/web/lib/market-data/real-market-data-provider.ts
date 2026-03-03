import type { MarketDataProvider } from '@/lib/market-data/provider';
import type { Balance, SpotPrice, TokenMetadata } from '@/lib/market-data/types';

function notImplemented(methodName: string): never {
  throw new Error(
    `RealMarketDataProvider.${methodName} is not implemented yet. Set MOCK_MARKET_DATA=true to use mock market data in development.`,
  );
}

export class RealMarketDataProvider implements MarketDataProvider {
  async getTokens(_chain?: string): Promise<TokenMetadata[]> {
    return notImplemented('getTokens');
  }

  async getSpotPrices(_symbols?: string[], _chain?: string): Promise<Record<string, SpotPrice>> {
    return notImplemented('getSpotPrices');
  }

  async getBalances(_account?: string, _chain?: string): Promise<Balance[]> {
    return notImplemented('getBalances');
  }
}
