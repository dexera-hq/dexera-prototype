import type {
  ModuleKind,
  WorkspaceModule,
  WorkspaceModuleLayout,
} from '@/components/workspace/types';
import {
  MAX_WORKSPACE_MODULE_HEIGHT,
  MIN_WORKSPACE_MODULE_COLUMNS,
  WORKSPACE_GRID_COLUMNS,
} from '@/components/workspace/types';

export const WORKSPACE_GRID_GAP_PX = 16;
export type WorkspaceInsertionPlacement = 'before' | 'after';

export type PackedWorkspaceRowItem = {
  module: WorkspaceModule;
  columnStart: number;
  columnSpan: number;
  isSoloRow: boolean;
  rowIndex: number;
};

const MODULE_DEFAULT_LAYOUTS: Record<ModuleKind, WorkspaceModuleLayout> = {
  overview: { columns: WORKSPACE_GRID_COLUMNS, minHeight: 190 },
  chart: { columns: 8, minHeight: 360 },
  trade: { columns: 4, minHeight: 360 },
  orders: { columns: 8, minHeight: 340 },
  orderbook: { columns: 4, minHeight: 340 },
  positions: { columns: 8, minHeight: 320 },
  custom: { columns: 4, minHeight: 280 },
};

export const initialModules: WorkspaceModule[] = [
  {
    id: 1,
    kind: 'overview',
    label: 'Market Overview',
    layout: createModuleLayout('overview'),
    config: {},
  },
  {
    id: 2,
    kind: 'chart',
    label: 'Price Chart',
    layout: createModuleLayout('chart'),
    config: {},
  },
  {
    id: 3,
    kind: 'trade',
    label: 'Order Entry',
    layout: createModuleLayout('trade'),
    config: {},
  },
  {
    id: 4,
    kind: 'orders',
    label: 'Perp Orders & Fills',
    layout: createModuleLayout('orders'),
    config: {},
  },
  {
    id: 5,
    kind: 'orderbook',
    label: 'Order Book',
    layout: createModuleLayout('orderbook'),
    config: {},
  },
  {
    id: 6,
    kind: 'positions',
    label: 'Open Positions',
    layout: createModuleLayout('positions'),
    config: {},
  },
];

export function createModuleLayout(
  kind: ModuleKind,
  layout?: Partial<WorkspaceModuleLayout>,
): WorkspaceModuleLayout {
  const defaultLayout = MODULE_DEFAULT_LAYOUTS[kind];
  const columns = Number.isInteger(layout?.columns) ? Number(layout?.columns) : defaultLayout.columns;
  const minHeight = Number.isFinite(layout?.minHeight)
    ? Number(layout?.minHeight)
    : defaultLayout.minHeight;

  return {
    columns: clampInteger(columns, MIN_WORKSPACE_MODULE_COLUMNS, WORKSPACE_GRID_COLUMNS),
    minHeight: clampInteger(
      minHeight,
      defaultLayout.minHeight,
      MAX_WORKSPACE_MODULE_HEIGHT,
    ),
  };
}

export function createLegacyModuleLayout(
  kind: ModuleKind,
  size: 'full' | 'wide' | 'normal',
): WorkspaceModuleLayout {
  return createModuleLayout(kind, {
    columns: size === 'full' ? WORKSPACE_GRID_COLUMNS : size === 'wide' ? 8 : 4,
  });
}

export function normalizeWorkspaceModule(module: WorkspaceModule): WorkspaceModule {
  return {
    ...module,
    layout: createModuleLayout(module.kind, module.layout),
  };
}

export function packWorkspaceModules(modules: WorkspaceModule[]): PackedWorkspaceRowItem[] {
  const packedRows: Array<
    Array<{
      module: WorkspaceModule;
      columnSpan: number;
      columnStart: number;
    }>
  > = [];
  let currentRow: Array<{
    module: WorkspaceModule;
    columnSpan: number;
    columnStart: number;
  }> = [];
  let occupiedColumns = 0;

  for (const normalizedModule of modules.map(normalizeWorkspaceModule)) {
    const columnSpan = normalizedModule.layout.columns;

    if (currentRow.length > 0 && occupiedColumns + columnSpan > WORKSPACE_GRID_COLUMNS) {
      packedRows.push(currentRow);
      currentRow = [];
      occupiedColumns = 0;
    }

    currentRow.push({
      module: normalizedModule,
      columnSpan,
      columnStart: occupiedColumns + 1,
    });
    occupiedColumns += columnSpan;

    if (occupiedColumns >= WORKSPACE_GRID_COLUMNS) {
      packedRows.push(currentRow);
      currentRow = [];
      occupiedColumns = 0;
    }
  }

  if (currentRow.length > 0) {
    packedRows.push(currentRow);
  }

  const packedItems: PackedWorkspaceRowItem[] = [];

  packedRows.forEach((row, rowIndex) => {
    if (row.length === 1) {
      const soloItem = row[0];
      if (!soloItem) {
        return;
      }

      packedItems.push({
        module: soloItem.module,
        columnStart: 1,
        columnSpan: WORKSPACE_GRID_COLUMNS,
        isSoloRow: true,
        rowIndex,
      });
      return;
    }

    packedItems.push(
      ...row.map((item) => ({
        module: item.module,
        columnStart: item.columnStart,
        columnSpan: item.columnSpan,
        isSoloRow: false,
        rowIndex,
      })),
    );
  });

  return packedItems;
}

