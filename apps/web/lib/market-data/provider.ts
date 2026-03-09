import type { InstrumentMetadata, MarkPrice, PerpFill, PerpPosition } from '@/lib/market-data/types';

export interface MarketDataProvider {
  getInstruments(venue?: string): Promise<InstrumentMetadata[]>;
  getMarkPrices(instruments?: string[], venue?: string): Promise<Record<string, MarkPrice>>;
  getPositions(accountId?: string, venue?: string): Promise<PerpPosition[]>;
  getPerpFills(accountId?: string, venue?: string): Promise<PerpFill[]>;
}
