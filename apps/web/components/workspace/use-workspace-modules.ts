'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import type {
  DragEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react';
import {
  deserializeWorkspaceLayout,
  serializeWorkspaceLayout,
} from '@/components/workspace/layout-serialization';
import {
  createModuleLayout,
  createCustomModule,
  createLegacyModuleLayout,
  initialModules,
  moveModuleToSharedRow,
  packWorkspaceModules,
  pushModuleToEnd,
  updateModuleLayout,
  WORKSPACE_GRID_GAP_PX,
  type WorkspaceInsertionPlacement,
} from '@/components/workspace/logic';
import {
  MAX_WORKSPACE_MODULE_HEIGHT,
  MODULE_KINDS,
  MIN_WORKSPACE_MODULE_COLUMNS,
  WORKSPACE_GRID_COLUMNS,
  type ModuleKind,
  type WorkspaceModule,
  type WorkspaceModuleLayout,
} from '@/components/workspace/types';

const WORKSPACE_LAYOUT_STORAGE_KEY = 'dexera-prototype.workspace-layout.v1';

type ResizeDirection = 'east' | 'south' | 'southeast';
type WorkspaceDropTarget = {
  id: number;
  placement: WorkspaceInsertionPlacement;
};

type ResizeSession = {
  direction: ResizeDirection;
  id: number;
  kind: ModuleKind;
  startColumns: number;
  startMinHeight: number;
  startX: number;
  startY: number;
  columnStep: number;
};

