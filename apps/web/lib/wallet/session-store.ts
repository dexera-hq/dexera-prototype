import type {
  ConnectedWalletPayload,
  WalletConnectorId,
  WalletSessionState,
  WalletSlot,
  WalletSlotStatus,
  WalletStateChangeReason,
  WalletStateResult,
} from './types';
import { WALLET_CONNECTOR_IDS } from './types';

export const MAX_WALLET_SLOTS = 3;
export const WALLET_SESSION_STORAGE_KEY = 'dexera.wallet-manager.v2';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem' | 'removeItem'>;

const VALID_SLOT_STATUSES: readonly WalletSlotStatus[] = ['connected', 'disconnected', 'stale'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWalletConnectorId(value: unknown): value is WalletConnectorId {
  return typeof value === 'string' && WALLET_CONNECTOR_IDS.includes(value as WalletConnectorId);
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function createSlotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `wallet-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

function sortSlotsByRecency(slots: WalletSlot[]): WalletSlot[] {
  return [...slots].sort((left, right) =>
    right.lastConnectedAt.localeCompare(left.lastConnectedAt),
  );
}

function normalizeState(state: WalletSessionState): WalletSessionState {
  const slots = sortSlotsByRecency(state.slots).slice(0, MAX_WALLET_SLOTS);
  const hasActiveSlot =
    state.activeSlotId !== null && slots.some((slot) => slot.id === state.activeSlotId);

  return {
    slots,
    activeSlotId: hasActiveSlot ? state.activeSlotId : (slots[0]?.id ?? null),
  };
}

function buildResult(
  state: WalletSessionState,
  changed: boolean,
  reason: WalletStateChangeReason,
  affectedSlotId?: string,
): WalletStateResult {
  const normalized = normalizeState(state);

  if (affectedSlotId) {
    return { state: normalized, changed, reason, affectedSlotId };
  }

  return { state: normalized, changed, reason };
}

function coerceWalletSlot(candidate: unknown): WalletSlot | null {
  if (!isRecord(candidate)) {
    return null;
  }

  const { id, address, chainId, connectorId, label, lastConnectedAt, status } = candidate;

  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }

  if (typeof address !== 'string' || address.trim().length === 0) {
    return null;
  }

  if (typeof chainId !== 'number' || !Number.isInteger(chainId) || chainId <= 0) {
    return null;
  }

  if (!isWalletConnectorId(connectorId)) {
    return null;
  }

  if (typeof lastConnectedAt !== 'string' || lastConnectedAt.length === 0) {
    return null;
  }

  if (typeof status !== 'string' || !VALID_SLOT_STATUSES.includes(status as WalletSlotStatus)) {
    return null;
  }

  return {
    id,
    address: normalizeAddress(address),
    chainId,
    connectorId,
    label: typeof label === 'string' && label.trim().length > 0 ? label.trim() : undefined,
    lastConnectedAt,
    status: status as WalletSlotStatus,
  };
}

export function walletAddressesMatch(left: string, right: string): boolean {
  return normalizeAddress(left) === normalizeAddress(right);
}

export function createEmptyWalletSessionState(): WalletSessionState {
  return { slots: [], activeSlotId: null };
}

export function serializeWalletSessionState(state: WalletSessionState): string {
  return JSON.stringify(normalizeState(state));
}

export function deserializeWalletSessionState(serializedState: string | null): WalletSessionState {
  if (!serializedState) {
    return createEmptyWalletSessionState();
  }

  try {
    const parsed = JSON.parse(serializedState) as unknown;

    if (!isRecord(parsed) || !Array.isArray(parsed.slots)) {
      return createEmptyWalletSessionState();
    }

    const slots = parsed.slots
      .map((candidate) => coerceWalletSlot(candidate))
      .filter((slot): slot is WalletSlot => slot !== null);
    const activeSlotId = typeof parsed.activeSlotId === 'string' ? parsed.activeSlotId : null;

    return normalizeState({ slots, activeSlotId });
  } catch {
    return createEmptyWalletSessionState();
  }
}

export function readWalletSessionState(storage: StorageReader): WalletSessionState {
  return deserializeWalletSessionState(storage.getItem(WALLET_SESSION_STORAGE_KEY));
}

export function writeWalletSessionState(storage: StorageWriter, state: WalletSessionState): void {
  storage.setItem(WALLET_SESSION_STORAGE_KEY, serializeWalletSessionState(state));
}

export function clearWalletSessionStorage(storage: StorageWriter): void {
  storage.removeItem(WALLET_SESSION_STORAGE_KEY);
}

export function upsertConnectedWallet(
  state: WalletSessionState,
  payload: ConnectedWalletPayload,
): WalletStateResult {
  const trimmedAddress = payload.address.trim();
  const trimmedSlotId = payload.slotId?.trim();

  if (trimmedAddress.length === 0 || !Number.isInteger(payload.chainId) || payload.chainId <= 0) {
    return buildResult(state, false, 'invalid-payload');
  }

  const normalizedAddress = normalizeAddress(trimmedAddress);
  const lastConnectedAt = payload.connectedAt ?? new Date().toISOString();
  const label = payload.label?.trim() || undefined;
  const existingSlot = trimmedSlotId
    ? state.slots.find((slot) => slot.id === trimmedSlotId)
    : state.slots.find(
        (slot) =>
          walletAddressesMatch(slot.address, normalizedAddress) &&
          slot.connectorId === payload.connectorId,
      );

  if (existingSlot) {
    const updatedSlot: WalletSlot = {
      ...existingSlot,
      address: normalizedAddress,
      chainId: payload.chainId,
      connectorId: payload.connectorId,
      label,
      lastConnectedAt,
      status: 'connected',
    };
    const remainingSlots = state.slots.filter((slot) => slot.id !== existingSlot.id);

    return buildResult(
      { slots: [updatedSlot, ...remainingSlots], activeSlotId: updatedSlot.id },
      true,
      'updated',
      updatedSlot.id,
    );
  }

  if (state.slots.length >= MAX_WALLET_SLOTS) {
    return buildResult(state, false, 'slots-full');
  }

  const newSlot: WalletSlot = {
    id: trimmedSlotId?.length ? trimmedSlotId : createSlotId(),
    address: normalizedAddress,
    chainId: payload.chainId,
    connectorId: payload.connectorId,
    label,
    lastConnectedAt,
    status: 'connected',
  };

  return buildResult(
    { slots: [newSlot, ...state.slots], activeSlotId: newSlot.id },
    true,
    'added',
    newSlot.id,
  );
}

export function setActiveWalletSlot(state: WalletSessionState, slotId: string): WalletStateResult {
  const matchingSlot = state.slots.find((slot) => slot.id === slotId);

  if (!matchingSlot) {
    return buildResult(state, false, 'slot-not-found');
  }

  if (state.activeSlotId === slotId) {
    return buildResult(state, false, 'activated', slotId);
  }

  return buildResult({ slots: state.slots, activeSlotId: slotId }, true, 'activated', slotId);
}

export function disconnectWalletSlot(state: WalletSessionState, slotId: string): WalletStateResult {
  const matchingSlot = state.slots.find((slot) => slot.id === slotId);

  if (!matchingSlot) {
    return buildResult(state, false, 'slot-not-found');
  }

  if (matchingSlot.status === 'disconnected') {
    return buildResult(state, false, 'disconnected', slotId);
  }

  const updatedSlots = state.slots.map<WalletSlot>((slot) =>
    slot.id === slotId
      ? {
          ...slot,
          status: 'disconnected',
        }
      : slot,
  );

  return buildResult(
    { slots: updatedSlots, activeSlotId: state.activeSlotId },
    true,
    'disconnected',
    slotId,
  );
}

export function removeWalletSlot(state: WalletSessionState, slotId: string): WalletStateResult {
  const matchingSlot = state.slots.find((slot) => slot.id === slotId);

  if (!matchingSlot) {
    return buildResult(state, false, 'slot-not-found');
  }

  const remainingSlots = state.slots.filter((slot) => slot.id !== slotId);
  const nextActiveSlotId =
    state.activeSlotId === slotId ? (remainingSlots[0]?.id ?? null) : state.activeSlotId;

  return buildResult(
    { slots: remainingSlots, activeSlotId: nextActiveSlotId },
    true,
    'removed',
    slotId,
  );
}

export function clearWalletSessionSlots(): WalletStateResult {
  return buildResult(createEmptyWalletSessionState(), true, 'cleared');
}

export function markWalletSlotStatus(
  state: WalletSessionState,
  slotId: string,
  status: WalletSlotStatus,
): WalletStateResult {
  const matchingSlot = state.slots.find((slot) => slot.id === slotId);

  if (!matchingSlot) {
    return buildResult(state, false, 'slot-not-found');
  }

  if (matchingSlot.status === status) {
    return buildResult(state, false, 'status-updated', slotId);
  }

  const updatedSlots = state.slots.map<WalletSlot>((slot) =>
    slot.id === slotId
      ? {
          ...slot,
          status,
        }
      : slot,
  );

  return buildResult(
    { slots: updatedSlots, activeSlotId: state.activeSlotId },
    true,
    'status-updated',
    slotId,
  );
}

export function markAllWalletSlots(
  state: WalletSessionState,
  status: WalletSlotStatus,
): WalletStateResult {
  const hasChanges = state.slots.some((slot) => slot.status !== status);

  if (!hasChanges) {
    return buildResult(state, false, 'status-updated');
  }

  return buildResult(
    {
      slots: state.slots.map<WalletSlot>((slot) => ({
        ...slot,
        status,
      })),
      activeSlotId: state.activeSlotId,
    },
    true,
    'status-updated',
  );
}
