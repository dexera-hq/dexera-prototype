import type { ChainId, Wallet } from '@dexera/shared-types';

export type WalletSlotStatus = 'connected' | 'disconnected' | 'stale';

export const WALLET_CONNECTOR_IDS = ['injected', 'coinbaseWalletSDK', 'walletConnect'] as const;
export type WalletConnectorId = (typeof WALLET_CONNECTOR_IDS)[number];

export type WalletConnectorUnavailableReason = 'connector-in-use' | 'connector-disabled';

export interface WalletSlot extends Wallet {
  id: string;
  connectorId: WalletConnectorId;
  label?: string;
  lastConnectedAt: string;
  status: WalletSlotStatus;
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
}

export interface WalletConnectorOption {
  id: WalletConnectorId;
  label: string;
  available: boolean;
  unavailableReason?: WalletConnectorUnavailableReason;
}

export interface TransactionSigningResult {
  signedTransaction: string;
  unsignedTxPayloadId: string;
  walletAddress: string;
  chainId: ChainId;
}

export type ConnectWalletReason =
  | 'connected'
  | 'reconnected'
  | 'unavailable'
  | 'failed'
  | 'connector-in-use'
  | 'connector-missing';

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
  | 'connector-missing';

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
  connectNewSlot: (connectorId: WalletConnectorId) => Promise<ConnectWalletResult>;
  reconnectSlot: (slotId: string) => Promise<ConnectWalletResult>;
  setActiveSlot: (slotId: string) => WalletStateResult;
  disconnectSlot: (slotId: string) => Promise<WalletStateResult>;
  removeSlot: (slotId: string) => WalletStateResult;
  clearAllSlots: () => WalletStateResult;
}
