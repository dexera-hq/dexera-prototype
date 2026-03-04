import type { VenueId } from '@dexera/shared-types';

export const SUPPORTED_VENUES = ['hyperliquid', 'aster'] as const satisfies readonly VenueId[];

const VENUE_LABELS: Record<VenueId, string> = {
  hyperliquid: 'Hyperliquid',
  aster: 'Aster',
};

export function getWalletVenueLabel(venue: VenueId): string {
  return VENUE_LABELS[venue] ?? venue;
}
