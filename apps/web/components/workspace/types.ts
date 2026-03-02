export type ModuleKind = 'overview' | 'chart' | 'trade' | 'orderbook' | 'positions' | 'custom';
export type ModuleSize = 'full' | 'wide' | 'normal';
export type WorkspaceConfigValue =
  | string
  | number
  | boolean
  | null
  | WorkspaceConfigValue[]
  | { [key: string]: WorkspaceConfigValue };

export type WorkspaceModuleConfig = Record<string, WorkspaceConfigValue>;

export type WorkspaceModule = {
  id: number;
  kind: ModuleKind;
  label: string;
  size: ModuleSize;
  config: WorkspaceModuleConfig;
};
