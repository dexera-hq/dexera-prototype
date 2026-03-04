import type { VenueId, Wallet } from '@dexera/shared-types';

export type WalletSlotStatus = 'connected' | 'disconnected' | 'stale';
export type WalletOwnershipStatus = 'unverified' | 'verified' | 'failed';
export type WalletEligibilityStatus =
  | 'unknown'
  | 'checking'
  | 'tradable'
  | 'not-eligible'
  | 'error';

export const WALLET_CONNECTOR_IDS = [
  'metaMaskInjected',
  'coinbaseInjected',
  'rabbyInjected',
  'injected',
] as const;
export type WalletConnectorId = (typeof WALLET_CONNECTOR_IDS)[number];

export type WalletConnectorUnavailableReason = 'connector-in-use' | 'connector-disabled';

export interface WalletSlot extends Wallet {
  id: string;
  connectorId: WalletConnectorId;
  label?: string;
  lastConnectedAt: string;
  status: WalletSlotStatus;
  ownershipStatus: WalletOwnershipStatus;
  eligibilityStatus: WalletEligibilityStatus;
  eligibilityReason?: string;
  lastVerifiedAt?: string;
}

export interface WalletSessionState {
  slots: WalletSlot[];
  activeSlotId: string | null;
}

export interface ConnectedWalletPayload extends Wallet {
  slotId?: string;
  connectorId: WalletConnectorId;
  label?: string;
  connectedAt?: string;
  ownershipStatus?: WalletOwnershipStatus;
  eligibilityStatus?: WalletEligibilityStatus;
  eligibilityReason?: string;
  lastVerifiedAt?: string;
}

export interface WalletConnectorOption {
  id: WalletConnectorId;
  label: string;
  available: boolean;
  unavailableReason?: WalletConnectorUnavailableReason;
}

export interface ActionSubmissionResult {
  actionHash: string;
  unsignedActionPayloadId: string;
  accountId: string;
  venue: VenueId;
}

export type ConnectWalletReason =
  | 'connected'
  | 'reconnected'
  | 'unavailable'
  | 'failed'
  | 'connector-in-use'
  | 'connector-missing'
  | 'verification-failed';

export type WalletStateChangeReason =
  | 'added'
  | 'updated'
  | 'activated'
  | 'disconnected'
  | 'removed'
  | 'status-updated'
  | 'cleared'
  | 'slot-not-found'
  | 'invalid-payload'
  | 'slots-full'
  | 'unavailable'
  | 'no-live-session'
  | 'reconnected'
  | 'connector-in-use'
  | 'connector-missing'
  | 'verification-updated';

export interface WalletStateResult {
  state: WalletSessionState;
  changed: boolean;
  reason: WalletStateChangeReason;
  affectedSlotId?: string;
}

export interface ConnectWalletResult {
  connected: boolean;
  reason: ConnectWalletReason;
}

export interface WalletManagerApi {
  slots: WalletSlot[];
  activeSlot: WalletSlot | null;
  activeSlotId: string | null;
  canAddWallet: boolean;
  hasHydrated: boolean;
  getConnectorOptions: () => WalletConnectorOption[];
  connectNewSlot: (connectorId: WalletConnectorId, venue: VenueId) => Promise<ConnectWalletResult>;
  reconnectSlot: (slotId: string) => Promise<ConnectWalletResult>;
  setActiveSlot: (slotId: string) => WalletStateResult;
  disconnectSlot: (slotId: string) => Promise<WalletStateResult>;
  removeSlot: (slotId: string) => WalletStateResult;
  clearAllSlots: () => WalletStateResult;
}

export function isWalletSlotTradable(
  slot: Pick<WalletSlot, 'status' | 'ownershipStatus' | 'eligibilityStatus'> | null | undefined,
): boolean {
  if (!slot) {
    return false;
  }

  return (
    slot.status === 'connected' &&
    slot.ownershipStatus === 'verified' &&
    slot.eligibilityStatus === 'tradable'
  );
}
