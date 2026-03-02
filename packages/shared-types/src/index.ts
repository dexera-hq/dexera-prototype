export type ChainId = number;
export * from './orders';
export * from './positions';
export * from './wallets';

export interface DexeraHealthStatus {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  timestamp: string;
}
