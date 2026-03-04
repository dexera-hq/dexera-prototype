import {
  getDefaultVenue,
  isMockMarketDataEnabled,
  isMockMarketDataJitterEnabled,
} from '@/lib/market-data/config';
import { MockMarketDataProvider } from '@/lib/market-data/mock-market-data-provider';
import type { MarketDataProvider } from '@/lib/market-data/provider';
import { RealMarketDataProvider } from '@/lib/market-data/real-market-data-provider';

export function getMarketDataProvider(): MarketDataProvider {
  if (isMockMarketDataEnabled()) {
    return new MockMarketDataProvider({
      jitter: isMockMarketDataJitterEnabled(),
      defaultVenue: getDefaultVenue(),
    });
  }

  return new RealMarketDataProvider();
}
