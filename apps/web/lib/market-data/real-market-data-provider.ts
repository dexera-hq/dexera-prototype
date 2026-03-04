import type { MarketDataProvider } from '@/lib/market-data/provider';
import type { InstrumentMetadata, MarkPrice, PerpPosition } from '@/lib/market-data/types';

function notImplemented(methodName: string): never {
  throw new Error(
    `RealMarketDataProvider.${methodName} is not implemented yet. Set MOCK_MARKET_DATA=true to use mock market data in development.`,
  );
}

export class RealMarketDataProvider implements MarketDataProvider {
  async getInstruments(_venue?: string): Promise<InstrumentMetadata[]> {
    return notImplemented('getInstruments');
  }

  async getMarkPrices(
    _instruments?: string[],
    _venue?: string,
  ): Promise<Record<string, MarkPrice>> {
    return notImplemented('getMarkPrices');
  }

  async getPositions(_accountId?: string, _venue?: string): Promise<PerpPosition[]> {
    return notImplemented('getPositions');
  }
}
