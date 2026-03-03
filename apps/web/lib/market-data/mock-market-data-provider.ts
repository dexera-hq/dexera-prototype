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
    const chainSymbols = this.getChainSymbols(chain);
    if (chainSymbols.length === 0) {
      return {};
    }

    const sourceSymbols = symbols.length > 0 ? symbols : chainSymbols;
    const resolvedSymbols = this.scopeSymbolsToChain(sourceSymbols, chainSymbols);
    if (resolvedSymbols.length === 0) {
      return {};
    }

    return getMockSpotPrices(resolvedSymbols, { jitter: this.jitter });
  }

  async getBalances(account?: string, _chain?: string): Promise<Balance[]> {
    return getMockBalances(account);
  }

  private getChainSymbols(chain?: string): string[] {
    return getMockTokens(chain ?? this.defaultChain).map((token) => token.symbol);
  }

  private scopeSymbolsToChain(symbols: string[], chainSymbols: string[]): string[] {
    const allowedSymbols = new Set(chainSymbols.map((symbol) => symbol.toUpperCase()));
    return symbols
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => symbol.length > 0 && allowedSymbols.has(symbol));
  }
}
