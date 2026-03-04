import {
  WALLET_CONNECTOR_IDS,
  type WalletConnectorId,
  type WalletConnectorOption,
  type WalletSlot,
} from './types';

const CONNECTOR_LABELS: Record<WalletConnectorId, string> = {
  metaMaskInjected: 'MetaMask',
  coinbaseInjected: 'Coinbase Wallet',
  rabbyInjected: 'Rabby',
  injected: 'Injected Wallet',
};

export function getWalletConnectorLabel(connectorId: WalletConnectorId): string {
  return CONNECTOR_LABELS[connectorId];
}

export function isConnectorLocked(
  slots: readonly WalletSlot[],
  connectorId: WalletConnectorId,
  ignoreSlotId?: string,
): boolean {
  return slots.some(
    (slot) =>
      slot.status === 'connected' &&
      slot.connectorId === connectorId &&
      (ignoreSlotId === undefined || slot.id !== ignoreSlotId),
  );
}

export function getConnectorOptions(parameters: {
  slots: readonly WalletSlot[];
  runtimeEnabled: boolean;
  activeSlotId?: string;
}): WalletConnectorOption[] {
  const { slots, runtimeEnabled, activeSlotId } = parameters;

  return WALLET_CONNECTOR_IDS.map((connectorId) => {
    if (!runtimeEnabled) {
      return {
        id: connectorId,
        label: getWalletConnectorLabel(connectorId),
        available: false,
        unavailableReason: 'connector-disabled',
      };
    }

    if (isConnectorLocked(slots, connectorId, activeSlotId)) {
      return {
        id: connectorId,
        label: getWalletConnectorLabel(connectorId),
        available: false,
        unavailableReason: 'connector-in-use',
      };
    }

    return {
      id: connectorId,
      label: getWalletConnectorLabel(connectorId),
      available: true,
    };
  });
}
