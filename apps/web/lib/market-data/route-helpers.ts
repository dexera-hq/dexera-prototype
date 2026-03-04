import { NextResponse } from 'next/server';
import { getDefaultVenue } from '@/lib/market-data/config';

function buildUrl(request: Request): URL {
  return new URL(request.url);
}

export function resolveVenueFromRequest(request: Request): string {
  const venueParam = buildUrl(request).searchParams.get('venue')?.trim();
  if (venueParam && venueParam.length > 0) {
    return venueParam;
  }

  return getDefaultVenue();
}

export function resolveInstrumentsFromRequest(request: Request): string[] {
  const instrumentsParam = buildUrl(request).searchParams.get('instruments');
  if (!instrumentsParam) {
    return [];
  }

  const normalized = instrumentsParam
    .split(',')
    .map((instrument) => instrument.trim().toUpperCase())
    .filter((instrument) => instrument.length > 0);

  return [...new Set(normalized)];
}

export function resolveAccountIdFromRequest(request: Request): string | undefined {
  const accountId = buildUrl(request).searchParams.get('accountId')?.trim();
  return accountId && accountId.length > 0 ? accountId : undefined;
}

export function marketDataErrorResponse(error: unknown): Response {
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : 'Unexpected market data provider error';
  const normalizedMessage = message.toLowerCase();
  const status = normalizedMessage.includes('not implemented') ? 501 : 500;

  return NextResponse.json({ error: message }, { status });
}
