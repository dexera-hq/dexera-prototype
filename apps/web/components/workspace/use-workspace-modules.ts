'use client';

import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
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

function isWorkspaceModule(value: unknown): value is WorkspaceModule {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const moduleRecord = value as Record<string, unknown>;
  const kind = moduleRecord.kind;
  const size = moduleRecord.size;

  return (
    Number.isInteger(moduleRecord.id) &&
    Number(moduleRecord.id) > 0 &&
    typeof moduleRecord.label === 'string' &&
    typeof kind === 'string' &&
    MODULE_KINDS.includes(kind as (typeof MODULE_KINDS)[number]) &&
    typeof size === 'string' &&
    MODULE_SIZES.includes(size as (typeof MODULE_SIZES)[number])
  );
}

function loadPersistedModules(): WorkspaceModule[] | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!parsedValue || typeof parsedValue !== 'object') {
      return null;
    }

    const modules = (parsedValue as { modules?: unknown }).modules;
    if (!Array.isArray(modules)) {
      return null;
    }

    if (!modules.every(isWorkspaceModule)) {
      return null;
    }

    return modules;
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

  useEffect(() => {
    const storedModules = loadPersistedModules();
    if (storedModules) {
      setModules(storedModules);
      setNextModuleId(getNextModuleId(storedModules));
    }
    setHasLoadedPersistedLayout(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedLayout || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify({ modules }));
    } catch {
      // Ignore storage write failures in prototype mode.
    }
  }, [hasLoadedPersistedLayout, modules]);

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
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragStart = (id: number, event: DragEvent<HTMLElement>) => {
    event.dataTransfer.setData('text/plain', String(id));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const handleDragOverModule = (targetId: number, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (targetId !== draggingId) {
      setDropTargetId(targetId);
    }
  };

  const handleDropOnModule = (targetId: number, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = draggingId ?? Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(sourceId)) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }
    setModules((currentModules) => moveModule(currentModules, sourceId, targetId));
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDropOnCanvas = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceId = draggingId ?? Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(sourceId)) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }
    setModules((currentModules) => pushModuleToEnd(currentModules, sourceId));
    setDraggingId(null);
    setDropTargetId(null);
  };

  const clearDragState = () => {
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
    handleDragOverModule,
    handleDropOnModule,
    handleDropOnCanvas,
    clearDragState,
  };
}
