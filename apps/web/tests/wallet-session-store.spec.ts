import { describe, expect, it } from 'vitest';

import {
  MAX_WALLET_SLOTS,
  WALLET_SESSION_STORAGE_KEY,
  createEmptyWalletSessionState,
  deserializeWalletSessionState,
  disconnectWalletSlot,
  markAllWalletSlots,
  readWalletSessionState,
  removeWalletSlot,
  serializeWalletSessionState,
  upsertConnectedWallet,
  writeWalletSessionState,
} from '../lib/wallet/session-store';

describe('wallet session store', () => {
  it('adds up to three slots and rejects a fourth distinct wallet', () => {
    let state = createEmptyWalletSessionState();

    const first = upsertConnectedWallet(state, {
      accountId: '0x0000000000000000000000000000000000000001',
      venue: 'hyperliquid',
      connectorId: 'metaMaskInjected',
      label: 'MetaMask',
      connectedAt: '2026-03-02T10:00:00.000Z',
      ownershipStatus: 'verified',
      eligibilityStatus: 'tradable',
    });

    expect(first.reason).toBe('added');
    state = first.state;

    const second = upsertConnectedWallet(state, {
      accountId: '0x0000000000000000000000000000000000000002',
      venue: 'hyperliquid',
      connectorId: 'coinbaseInjected',
      label: 'Coinbase Wallet',
      connectedAt: '2026-03-02T10:05:00.000Z',
      ownershipStatus: 'unverified',
      eligibilityStatus: 'checking',
    });

    expect(second.state.slots).toHaveLength(2);
    state = second.state;

    const third = upsertConnectedWallet(state, {
      accountId: '0x0000000000000000000000000000000000000003',
      venue: 'aster',
      connectorId: 'rabbyInjected',
      label: 'Rabby',
      connectedAt: '2026-03-02T10:10:00.000Z',
      ownershipStatus: 'verified',
      eligibilityStatus: 'not-eligible',
    });

    expect(third.state.slots).toHaveLength(MAX_WALLET_SLOTS);
    state = third.state;

    const fourth = upsertConnectedWallet(state, {
      accountId: '0x0000000000000000000000000000000000000004',
      venue: 'hyperliquid',
      connectorId: 'injected',
      label: 'Injected Wallet',
      connectedAt: '2026-03-02T10:15:00.000Z',
    });

    expect(fourth.changed).toBe(false);
    expect(fourth.reason).toBe('slots-full');
    expect(fourth.state.slots).toHaveLength(MAX_WALLET_SLOTS);
  });

  it('updates an existing slot by slot id without creating duplicates', () => {
    const first = upsertConnectedWallet(createEmptyWalletSessionState(), {
      slotId: 'slot-1',
      accountId: '0x000000000000000000000000000000000000000a',
      venue: 'hyperliquid',
      connectorId: 'metaMaskInjected',
      connectedAt: '2026-03-02T10:00:00.000Z',
      ownershipStatus: 'unverified',
      eligibilityStatus: 'checking',
    });

    const updated = upsertConnectedWallet(first.state, {
      slotId: 'slot-1',
      accountId: '0x000000000000000000000000000000000000000b',
      venue: 'hyperliquid',
      connectorId: 'metaMaskInjected',
      label: 'MetaMask',
      connectedAt: '2026-03-02T10:30:00.000Z',
      ownershipStatus: 'verified',
      eligibilityStatus: 'tradable',
      eligibilityReason: '',
      lastVerifiedAt: '2026-03-02T10:31:00.000Z',
    });

    expect(updated.reason).toBe('updated');
    expect(updated.state.slots).toHaveLength(1);
    const updatedSlot = updated.state.slots[0];
    expect(updatedSlot?.id).toBe('slot-1');
    expect(updatedSlot?.accountId).toBe('0x000000000000000000000000000000000000000b');
    expect(updatedSlot?.venue).toBe('hyperliquid');
    expect(updatedSlot?.label).toBe('MetaMask');
    expect(updatedSlot?.ownershipStatus).toBe('verified');
    expect(updatedSlot?.eligibilityStatus).toBe('tradable');
  });

  it('marks a slot disconnected without removing it', () => {
    const connected = upsertConnectedWallet(createEmptyWalletSessionState(), {
      slotId: 'slot-1',
      accountId: '0x0000000000000000000000000000000000000001',
      venue: 'hyperliquid',
      connectorId: 'metaMaskInjected',
      connectedAt: '2026-03-02T10:00:00.000Z',
      ownershipStatus: 'verified',
      eligibilityStatus: 'tradable',
    });

    const disconnected = disconnectWalletSlot(connected.state, 'slot-1');

    expect(disconnected.reason).toBe('disconnected');
    expect(disconnected.state.slots).toHaveLength(1);
    expect(disconnected.state.slots[0]?.status).toBe('disconnected');
  });

  it('removes the active slot and promotes the next most recent slot', () => {
    const first = upsertConnectedWallet(createEmptyWalletSessionState(), {
      accountId: '0x0000000000000000000000000000000000000001',
      venue: 'hyperliquid',
      connectorId: 'metaMaskInjected',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });
    const second = upsertConnectedWallet(first.state, {
      accountId: '0x0000000000000000000000000000000000000002',
      venue: 'hyperliquid',
      connectorId: 'coinbaseInjected',
      connectedAt: '2026-03-02T10:10:00.000Z',
    });

    const removed = removeWalletSlot(second.state, second.state.activeSlotId as string);

    expect(removed.reason).toBe('removed');
    expect(removed.state.slots).toHaveLength(1);
    expect(removed.state.activeSlotId).toBe(removed.state.slots[0]?.id ?? null);
    expect(removed.state.slots[0]?.accountId).toBe('0x0000000000000000000000000000000000000001');
  });

  it('serializes, restores, and safely ignores malformed persisted state', () => {
    const connected = upsertConnectedWallet(createEmptyWalletSessionState(), {
      accountId: '0x00000000000000000000000000000000000000aa',
      venue: 'aster',
      connectorId: 'rabbyInjected',
      connectedAt: '2026-03-02T11:00:00.000Z',
      ownershipStatus: 'verified',
      eligibilityStatus: 'not-eligible',
      eligibilityReason: 'venue rejected test address',
    });
    const serialized = serializeWalletSessionState(connected.state);

    expect(deserializeWalletSessionState(serialized)).toEqual(connected.state);
    expect(deserializeWalletSessionState('{not-valid-json')).toEqual(
      createEmptyWalletSessionState(),
    );

    const storage = {
      values: new Map<string, string>(),
      getItem(key: string) {
        return this.values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.values.set(key, value);
      },
      removeItem(key: string) {
        this.values.delete(key);
      },
    };

    writeWalletSessionState(storage, connected.state);

    expect(storage.getItem(WALLET_SESSION_STORAGE_KEY)).not.toBeNull();
    expect(readWalletSessionState(storage)).toEqual(connected.state);
  });

  it('marks all rehydrated slots as stale when no live session is restored', () => {
    const first = upsertConnectedWallet(createEmptyWalletSessionState(), {
      accountId: '0x0000000000000000000000000000000000000001',
      venue: 'hyperliquid',
      connectorId: 'metaMaskInjected',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });
    const second = upsertConnectedWallet(first.state, {
      accountId: '0x0000000000000000000000000000000000000002',
      venue: 'aster',
      connectorId: 'coinbaseInjected',
      connectedAt: '2026-03-02T10:05:00.000Z',
    });

    const stale = markAllWalletSlots(second.state, 'stale');

    expect(stale.changed).toBe(true);
    expect(stale.state.slots.every((slot) => slot.status === 'stale')).toBe(true);
  });
});