function getNextModuleId(modules: WorkspaceModule[]): number {
  return modules.reduce((maxId, module) => Math.max(maxId, module.id), 0) + 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isModuleKind(value: unknown): value is ModuleKind {
  return typeof value === 'string' && MODULE_KINDS.includes(value as ModuleKind);
}

function hasUniqueModuleIds(modules: WorkspaceModule[]): boolean {
  const moduleIds = new Set<number>();
  for (const moduleItem of modules) {
    if (moduleIds.has(moduleItem.id)) {
      return false;
    }
    moduleIds.add(moduleItem.id);
  }
  return true;
}

function parseLegacyModuleLayout(
  kind: ModuleKind,
  value: Record<string, unknown>,
): WorkspaceModuleLayout | null {
  if (isPositiveInteger(value.columns) && isPositiveInteger(value.minHeight)) {
    return createModuleLayout(kind, {
      columns: value.columns,
      minHeight: value.minHeight,
    });
  }

  const size = value.size;
  if (size === 'full' || size === 'wide' || size === 'normal') {
    return createLegacyModuleLayout(kind, size);
  }

  return null;
}

function parseLegacyPersistedLayout(
  rawValue: string,
): { modules: WorkspaceModule[]; nextModuleId: number } | null {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (!isRecord(parsedValue)) {
    return null;
  }

  const modulesValue = parsedValue.modules;
  if (!Array.isArray(modulesValue)) {
    return null;
  }

  const modules: WorkspaceModule[] = [];
  for (const item of modulesValue) {
    if (!isRecord(item)) {
      return null;
    }

    if (!isPositiveInteger(item.id) || typeof item.label !== 'string') {
      return null;
    }

    if (!isModuleKind(item.kind)) {
      return null;
    }

    const layout = parseLegacyModuleLayout(item.kind, item);
    if (!layout) {
      return null;
    }

    modules.push({
      id: item.id,
      kind: item.kind,
      label: item.label,
      layout,
      config: {},
    });
  }

  if (!hasUniqueModuleIds(modules)) {
    return null;
  }

  const minimumNextModuleId = getNextModuleId(modules);
  const nextModuleId = isPositiveInteger(parsedValue.nextModuleId)
    ? Math.max(parsedValue.nextModuleId, minimumNextModuleId)
    : minimumNextModuleId;

  return { modules, nextModuleId };
}

function loadPersistedLayout(): { modules: WorkspaceModule[]; nextModuleId: number } | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.localStorage;
    const rawValue = storage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
    if (rawValue === null) {
      return null;
    }

    const deterministicLayout = deserializeWorkspaceLayout(rawValue);
    if (deterministicLayout) {
      return deterministicLayout;
    }

    const legacyLayout = parseLegacyPersistedLayout(rawValue);
    if (legacyLayout) {
      return legacyLayout;
    }

    storage.removeItem(WORKSPACE_LAYOUT_STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

export function useWorkspaceModules(gridRef: RefObject<HTMLElement | null>) {
  const [modules, setModules] = useState<WorkspaceModule[]>(initialModules);
  const [nextModuleId, setNextModuleId] = useState(getNextModuleId(initialModules));
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<WorkspaceDropTarget | null>(null);
  const [resizingId, setResizingId] = useState<number | null>(null);
  const [hasLoadedPersistedLayout, setHasLoadedPersistedLayout] = useState(false);
  const dragSourceIdRef = useRef<number | null>(null);
  const dropTargetRef = useRef<WorkspaceDropTarget | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);

  useEffect(() => {
    const storedLayout = loadPersistedLayout();
    if (storedLayout !== null) {
      setModules(storedLayout.modules);
      setNextModuleId(storedLayout.nextModuleId);
    }
    setHasLoadedPersistedLayout(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedLayout || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        WORKSPACE_LAYOUT_STORAGE_KEY,
        serializeWorkspaceLayout({ modules, nextModuleId }),
      );
    } catch {
      // Ignore storage write failures in prototype mode.
    }
  }, [hasLoadedPersistedLayout, modules, nextModuleId]);

  useEffect(() => {
    if (resizingId === null) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session) {
        return;
      }

      const nextColumns =
        session.direction === 'south'
          ? session.startColumns
          : clampInteger(
              session.startColumns + Math.round((event.clientX - session.startX) / session.columnStep),
              MIN_WORKSPACE_MODULE_COLUMNS,
              WORKSPACE_GRID_COLUMNS,
            );
      const nextMinHeight =
        session.direction === 'east'
          ? session.startMinHeight
          : clampInteger(
              session.startMinHeight + (event.clientY - session.startY),
              createLegacyModuleLayout(session.kind, 'normal').minHeight,
              MAX_WORKSPACE_MODULE_HEIGHT,
            );

      startTransition(() => {
        setModules((currentModules) =>
          updateModuleLayout(currentModules, session.id, {
            columns: nextColumns,
            minHeight: nextMinHeight,
          }),
        );
      });
    };

    const handlePointerUp = () => {
      resizeSessionRef.current = null;
      setResizingId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizingId]);

  const addModule = () => {
    setModules((currentModules) => [...currentModules, createCustomModule(nextModuleId)]);
    setNextModuleId((currentId) => currentId + 1);
  };

  const removeModule = (id: number) => {
    setModules((currentModules) => currentModules.filter((module) => module.id !== id));
  };

  const resetLayout = () => {
    setModules(initialModules);
    setNextModuleId(getNextModuleId(initialModules));
    dragSourceIdRef.current = null;
    dropTargetRef.current = null;
    resizeSessionRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
    setResizingId(null);
  };

  const handleDragStart = (id: number, event: DragEvent<HTMLElement>) => {
    const target = event.target;
    if (
      resizingId !== null ||
      !(target instanceof Element) ||
      target.closest('button,[data-resize-handle="true"]') !== null
    ) {
      event.preventDefault();
      return;
    }

    dragSourceIdRef.current = id;
    event.dataTransfer.setData('text/plain', String(id));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const handlePointerDownOnModule = (id: number, event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target;
    if (
      resizingId !== null ||
      !(target instanceof Element) ||
      target.closest('button,[data-resize-handle="true"]') !== null
    ) {
      return;
    }

    dragSourceIdRef.current = id;
    setDraggingId(id);
  };

  const handlePointerEnterModule = (
    targetId: number,
    placement: WorkspaceInsertionPlacement,
  ) => {
    if (
      resizingId !== null ||
      dragSourceIdRef.current === null ||
      targetId === dragSourceIdRef.current
    ) {
      return;
    }

    const nextDropTarget = { id: targetId, placement };
    dropTargetRef.current = nextDropTarget;
    setDropTarget(nextDropTarget);
  };

  const handlePointerUpOnModule = (
    targetId: number,
    placement: WorkspaceInsertionPlacement,
  ) => {
    if (resizingId !== null) {
      return;
    }

    const sourceId = dragSourceIdRef.current;
    if (sourceId !== null && sourceId !== targetId) {
      setModules((currentModules) =>
        moveModuleToSharedRow(currentModules, sourceId, targetId, placement),
      );
    }

    dragSourceIdRef.current = null;
    dropTargetRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleDragOverModule = (
    targetId: number,
    placement: WorkspaceInsertionPlacement,
    event: DragEvent<HTMLElement>,
  ) => {
    if (resizingId !== null) {
      return;
    }

    event.preventDefault();
    if (targetId !== dragSourceIdRef.current) {
      const nextDropTarget = { id: targetId, placement };
      dropTargetRef.current = nextDropTarget;
      setDropTarget(nextDropTarget);
    }
  };

  const handleDropOnModule = (
    targetId: number,
    placement: WorkspaceInsertionPlacement,
    event: DragEvent<HTMLElement>,
  ) => {
    if (resizingId !== null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const sourceId = dragSourceIdRef.current ?? Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(sourceId) || sourceId === targetId) {
      dragSourceIdRef.current = null;
      dropTargetRef.current = null;
      setDraggingId(null);
      setDropTarget(null);
      return;
    }
    setModules((currentModules) =>
      moveModuleToSharedRow(currentModules, sourceId, targetId, placement),
    );
    dragSourceIdRef.current = null;
    dropTargetRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleDragOverCanvas = (event: DragEvent<HTMLElement>) => {
    if (resizingId !== null) {
      return;
    }

    event.preventDefault();
    if (event.target !== event.currentTarget) {
      return;
    }

    dropTargetRef.current = null;
    setDropTarget(null);
  };

  const handleDropOnCanvas = (event: DragEvent<HTMLElement>) => {
    if (resizingId !== null) {
      return;
    }

    event.preventDefault();
    const sourceId = dragSourceIdRef.current ?? Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(sourceId)) {
      dragSourceIdRef.current = null;
      dropTargetRef.current = null;
      setDraggingId(null);
      setDropTarget(null);
      return;
    }
    const activeDropTarget = dropTargetRef.current;

    setModules((currentModules) =>
      activeDropTarget !== null
        ? moveModuleToSharedRow(
            currentModules,
            sourceId,
            activeDropTarget.id,
            activeDropTarget.placement,
          )
        : pushModuleToEnd(currentModules, sourceId),
    );
    dragSourceIdRef.current = null;
    dropTargetRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleResizeStart = (
    id: number,
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const activeModule = modules.find((moduleItem) => moduleItem.id === id);
    const gridElement = gridRef.current;
    if (!activeModule || !gridElement) {
      return;
    }

    const gridWidth = gridElement.getBoundingClientRect().width;
    const columnTrackWidth =
      (gridWidth - WORKSPACE_GRID_GAP_PX * (WORKSPACE_GRID_COLUMNS - 1)) / WORKSPACE_GRID_COLUMNS;
    const columnStep = Math.max(columnTrackWidth + WORKSPACE_GRID_GAP_PX, 1);

    resizeSessionRef.current = {
      direction,
      id,
      kind: activeModule.kind,
      startColumns: activeModule.layout.columns,
      startMinHeight: activeModule.layout.minHeight,
      startX: event.clientX,
      startY: event.clientY,
      columnStep,
    };
    dragSourceIdRef.current = null;
    dropTargetRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
    setResizingId(id);
  };

  const clearDragState = () => {
    dragSourceIdRef.current = null;
    dropTargetRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  return {
    modules: packWorkspaceModules(modules),
    draggingId,
    dropTarget,
    resizingId,
    addModule,
    removeModule,
    resetLayout,
    handleDragStart,
    handlePointerDownOnModule,
    handlePointerEnterModule,
    handlePointerUpOnModule,
    handleDragOverModule,
    handleDropOnModule,
    handleDragOverCanvas,
    handleDropOnCanvas,
    handleResizeStart,
    clearDragState,
  };
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const roundedValue = Math.round(value);
  if (roundedValue < minimum) return minimum;
  if (roundedValue > maximum) return maximum;
  return roundedValue;
}
