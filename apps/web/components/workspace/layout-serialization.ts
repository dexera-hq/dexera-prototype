import { createLegacyModuleLayout, normalizeWorkspaceModule } from './logic';
import { MODULE_KINDS } from './types';
import type {
  ModuleKind,
  WorkspaceConfigValue,
  WorkspaceModule,
  WorkspaceModuleConfig,
  WorkspaceModuleLayout,
} from './types';

const WORKSPACE_LAYOUT_VERSION = 2;

type SerializedWorkspaceBlock = {
  id: number;
  kind: ModuleKind;
  label: string;
  layout: WorkspaceModuleLayout;
  config: WorkspaceModuleConfig;
};

type SerializedWorkspaceLayout = {
  version: typeof WORKSPACE_LAYOUT_VERSION;
  nextModuleId: number;
  layout: number[];
  blocks: SerializedWorkspaceBlock[];
};

type SerializedWorkspaceBlockV1 = {
  id: number;
  kind: ModuleKind;
  label: string;
  size: 'full' | 'wide' | 'normal';
  config: WorkspaceModuleConfig;
};

type SerializedWorkspaceLayoutV1 = {
  version: 1;
  nextModuleId: number;
  layout: number[];
  blocks: SerializedWorkspaceBlockV1[];
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
        layout: workspaceModule.layout,
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
  if (parsedValue.version === WORKSPACE_LAYOUT_VERSION) {
    return parseVersionTwoLayout(parsedValue);
  }
  if (parsedValue.version === 1) {
    return parseVersionOneLayout(parsedValue as SerializedWorkspaceLayoutV1);
  }
  return null;
}

function parseVersionTwoLayout(value: Record<string, unknown>): WorkspaceLayoutState | null {
  const blockItems = parseSerializedBlocks(value.blocks);
  if (!blockItems) return null;

  const layout = parseIdArray(value.layout);
  if (!layout) return null;

  return buildWorkspaceLayoutState(blockItems, layout, value.nextModuleId);
}

function parseVersionOneLayout(value: SerializedWorkspaceLayoutV1): WorkspaceLayoutState | null {
  const blockItems = parseLegacySerializedBlocks(value.blocks);
  if (!blockItems) return null;

  const layout = parseIdArray(value.layout);
  if (!layout) return null;

  return buildWorkspaceLayoutState(blockItems, layout, value.nextModuleId);
}

function buildWorkspaceLayoutState(
  blocks: WorkspaceModule[],
  layout: number[],
  nextModuleId: unknown,
): WorkspaceLayoutState | null {
  const blockById = new Map<number, WorkspaceModule>();
  for (const block of blocks) {
    if (blockById.has(block.id)) {
      return null;
    }
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

  const remainingBlocks = blocks
    .filter((block) => !usedIds.has(block.id))
    .sort((left, right) => left.id - right.id);

  const modules = [...orderedModules, ...remainingBlocks];
  const parsedNextModuleId = parsePositiveInteger(nextModuleId);

  return {
    modules,
    nextModuleId:
      parsedNextModuleId !== null
        ? Math.max(parsedNextModuleId, computeNextModuleId(modules))
        : computeNextModuleId(modules),
  };
}

function parseSerializedBlocks(value: unknown): WorkspaceModule[] | null {
  if (!Array.isArray(value)) return null;
  const modules: WorkspaceModule[] = [];

  for (const block of value) {
    if (!isRecord(block)) return null;

    const id = parsePositiveInteger(block.id);
    if (id === null) return null;

    if (!isModuleKind(block.kind) || typeof block.label !== 'string') return null;

    const layout = parseModuleLayout(block.kind, block.layout);
    if (!layout) return null;

    const config = parseConfigObject(block.config);
    if (!config) return null;

    modules.push({
      id,
      kind: block.kind,
      label: block.label,
      layout,
      config,
    });
  }

  return modules;
}

function parseLegacySerializedBlocks(value: unknown): WorkspaceModule[] | null {
  if (!Array.isArray(value)) return null;
  const modules: WorkspaceModule[] = [];

  for (const block of value) {
    if (!isRecord(block)) return null;

    const id = parsePositiveInteger(block.id);
    if (id === null) return null;

    if (!isModuleKind(block.kind) || typeof block.label !== 'string') return null;
    if (!isLegacyModuleSize(block.size)) return null;

    const config = parseConfigObject(block.config);
    if (!config) return null;

    modules.push({
      id,
      kind: block.kind,
      label: block.label,
      layout: createLegacyModuleLayout(block.kind, block.size),
      config,
    });
  }

  return modules;
}

function parseModuleLayout(kind: ModuleKind, value: unknown): WorkspaceModuleLayout | null {
  if (!isRecord(value)) return null;

  const columns = parsePositiveInteger(value.columns);
  const minHeight = parsePositiveInteger(value.minHeight);
  if (columns === null || minHeight === null) return null;

  return normalizeWorkspaceModule({
    id: 1,
    kind,
    label: '',
    layout: { columns, minHeight },
    config: {},
  }).layout;
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

function isLegacyModuleSize(value: unknown): value is 'full' | 'wide' | 'normal' {
  return value === 'full' || value === 'wide' || value === 'normal';
}

function isConfigObject(value: WorkspaceConfigValue | undefined): value is WorkspaceModuleConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
