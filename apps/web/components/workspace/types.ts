export type ModuleKind = 'overview' | 'chart' | 'trade' | 'orderbook' | 'positions' | 'custom';
export type ModuleSize = 'full' | 'wide' | 'normal';

export type WorkspaceModule = {
  id: number;
  kind: ModuleKind;
  label: string;
  size: ModuleSize;
};

