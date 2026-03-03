import { getDefaultChain } from '@/lib/market-data/config';
import { getMockBalances, getMockSpotPrices, getMockTokens } from '@/lib/market-data/mock-market-data';
import type { MarketDataProvider } from '@/lib/market-data/provider';
import type { Balance, SpotPrice, TokenMetadata } from '@/lib/market-data/types';

type MockMarketDataProviderOptions = {
  jitter: boolean;
  defaultChain: string;
};

export class MockMarketDataProvider implements MarketDataProvider {
  private readonly jitter: boolean;
  private readonly defaultChain: string;

  constructor(options?: Partial<MockMarketDataProviderOptions>) {
    this.jitter = options?.jitter ?? false;
    this.defaultChain = options?.defaultChain ?? getDefaultChain();
  }

  async getTokens(chain?: string): Promise<TokenMetadata[]> {
    return getMockTokens(chain ?? this.defaultChain);
  }

  async getSpotPrices(symbols: string[] = [], chain?: string): Promise<Record<string, SpotPrice>> {
    const resolvedSymbols = symbols.length > 0 ? symbols : this.getChainSymbols(chain);
    return getMockSpotPrices(resolvedSymbols, { jitter: this.jitter });
  }

  async getBalances(account?: string, _chain?: string): Promise<Balance[]> {
    return getMockBalances(account);
  }

  private getChainSymbols(chain?: string): string[] {
    return getMockTokens(chain ?? this.defaultChain).map((token) => token.symbol);
  }
}
