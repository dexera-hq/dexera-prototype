import type {
  ModuleKind,
  ModuleSize,
  WorkspaceConfigValue,
  WorkspaceModule,
  WorkspaceModuleConfig,
} from '@/components/workspace/types';

const WORKSPACE_LAYOUT_VERSION = 1;
const MODULE_KINDS: ModuleKind[] = ['overview', 'chart', 'trade', 'orderbook', 'positions', 'custom'];
const MODULE_SIZES: ModuleSize[] = ['full', 'wide', 'normal'];

type SerializedWorkspaceBlock = {
  id: number;
  kind: ModuleKind;
  label: string;
  size: ModuleSize;
  config: WorkspaceModuleConfig;
};

type SerializedWorkspaceLayout = {
  version: typeof WORKSPACE_LAYOUT_VERSION;
  nextModuleId: number;
  layout: number[];
  blocks: SerializedWorkspaceBlock[];
};

export type WorkspaceLayoutState = {
  modules: WorkspaceModule[];
  nextModuleId: number;
};

export function serializeWorkspaceLayout(state: WorkspaceLayoutState): string {
  const normalizedModules = state.modules.map((workspaceModule) =>
    normalizeWorkspaceModule(workspaceModule),
  );
  const payload: SerializedWorkspaceLayout = {
    version: WORKSPACE_LAYOUT_VERSION,
    nextModuleId: normalizeNextModuleId(state.nextModuleId, normalizedModules),
    layout: normalizedModules.map((workspaceModule) => workspaceModule.id),
    blocks: normalizedModules
      .map((workspaceModule) => ({
        id: workspaceModule.id,
        kind: workspaceModule.kind,
        label: workspaceModule.label,
        size: workspaceModule.size,
        config: sortConfigObject(workspaceModule.config),
      }))
      .sort((left, right) => left.id - right.id),
  };
  return JSON.stringify(payload);
}

export function deserializeWorkspaceLayout(value: string): WorkspaceLayoutState | null {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    return null;
  }

  if (!isRecord(parsedValue)) return null;
  if (parsedValue.version !== WORKSPACE_LAYOUT_VERSION) return null;

  const blockItems = parseSerializedBlocks(parsedValue.blocks);
  if (!blockItems) return null;

  const layout = parseIdArray(parsedValue.layout);
  if (!layout) return null;

  const blockById = new Map<number, WorkspaceModule>();
  for (const block of blockItems) {
    if (blockById.has(block.id)) return null;
    blockById.set(block.id, block);
  }

  const usedIds = new Set<number>();
  const orderedModules: WorkspaceModule[] = [];

  for (const id of layout) {
    if (usedIds.has(id)) continue;
    const block = blockById.get(id);
    if (!block) continue;
    orderedModules.push(block);
    usedIds.add(id);
  }

  const remainingBlocks = blockItems
    .filter((block) => !usedIds.has(block.id))
    .sort((left, right) => left.id - right.id);

  const modules = [...orderedModules, ...remainingBlocks];
  const parsedNextModuleId = parsePositiveInteger(parsedValue.nextModuleId);

  return {
    modules,
    nextModuleId:
      parsedNextModuleId !== null
        ? Math.max(parsedNextModuleId, computeNextModuleId(modules))
        : computeNextModuleId(modules),
  };
}

function normalizeWorkspaceModule(workspaceModule: WorkspaceModule): WorkspaceModule {
  return {
    id: workspaceModule.id,
    kind: workspaceModule.kind,
    label: workspaceModule.label,
    size: workspaceModule.size,
    config: sortConfigObject(workspaceModule.config),
  };
}

function parseSerializedBlocks(value: unknown): WorkspaceModule[] | null {
  if (!Array.isArray(value)) return null;
  const modules: WorkspaceModule[] = [];

  for (const block of value) {
    if (!isRecord(block)) return null;

    const id = parsePositiveInteger(block.id);
    if (id === null) return null;

    if (!isModuleKind(block.kind)) return null;
    if (!isModuleSize(block.size)) return null;
    if (typeof block.label !== 'string') return null;

    const config = parseConfigObject(block.config);
    if (!config) return null;

    modules.push({
      id,
      kind: block.kind,
      label: block.label,
      size: block.size,
      config,
    });
  }

  return modules;
}

function parseIdArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids: number[] = [];
  for (const id of value) {
    const parsedId = parsePositiveInteger(id);
    if (parsedId === null) return null;
    ids.push(parsedId);
  }
  return ids;
}

function parsePositiveInteger(value: unknown): number | null {
  if (!Number.isInteger(value)) return null;
  const parsedValue = value as number;
  return parsedValue > 0 ? parsedValue : null;
}

function parseConfigObject(value: unknown): WorkspaceModuleConfig | null {
  if (!isRecord(value)) return null;
  const normalizedValue = normalizeConfigValueStrict(value);
  if (!isConfigObject(normalizedValue)) return null;
  return normalizedValue;
}

function sortConfigObject(value: WorkspaceModuleConfig): WorkspaceModuleConfig {
  const normalizedValue = normalizeConfigValueLenient(value);
  if (!isConfigObject(normalizedValue)) {
    return {};
  }
  return normalizedValue;
}

function normalizeConfigValueStrict(value: unknown): WorkspaceConfigValue | undefined {
  if (value === null) return null;

  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  if (Array.isArray(value)) {
    const normalizedArray: WorkspaceConfigValue[] = [];
    for (const item of value) {
      const normalizedItem = normalizeConfigValueStrict(item);
      if (normalizedItem === undefined) return undefined;
      normalizedArray.push(normalizedItem);
    }
    return normalizedArray;
  }

  if (!isRecord(value)) return undefined;

  const normalizedObject: WorkspaceModuleConfig = {};
  const sortedEntries = Object.entries(value).sort(([left], [right]) =>
    compareConfigKeys(left, right),
  );
  for (const [key, entryValue] of sortedEntries) {
    const normalizedEntryValue = normalizeConfigValueStrict(entryValue);
    if (normalizedEntryValue === undefined) return undefined;
    normalizedObject[key] = normalizedEntryValue;
  }
  return normalizedObject;
}

function normalizeConfigValueLenient(value: unknown): WorkspaceConfigValue | undefined {
  if (value === null) return null;

  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  if (Array.isArray(value)) {
    const normalizedArray: WorkspaceConfigValue[] = [];
    for (const item of value) {
      const normalizedItem = normalizeConfigValueLenient(item);
      if (normalizedItem === undefined) continue;
      normalizedArray.push(normalizedItem);
    }
    return normalizedArray;
  }

  if (!isRecord(value)) return undefined;

  const normalizedObject: WorkspaceModuleConfig = {};
  const sortedEntries = Object.entries(value).sort(([left], [right]) =>
    compareConfigKeys(left, right),
  );
  for (const [key, entryValue] of sortedEntries) {
    const normalizedEntryValue = normalizeConfigValueLenient(entryValue);
    if (normalizedEntryValue === undefined) continue;
    normalizedObject[key] = normalizedEntryValue;
  }
  return normalizedObject;
}

function compareConfigKeys(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function computeNextModuleId(modules: WorkspaceModule[]): number {
  let maxId = 0;
  for (const workspaceModule of modules) {
    if (workspaceModule.id > maxId) {
      maxId = workspaceModule.id;
    }
  }
  return maxId + 1;
}

function normalizeNextModuleId(nextModuleId: number, modules: WorkspaceModule[]): number {
  const minimumNextModuleId = computeNextModuleId(modules);
  const parsedNextModuleId = parsePositiveInteger(nextModuleId);
  if (parsedNextModuleId === null) return minimumNextModuleId;
  return Math.max(parsedNextModuleId, minimumNextModuleId);
}

function isModuleKind(value: unknown): value is ModuleKind {
  return typeof value === 'string' && MODULE_KINDS.includes(value as ModuleKind);
}

function isModuleSize(value: unknown): value is ModuleSize {
  return typeof value === 'string' && MODULE_SIZES.includes(value as ModuleSize);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConfigObject(value: WorkspaceConfigValue | undefined): value is WorkspaceModuleConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
