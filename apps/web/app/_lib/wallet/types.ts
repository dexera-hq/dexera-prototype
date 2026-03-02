export type HexChainId = `0x${string}`;

export type WalletStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'error';

export type WalletConnectorId = 'injected' | 'walletConnect';

export interface TargetChainConfig {
  name: string;
  chainId: number;
  chainIdHex: HexChainId;
  rpcUrl: string;
}

export interface WalletUiState {
  status: WalletStatus;
  connectorReady: boolean;
  address: string | null;
  chainId: number | null;
  chainIdHex: HexChainId | null;
  chainName: string | null;
  connectorName: string | null;
  isTargetChain: boolean | null;
  errorMessage: string | null;
}
