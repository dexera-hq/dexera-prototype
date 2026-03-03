import { createConfig, createStorage, http } from 'wagmi';
import { connect, disconnect, getAccount, watchAccount } from 'wagmi/actions';
import { mainnet } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

import { HYPER_EVM_RPC_URL, hyperEvmChain, walletChains } from './chains';
import { WALLET_CONNECTOR_IDS, type ConnectWalletReason, type WalletConnectorId } from './types';

export type RuntimeAccountSnapshot = {
  isConnected: boolean;
  address?: string;
  chainId?: number;
  connectorId?: WalletConnectorId;
  connectorLabel?: string;
};

export type RuntimeConnectResult = {
  connected: boolean;
  reason: ConnectWalletReason;
  account?: RuntimeAccountSnapshot;
};

type SlotRuntime = {
  config: ReturnType<typeof createConfig>;
  unwatchAccount?: () => void;
};

const slotRuntimeById = new Map<string, SlotRuntime>();

export function isWalletConnectEnabled(): boolean {
  return getWalletConnectProjectId().length > 0;
}

function getWalletConnectProjectId(): string {
  return process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? '';
}

function createSlotConfig(slotId: string) {
  const walletConnectProjectId = getWalletConnectProjectId();
  const connectorFactories = [
    injected(),
    coinbaseWallet({ appName: 'Dexera Prototype' }),
    ...(walletConnectProjectId.length > 0
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
          }),
        ]
      : []),
  ];

  return createConfig({
    chains: walletChains,
    connectors: connectorFactories,
    transports: {
      [mainnet.id]: http(),
      [hyperEvmChain.id]: http(HYPER_EVM_RPC_URL),
    },
    ssr: false,
    storage: createStorage({
      key: `dexera.wallet-runtime.${slotId}.v1`,
      storage: typeof window === 'undefined' ? undefined : window.localStorage,
    }),
  });
}

function getOrCreateSlotRuntime(slotId: string): SlotRuntime {
  const existingRuntime = slotRuntimeById.get(slotId);
  if (existingRuntime) {
    return existingRuntime;
  }

  const createdRuntime: SlotRuntime = {
    config: createSlotConfig(slotId),
  };
  slotRuntimeById.set(slotId, createdRuntime);

  return createdRuntime;
}

function coerceConnectorId(connectorId: string | undefined): WalletConnectorId | undefined {
  if (!connectorId) {
    return undefined;
  }

  return WALLET_CONNECTOR_IDS.includes(connectorId as WalletConnectorId)
    ? (connectorId as WalletConnectorId)
    : undefined;
}

function readAccountSnapshot(runtime: SlotRuntime): RuntimeAccountSnapshot {
  const account = getAccount(runtime.config);
  const connectorId = coerceConnectorId(account.connector?.id);

  if (!account.isConnected || !account.address || !account.chainId || !connectorId) {
    return {
      isConnected: false,
    };
  }

  return {
    isConnected: true,
    address: account.address,
    chainId: account.chainId,
    connectorId,
    connectorLabel: account.connector?.name,
  };
}

function findConnector(runtime: SlotRuntime, connectorId: WalletConnectorId) {
  return runtime.config.connectors.find((connector) => connector.id === connectorId);
}

async function connectWithReason(parameters: {
  slotId: string;
  connectorId: WalletConnectorId;
  connectedReason: 'connected' | 'reconnected';
}): Promise<RuntimeConnectResult> {
  const runtime = getOrCreateSlotRuntime(parameters.slotId);
  const connector = findConnector(runtime, parameters.connectorId);

  if (!connector) {
    return {
      connected: false,
      reason: 'connector-missing',
    };
  }

  try {
    await connect(runtime.config, {
      connector,
    });

    const account = readAccountSnapshot(runtime);

    if (!account.isConnected || !account.address || !account.chainId || !account.connectorId) {
      return {
        connected: false,
        reason: 'failed',
      };
    }

    return {
      connected: true,
      reason: parameters.connectedReason,
      account,
    };
  } catch {
    return {
      connected: false,
      reason: 'failed',
    };
  }
}

export async function connectRuntimeSlot(
  slotId: string,
  connectorId: WalletConnectorId,
): Promise<RuntimeConnectResult> {
  return connectWithReason({ slotId, connectorId, connectedReason: 'connected' });
}

export async function reconnectRuntimeSlot(
  slotId: string,
  connectorId: WalletConnectorId,
): Promise<RuntimeConnectResult> {
  return connectWithReason({ slotId, connectorId, connectedReason: 'reconnected' });
}

export async function disconnectRuntimeSlot(slotId: string): Promise<void> {
  const runtime = slotRuntimeById.get(slotId);

  if (!runtime) {
    return;
  }

  try {
    await disconnect(runtime.config);
  } catch {
    // Ignore connector-specific disconnect failures.
  }
}

export function watchRuntimeSlotAccount(
  slotId: string,
  onChange: (account: RuntimeAccountSnapshot) => void,
): () => void {
  const runtime = getOrCreateSlotRuntime(slotId);

  runtime.unwatchAccount?.();
  runtime.unwatchAccount = watchAccount(runtime.config, {
    onChange() {
      onChange(readAccountSnapshot(runtime));
    },
  });

  onChange(readAccountSnapshot(runtime));

  return () => {
    runtime.unwatchAccount?.();
    runtime.unwatchAccount = undefined;
  };
}

export async function clearRuntimeSlots(slotIds: readonly string[]): Promise<void> {
  await Promise.all(slotIds.map((slotId) => disconnectRuntimeSlot(slotId)));

  for (const slotId of slotIds) {
    const runtime = slotRuntimeById.get(slotId);
    runtime?.unwatchAccount?.();
    slotRuntimeById.delete(slotId);
  }
}
