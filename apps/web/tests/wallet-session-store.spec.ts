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
      address: '0x1111',
      chainId: 1,
      connectorId: 'injected',
      label: 'Injected',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });

    expect(first.reason).toBe('added');
    state = first.state;

    const second = upsertConnectedWallet(state, {
      address: '0x2222',
      chainId: 1,
      connectorId: 'coinbaseWalletSDK',
      label: 'Coinbase Wallet',
      connectedAt: '2026-03-02T10:05:00.000Z',
    });

    expect(second.state.slots).toHaveLength(2);
    state = second.state;

    const third = upsertConnectedWallet(state, {
      address: '0x3333',
      chainId: 999,
      connectorId: 'walletConnect',
      label: 'WalletConnect',
      connectedAt: '2026-03-02T10:10:00.000Z',
    });

    expect(third.state.slots).toHaveLength(MAX_WALLET_SLOTS);
    state = third.state;

    const fourth = upsertConnectedWallet(state, {
      address: '0x4444',
      chainId: 1,
      connectorId: 'injected',
      label: 'Injected',
      connectedAt: '2026-03-02T10:15:00.000Z',
    });

    expect(fourth.changed).toBe(false);
    expect(fourth.reason).toBe('slots-full');
    expect(fourth.state.slots).toHaveLength(MAX_WALLET_SLOTS);
  });

  it('updates an existing slot by slot id without creating duplicates', () => {
    const first = upsertConnectedWallet(createEmptyWalletSessionState(), {
      slotId: 'slot-1',
      address: '0xAAAA',
      chainId: 1,
      connectorId: 'injected',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });

    const updated = upsertConnectedWallet(first.state, {
      slotId: 'slot-1',
      address: '0xBBBB',
      chainId: 999,
      connectorId: 'injected',
      label: 'Injected',
      connectedAt: '2026-03-02T10:30:00.000Z',
    });

    expect(updated.reason).toBe('updated');
    expect(updated.state.slots).toHaveLength(1);
    const updatedSlot = updated.state.slots[0];
    expect(updatedSlot).toBeDefined();
    if (!updatedSlot) {
      throw new Error('Expected the updated wallet slot to exist');
    }
    expect(updatedSlot.id).toBe('slot-1');
    expect(updatedSlot.address).toBe('0xbbbb');
    expect(updatedSlot.chainId).toBe(999);
    expect(updatedSlot.label).toBe('Injected');
    expect(updated.state.activeSlotId).toBe(updatedSlot.id);
  });

  it('adds a new slot when a provided slot id does not exist, even if connector and address match', () => {
    const first = upsertConnectedWallet(createEmptyWalletSessionState(), {
      slotId: 'slot-1',
      address: '0xAAAA',
      chainId: 1,
      connectorId: 'injected',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });

    const second = upsertConnectedWallet(first.state, {
      slotId: 'slot-2',
      address: '0xAAAA',
      chainId: 1,
      connectorId: 'injected',
      connectedAt: '2026-03-02T10:30:00.000Z',
    });

    expect(second.reason).toBe('added');
    expect(second.state.slots).toHaveLength(2);
    expect(second.state.slots.some((slot) => slot.id === 'slot-1')).toBe(true);
    expect(second.state.slots.some((slot) => slot.id === 'slot-2')).toBe(true);
    expect(second.state.activeSlotId).toBe('slot-2');
  });

  it('marks a slot disconnected without removing it', () => {
    const connected = upsertConnectedWallet(createEmptyWalletSessionState(), {
      slotId: 'slot-1',
      address: '0x1111',
      chainId: 1,
      connectorId: 'injected',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });

    const disconnected = disconnectWalletSlot(connected.state, 'slot-1');

    expect(disconnected.reason).toBe('disconnected');
    expect(disconnected.state.slots).toHaveLength(1);
    expect(disconnected.state.slots[0]?.status).toBe('disconnected');
  });

  it('removes the active slot and promotes the next most recent slot', () => {
    const first = upsertConnectedWallet(createEmptyWalletSessionState(), {
      address: '0x1111',
      chainId: 1,
      connectorId: 'injected',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });
    const second = upsertConnectedWallet(first.state, {
      address: '0x2222',
      chainId: 1,
      connectorId: 'coinbaseWalletSDK',
      connectedAt: '2026-03-02T10:10:00.000Z',
    });
    const third = upsertConnectedWallet(second.state, {
      address: '0x3333',
      chainId: 999,
      connectorId: 'walletConnect',
      connectedAt: '2026-03-02T10:20:00.000Z',
    });

    const removed = removeWalletSlot(third.state, third.state.activeSlotId as string);

    expect(removed.reason).toBe('removed');
    expect(removed.state.slots).toHaveLength(2);
    const nextActiveSlot = removed.state.slots[0];
    expect(nextActiveSlot).toBeDefined();
    if (!nextActiveSlot) {
      throw new Error('Expected the next active wallet slot to exist');
    }
    expect(removed.state.activeSlotId).toBe(nextActiveSlot.id);
    expect(nextActiveSlot.address).toBe('0x2222');
  });

  it('serializes, restores, and safely ignores malformed persisted state', () => {
    const connected = upsertConnectedWallet(createEmptyWalletSessionState(), {
      address: '0x5555',
      chainId: 999,
      connectorId: 'walletConnect',
      connectedAt: '2026-03-02T11:00:00.000Z',
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
      address: '0x1111',
      chainId: 1,
      connectorId: 'injected',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });
    const second = upsertConnectedWallet(first.state, {
      address: '0x2222',
      chainId: 999,
      connectorId: 'walletConnect',
      connectedAt: '2026-03-02T10:05:00.000Z',
    });

    const stale = markAllWalletSlots(second.state, 'stale');

    expect(stale.changed).toBe(true);
    expect(stale.state.slots.every((slot) => slot.status === 'stale')).toBe(true);
  });
});
