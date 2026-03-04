import { NextResponse } from 'next/server';
import { getMarketDataProvider } from '@/lib/market-data/market-data-provider';
import {
  marketDataErrorResponse,
  resolveInstrumentsFromRequest,
  resolveVenueFromRequest,
} from '@/lib/market-data/route-helpers';

export async function GET(request: Request): Promise<Response> {
  try {
    const instruments = resolveInstrumentsFromRequest(request);
    const venue = resolveVenueFromRequest(request);
    const provider = getMarketDataProvider();
    const marks = await provider.getMarkPrices(instruments, venue);
    return NextResponse.json(marks);
  } catch (error) {
    return marketDataErrorResponse(error);
  }
}
