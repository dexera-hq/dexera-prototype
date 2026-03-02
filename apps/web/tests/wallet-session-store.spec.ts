import { describe, expect, it } from 'vitest';

import {
  MAX_WALLET_SLOTS,
  WALLET_SESSION_STORAGE_KEY,
  createEmptyWalletSessionState,
  deserializeWalletSessionState,
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
      connectorId: 'metaMask',
      label: 'MetaMask',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });

    expect(first.reason).toBe('added');
    state = first.state;

    const second = upsertConnectedWallet(state, {
      address: '0x2222',
      chainId: 1,
      connectorId: 'rainbow',
      label: 'Rainbow',
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
      connectorId: 'coinbaseWallet',
      label: 'Coinbase',
      connectedAt: '2026-03-02T10:15:00.000Z',
    });

    expect(fourth.changed).toBe(false);
    expect(fourth.reason).toBe('slots-full');
    expect(fourth.state.slots).toHaveLength(MAX_WALLET_SLOTS);
  });

  it('upserts an existing slot instead of duplicating it', () => {
    const first = upsertConnectedWallet(createEmptyWalletSessionState(), {
      address: '0xAAAA',
      chainId: 1,
      connectorId: 'metaMask',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });

    const updated = upsertConnectedWallet(first.state, {
      address: '0xaaaa',
      chainId: 999,
      connectorId: 'metaMask',
      label: 'MetaMask',
      connectedAt: '2026-03-02T10:30:00.000Z',
    });

    expect(updated.reason).toBe('updated');
    expect(updated.state.slots).toHaveLength(1);
    expect(updated.state.slots[0].chainId).toBe(999);
    expect(updated.state.slots[0].label).toBe('MetaMask');
    expect(updated.state.activeSlotId).toBe(updated.state.slots[0].id);
  });

  it('removes the active slot and promotes the next most recent slot', () => {
    const first = upsertConnectedWallet(createEmptyWalletSessionState(), {
      address: '0x1111',
      chainId: 1,
      connectorId: 'metaMask',
      connectedAt: '2026-03-02T10:00:00.000Z',
    });
    const second = upsertConnectedWallet(first.state, {
      address: '0x2222',
      chainId: 1,
      connectorId: 'rainbow',
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
    expect(removed.state.activeSlotId).toBe(removed.state.slots[0].id);
    expect(removed.state.slots[0].address).toBe('0x2222');
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
    expect(deserializeWalletSessionState('{not-valid-json')).toEqual(createEmptyWalletSessionState());

    const storage = {
      value: null as string | null,
      getItem(key: string) {
        return key === WALLET_SESSION_STORAGE_KEY ? this.value : null;
      },
      setItem(key: string, value: string) {
        if (key === WALLET_SESSION_STORAGE_KEY) {
          this.value = value;
        }
      },
      removeItem() {
        this.value = null;
      },
    };

    writeWalletSessionState(storage, connected.state);

    expect(readWalletSessionState(storage)).toEqual(connected.state);
  });

  it('marks all rehydrated slots as stale when no live session is restored', () => {
    const first = upsertConnectedWallet(createEmptyWalletSessionState(), {
      address: '0x1111',
      chainId: 1,
      connectorId: 'metaMask',
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