export function moveModule(
  modules: WorkspaceModule[],
  sourceId: number,
  targetId: number,
  placement: WorkspaceInsertionPlacement = 'before',
): WorkspaceModule[] {
  if (sourceId === targetId) return modules;
  const sourceIndex = modules.findIndex((module) => module.id === sourceId);
  const targetIndex = modules.findIndex((module) => module.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return modules;

  const nextModules = [...modules];
  const [movedModule] = nextModules.splice(sourceIndex, 1);
  if (!movedModule) return modules;

  const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const insertionIndex = placement === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex;

  nextModules.splice(insertionIndex, 0, movedModule);
  return nextModules;
}

export function moveModuleToSharedRow(
  modules: WorkspaceModule[],
  sourceId: number,
  targetId: number,
  placement: WorkspaceInsertionPlacement,
): WorkspaceModule[] {
  const targetRowIds = getRowModuleIds(modules, targetId).filter((id) => id !== sourceId);
  const reorderedModules = moveModule(modules, sourceId, targetId, placement);
  if (targetRowIds.length === 0) {
    return reorderedModules;
  }

  const insertionIndex =
    targetRowIds.indexOf(targetId) + (placement === 'after' ? 1 : 0);
  const nextRowIds = [...targetRowIds];
  nextRowIds.splice(insertionIndex, 0, sourceId);

  return rebalanceRowModules(reorderedModules, nextRowIds);
}

export function pushModuleToEnd(modules: WorkspaceModule[], sourceId: number): WorkspaceModule[] {
  const sourceIndex = modules.findIndex((module) => module.id === sourceId);
  if (sourceIndex < 0) return modules;

  const nextModules = [...modules];
  const [movedModule] = nextModules.splice(sourceIndex, 1);
  if (!movedModule) return modules;
  nextModules.push(movedModule);
  return nextModules;
}

export function updateModuleLayout(
  modules: WorkspaceModule[],
  id: number,
  layout: Partial<WorkspaceModuleLayout>,
): WorkspaceModule[] {
  return modules.map((module) =>
    module.id === id
      ? {
          ...module,
          layout: createModuleLayout(module.kind, {
            ...module.layout,
            ...layout,
          }),
        }
      : module,
  );
}

export function createCustomModule(id: number): WorkspaceModule {
  return {
    id,
    kind: 'custom',
    label: `Custom Widget ${id}`,
    layout: createModuleLayout('custom'),
    config: {},
  };
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const roundedValue = Math.round(value);
  if (roundedValue < minimum) return minimum;
  if (roundedValue > maximum) return maximum;
  return roundedValue;
}

function getRowModuleIds(modules: WorkspaceModule[], targetId: number): number[] {
  const packedModules = packWorkspaceModules(modules);
  const targetRowIndex = packedModules.find((item) => item.module.id === targetId)?.rowIndex;
  if (targetRowIndex === undefined) {
    return [];
  }

  return packedModules
    .filter((item) => item.rowIndex === targetRowIndex)
    .map((item) => item.module.id);
}

function rebalanceRowModules(modules: WorkspaceModule[], rowIds: number[]): WorkspaceModule[] {
  const rowIdSet = new Set(rowIds);
  const normalizedModules = modules.map(normalizeWorkspaceModule);
  const rowModules = rowIds
    .map((id) => normalizedModules.find((module) => module.id === id))
    .filter((module): module is WorkspaceModule => Boolean(module));

  if (rowModules.length <= 1) {
    return normalizedModules;
  }

  const nextColumns = distributeColumnsAcrossRow(rowModules.map((module) => module.layout.columns));
  const nextColumnsById = new Map(rowModules.map((module, index) => [module.id, nextColumns[index] ?? module.layout.columns]));

  return normalizedModules.map((module) =>
    rowIdSet.has(module.id)
      ? {
          ...module,
          layout: {
            ...module.layout,
            columns: nextColumnsById.get(module.id) ?? module.layout.columns,
          },
        }
      : module,
  );
}

function distributeColumnsAcrossRow(columns: number[]): number[] {
  const nextColumns = [...columns];
  let totalColumns = nextColumns.reduce((sum, value) => sum + value, 0);

  while (totalColumns > WORKSPACE_GRID_COLUMNS) {
    let largestIndex = -1;
    for (let index = 0; index < nextColumns.length; index += 1) {
      const columnValue = nextColumns[index];
      const currentLargestValue = largestIndex === -1 ? -1 : (nextColumns[largestIndex] ?? -1);
      if (columnValue === undefined) {
        continue;
      }
      if (
        columnValue > MIN_WORKSPACE_MODULE_COLUMNS &&
        (largestIndex === -1 || columnValue > currentLargestValue)
      ) {
        largestIndex = index;
      }
    }

    if (largestIndex === -1) {
      break;
    }

    const nextValue = nextColumns[largestIndex];
    if (nextValue === undefined) {
      break;
    }

    nextColumns[largestIndex] = nextValue - 1;
    totalColumns -= 1;
  }

  return nextColumns;
}
