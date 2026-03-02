export type ChainId = number;
export * from './orders';
export * from './positions';

export interface DexeraHealthStatus {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  timestamp: string;
}

export interface ConnectedWallet {
  address: string;
  chainId: ChainId;
  label?: string;
}
