import { NextResponse } from 'next/server';
import { getMarketDataProvider } from '@/lib/market-data/market-data-provider';
import {
  marketDataErrorResponse,
  resolveAccountFromRequest,
  resolveChainFromRequest,
} from '@/lib/market-data/route-helpers';

export async function GET(request: Request): Promise<Response> {
  try {
    const account = resolveAccountFromRequest(request);
    const chain = resolveChainFromRequest(request);
    const provider = getMarketDataProvider();
    const balances = await provider.getBalances(account, chain);
    return NextResponse.json(balances);
  } catch (error) {
    return marketDataErrorResponse(error);
  }
}
