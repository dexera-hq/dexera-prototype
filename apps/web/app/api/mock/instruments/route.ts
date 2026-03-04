import { NextResponse } from 'next/server';
import { getMarketDataProvider } from '@/lib/market-data/market-data-provider';
import { marketDataErrorResponse, resolveVenueFromRequest } from '@/lib/market-data/route-helpers';

export async function GET(request: Request): Promise<Response> {
  try {
    const venue = resolveVenueFromRequest(request);
    const provider = getMarketDataProvider();
    const instruments = await provider.getInstruments(venue);
    return NextResponse.json(instruments);
  } catch (error) {
    return marketDataErrorResponse(error);
  }
}
