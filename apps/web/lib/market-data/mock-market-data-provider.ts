import { getDefaultVenue } from '@/lib/market-data/config';
import {
  getMockInstruments,
  getMockMarkPrices,
  getMockPerpFills,
  getMockPositions,
} from '@/lib/market-data/mock-market-data';
import type { MarketDataProvider } from '@/lib/market-data/provider';
import type { InstrumentMetadata, MarkPrice, PerpFill, PerpPosition } from '@/lib/market-data/types';

type MockMarketDataProviderOptions = {
  jitter: boolean;
  defaultVenue: string;
};

export class MockMarketDataProvider implements MarketDataProvider {
  private readonly jitter: boolean;
  private readonly defaultVenue: string;

  constructor(options?: Partial<MockMarketDataProviderOptions>) {
    this.jitter = options?.jitter ?? false;
    this.defaultVenue = options?.defaultVenue ?? getDefaultVenue();
  }

  async getInstruments(venue?: string): Promise<InstrumentMetadata[]> {
    return getMockInstruments(venue ?? this.defaultVenue);
  }

  async getMarkPrices(
    instruments: string[] = [],
    venue?: string,
  ): Promise<Record<string, MarkPrice>> {
    const venueInstruments = this.getVenueInstruments(venue);
    if (venueInstruments.length === 0) {
      return {};
    }

    const sourceInstruments = instruments.length > 0 ? instruments : venueInstruments;
    const resolvedInstruments = this.scopeInstrumentsToVenue(sourceInstruments, venueInstruments);
    if (resolvedInstruments.length === 0) {
      return {};
    }

    return getMockMarkPrices(resolvedInstruments, { jitter: this.jitter });
  }

  async getPositions(accountId?: string, _venue?: string): Promise<PerpPosition[]> {
    return getMockPositions(accountId);
  }

  async getPerpFills(accountId?: string, venue?: string): Promise<PerpFill[]> {
    return getMockPerpFills(accountId, venue ?? this.defaultVenue);
  }

  private getVenueInstruments(venue?: string): string[] {
    return getMockInstruments(venue ?? this.defaultVenue).map(
      (instrument) => instrument.instrument,
    );
  }

  private scopeInstrumentsToVenue(instruments: string[], venueInstruments: string[]): string[] {
    const allowedInstruments = new Set(
      venueInstruments.map((instrument) => instrument.toUpperCase()),
    );
    return instruments
      .map((instrument) => instrument.trim().toUpperCase())
      .filter((instrument) => instrument.length > 0 && allowedInstruments.has(instrument));
  }
}
