import type {
  ConnectedWalletPayload,
  WalletConnectorId,
  WalletEligibilityStatus,
  WalletOwnershipStatus,
  WalletSessionState,
  WalletSlot,
  WalletSlotStatus,
  WalletStateChangeReason,
  WalletStateResult,
} from './types';
import { WALLET_CONNECTOR_IDS } from './types';

export const MAX_WALLET_SLOTS = 3;
export const WALLET_SESSION_STORAGE_KEY = 'dexera.wallet-manager.v1';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem' | 'removeItem'>;

const VALID_SLOT_STATUSES: readonly WalletSlotStatus[] = ['connected', 'disconnected', 'stale'];
const VALID_VENUES = ['hyperliquid', 'aster'] as const;
const VALID_OWNERSHIP_STATUSES: readonly WalletOwnershipStatus[] = [
  'unverified',
  'verified',
  'failed',
];
const VALID_ELIGIBILITY_STATUSES: readonly WalletEligibilityStatus[] = [
  'unknown',
  'checking',
  'tradable',
  'not-eligible',
  'error',
];

type VenueId = (typeof VALID_VENUES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeAccountId(accountId: string): string {
  return accountId.trim().toLowerCase();
}

function normalizeVenue(value: unknown): VenueId | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return VALID_VENUES.includes(normalized as VenueId) ? (normalized as VenueId) : null;
}

function normalizeWalletConnectorId(value: unknown): WalletConnectorId | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  if (WALLET_CONNECTOR_IDS.includes(value as WalletConnectorId)) {
    return value as WalletConnectorId;
  }

  return null;
}

function normalizeOwnershipStatus(value: unknown): WalletOwnershipStatus | null {
  if (typeof value !== 'string') {
    return null;
  }

  return VALID_OWNERSHIP_STATUSES.includes(value as WalletOwnershipStatus)
    ? (value as WalletOwnershipStatus)
    : null;
}

function normalizeEligibilityStatus(value: unknown): WalletEligibilityStatus | null {
  if (typeof value !== 'string') {
    return null;
  }

  return VALID_ELIGIBILITY_STATUSES.includes(value as WalletEligibilityStatus)
    ? (value as WalletEligibilityStatus)
    : null;
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

  const {
    id,
    accountId,
    venue,
    connectorId,
    label,
    lastConnectedAt,
    status,
    ownershipStatus,
    eligibilityStatus,
    eligibilityReason,
    lastVerifiedAt,
  } = candidate;
  const normalizedConnectorId = normalizeWalletConnectorId(connectorId);
  const normalizedVenue = normalizeVenue(venue);

  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }

  if (typeof accountId !== 'string' || accountId.trim().length === 0) {
    return null;
  }

  if (!normalizedVenue || !normalizedConnectorId) {
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
    accountId: normalizeAccountId(accountId),
    venue: normalizedVenue,
    connectorId: normalizedConnectorId,
    label: normalizeOptionalString(label),
    lastConnectedAt,
    status: status as WalletSlotStatus,
    ownershipStatus: normalizeOwnershipStatus(ownershipStatus) ?? 'unverified',
    eligibilityStatus: normalizeEligibilityStatus(eligibilityStatus) ?? 'unknown',
    eligibilityReason: normalizeOptionalString(eligibilityReason),
    lastVerifiedAt: normalizeOptionalString(lastVerifiedAt),
  };
}

export function accountIdsMatch(left: string, right: string): boolean {
  return normalizeAccountId(left) === normalizeAccountId(right);
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
      .map((slot) => coerceWalletSlot(slot))
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
  const trimmedSlotId = payload.slotId?.trim();
  const trimmedAccountId = payload.accountId.trim();
  const trimmedConnectorId = payload.connectorId.trim();
  const normalizedConnectorId = normalizeWalletConnectorId(trimmedConnectorId);
  const normalizedVenue = normalizeVenue(payload.venue);

  if (trimmedAccountId.length === 0 || !normalizedVenue || !normalizedConnectorId) {
    return buildResult(state, false, 'invalid-payload');
  }

  const normalizedAccountId = normalizeAccountId(trimmedAccountId);
  const lastConnectedAt = payload.connectedAt ?? new Date().toISOString();
  const hasEligibilityReason = Object.prototype.hasOwnProperty.call(payload, 'eligibilityReason');
  const hasLastVerifiedAt = Object.prototype.hasOwnProperty.call(payload, 'lastVerifiedAt');

  const existingSlot = trimmedSlotId
    ? state.slots.find((slot) => slot.id === trimmedSlotId)
    : state.slots.find(
        (slot) =>
          accountIdsMatch(slot.accountId, normalizedAccountId) &&
          slot.connectorId === normalizedConnectorId &&
          slot.venue === normalizedVenue,
      );

  if (existingSlot) {
    const updatedSlot: WalletSlot = {
      ...existingSlot,
      accountId: normalizedAccountId,
      venue: normalizedVenue,
      connectorId: normalizedConnectorId,
      label: normalizeOptionalString(payload.label),
      lastConnectedAt,
      status: 'connected',
      ownershipStatus: payload.ownershipStatus ?? existingSlot.ownershipStatus,
      eligibilityStatus: payload.eligibilityStatus ?? existingSlot.eligibilityStatus,
      eligibilityReason: hasEligibilityReason
        ? normalizeOptionalString(payload.eligibilityReason)
        : existingSlot.eligibilityReason,
      lastVerifiedAt: hasLastVerifiedAt
        ? normalizeOptionalString(payload.lastVerifiedAt)
        : existingSlot.lastVerifiedAt,
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
    accountId: normalizedAccountId,
    venue: normalizedVenue,
    connectorId: normalizedConnectorId,
    label: normalizeOptionalString(payload.label),
    lastConnectedAt,
    status: 'connected',
    ownershipStatus: payload.ownershipStatus ?? 'unverified',
    eligibilityStatus: payload.eligibilityStatus ?? 'unknown',
    eligibilityReason: normalizeOptionalString(payload.eligibilityReason),
    lastVerifiedAt: normalizeOptionalString(payload.lastVerifiedAt),
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
