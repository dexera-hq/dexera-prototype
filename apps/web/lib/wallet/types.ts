export type WalletSlotStatus = 'connected' | 'disconnected' | 'stale';

export interface WalletSlot {
  id: string;
  address: string;
  chainId: number;
  connectorId: string;
  label?: string;
  lastConnectedAt: string;
  status: WalletSlotStatus;
}

export interface WalletSessionState {
  slots: WalletSlot[];
  activeSlotId: string | null;
}

export interface ConnectedWalletPayload {
  address: string;
  chainId: number;
  connectorId: string;
  label?: string;
  connectedAt?: string;
}

export type ConnectWalletReason = 'connected' | 'unavailable' | 'failed';

export type WalletStateChangeReason =
  | 'added'
  | 'updated'
  | 'activated'
  | 'removed'
  | 'status-updated'
  | 'cleared'
  | 'slot-not-found'
  | 'invalid-payload'
  | 'slots-full'
  | 'unavailable'
  | 'no-live-session';

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
  connectWallet: () => Promise<ConnectWalletResult>;
  syncFromWagmiSession: () => WalletStateResult;
  setActiveSlot: (slotId: string) => WalletStateResult;
  disconnectSlot: (slotId: string) => WalletStateResult;
  replaceSlot: (slotId: string) => WalletStateResult;
  clearAllSlots: () => WalletStateResult;
}
