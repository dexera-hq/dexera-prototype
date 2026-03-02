export type ChainId = number;

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
