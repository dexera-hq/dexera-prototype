'use client';

import { useEffect, useRef, useState } from 'react';
import type { DragEvent, PointerEvent } from 'react';
import {
  deserializeWorkspaceLayout,
  serializeWorkspaceLayout,
} from '@/components/workspace/layout-serialization';
import {
  createCustomModule,
  initialModules,
  moveModule,
  pushModuleToEnd,
} from '@/components/workspace/logic';
import { MODULE_KINDS, MODULE_SIZES, type WorkspaceModule } from '@/components/workspace/types';

const WORKSPACE_LAYOUT_STORAGE_KEY = 'dexera-prototype.workspace-layout.v1';

function getNextModuleId(modules: WorkspaceModule[]): number {
  return modules.reduce((maxId, module) => Math.max(maxId, module.id), 0) + 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isModuleKind(value: unknown): value is (typeof MODULE_KINDS)[number] {
  return typeof value === 'string' && MODULE_KINDS.includes(value as (typeof MODULE_KINDS)[number]);
}

function isModuleSize(value: unknown): value is (typeof MODULE_SIZES)[number] {
  return typeof value === 'string' && MODULE_SIZES.includes(value as (typeof MODULE_SIZES)[number]);
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

    if (!isModuleKind(item.kind) || !isModuleSize(item.size)) {
      return null;
    }

    modules.push({
      id: item.id,
      kind: item.kind,
      label: item.label,
      size: item.size,
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

export function useWorkspaceModules() {
  const [modules, setModules] = useState<WorkspaceModule[]>(initialModules);
  const [nextModuleId, setNextModuleId] = useState(getNextModuleId(initialModules));
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [hasLoadedPersistedLayout, setHasLoadedPersistedLayout] = useState(false);
  const dragSourceIdRef = useRef<number | null>(null);
  const dropTargetIdRef = useRef<number | null>(null);

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
    dropTargetIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragStart = (id: number, event: DragEvent<HTMLElement>) => {
    dragSourceIdRef.current = id;
    event.dataTransfer.setData('text/plain', String(id));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const handlePointerDownOnModule = (id: number, event: PointerEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('button') !== null) {
      return;
    }

    dragSourceIdRef.current = id;
    setDraggingId(id);
  };

  const handlePointerEnterModule = (targetId: number) => {
    if (dragSourceIdRef.current === null || targetId === dragSourceIdRef.current) {
      return;
    }

    dropTargetIdRef.current = targetId;
    setDropTargetId(targetId);
  };

  const handlePointerUpOnModule = (targetId: number) => {
    const sourceId = dragSourceIdRef.current;
    if (sourceId !== null && sourceId !== targetId) {
      setModules((currentModules) => moveModule(currentModules, sourceId, targetId));
    }

    dragSourceIdRef.current = null;
    dropTargetIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragOverModule = (targetId: number, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (targetId !== dragSourceIdRef.current) {
      dropTargetIdRef.current = targetId;
      setDropTargetId(targetId);
    }
  };

  const handleDropOnModule = (targetId: number, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = dragSourceIdRef.current ?? Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(sourceId)) {
      dragSourceIdRef.current = null;
      dropTargetIdRef.current = null;
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }
    setModules((currentModules) => moveModule(currentModules, sourceId, targetId));
    dragSourceIdRef.current = null;
    dropTargetIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDropOnCanvas = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceId = dragSourceIdRef.current ?? Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(sourceId)) {
      dragSourceIdRef.current = null;
      dropTargetIdRef.current = null;
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }
    setModules((currentModules) => pushModuleToEnd(currentModules, sourceId));
    dragSourceIdRef.current = null;
    dropTargetIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const clearDragState = () => {
    dragSourceIdRef.current = null;
    dropTargetIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };

  return {
    modules,
    draggingId,
    dropTargetId,
    addModule,
    removeModule,
    resetLayout,
    handleDragStart,
    handlePointerDownOnModule,
    handlePointerEnterModule,
    handlePointerUpOnModule,
    handleDragOverModule,
    handleDropOnModule,
    handleDropOnCanvas,
    clearDragState,
  };
}
