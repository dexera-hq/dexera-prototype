import { NextResponse } from 'next/server';
import { getMarketDataProvider } from '@/lib/market-data/market-data-provider';
import {
  marketDataErrorResponse,
  resolveAccountIdFromRequest,
  resolveVenueFromRequest,
} from '@/lib/market-data/route-helpers';

export async function GET(request: Request): Promise<Response> {
  try {
    const accountId = resolveAccountIdFromRequest(request);
    const venue = resolveVenueFromRequest(request);
    const provider = getMarketDataProvider();
    const fills = await provider.getPerpFills(accountId, venue);
    return NextResponse.json(fills);
  } catch (error) {
    return marketDataErrorResponse(error);
  }
}
