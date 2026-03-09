export const MODULE_KINDS = [
  'overview',
  'chart',
  'trade',
  'orders',
  'orderbook',
  'positions',
  'custom',
] as const;
export const WORKSPACE_GRID_COLUMNS = 12;
export const MIN_WORKSPACE_MODULE_COLUMNS = 3;
export const MAX_WORKSPACE_MODULE_HEIGHT = 960;

export type ModuleKind = (typeof MODULE_KINDS)[number];
export type WorkspaceConfigValue =
  | string
  | number
  | boolean
  | null
  | WorkspaceConfigValue[]
  | { [key: string]: WorkspaceConfigValue };

export type WorkspaceModuleConfig = Record<string, WorkspaceConfigValue>;
export type WorkspaceModuleLayout = {
  columns: number;
  minHeight: number;
};

export type WorkspaceModule = {
  id: number;
  kind: ModuleKind;
  label: string;
  layout: WorkspaceModuleLayout;
  config: WorkspaceModuleConfig;
};
