export type HexChainId = `0x${string}`;

export type WalletStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'error';

export type ProviderEvent = 'accountsChanged' | 'chainChanged' | 'disconnect';

export interface Eip1193RequestArguments {
  method: string;
  params?: readonly unknown[] | object;
}

export interface Eip1193Provider {
  request(args: Eip1193RequestArguments): Promise<unknown>;
  on?(event: ProviderEvent, listener: (...args: unknown[]) => void): void;
  removeListener?(event: ProviderEvent, listener: (...args: unknown[]) => void): void;
}

export interface TargetChainConfig {
  name: string;
  chainIdHex?: HexChainId;
  chainIdDecimal?: number;
}

export interface WalletState {
  status: WalletStatus;
  providerPresent: boolean;
  address: string | null;
  chainIdHex: HexChainId | null;
  chainIdDecimal: number | null;
  chainName: string | null;
  isTargetChain: boolean | null;
  errorMessage: string | null;
}

export type WalletEventHandler = (...args: unknown[]) => void;
