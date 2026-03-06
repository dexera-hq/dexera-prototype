export const MODULE_KINDS = [
  'overview',
  'chart',
  'trade',
  'orderbook',
  'positions',
  'activity',
  'custom',
] as const;
export const MODULE_SIZES = ['full', 'wide', 'normal'] as const;

export type ModuleKind = (typeof MODULE_KINDS)[number];
export type ModuleSize = (typeof MODULE_SIZES)[number];
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
