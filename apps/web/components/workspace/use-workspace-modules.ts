'use client';

import { useState } from 'react';
import type { DragEvent } from 'react';
import {
  createCustomModule,
  initialModules,
  moveModule,
  pushModuleToEnd,
} from '@/components/workspace/logic';
import type { WorkspaceModule } from '@/components/workspace/types';

export function useWorkspaceModules() {
  const [modules, setModules] = useState<WorkspaceModule[]>(initialModules);
  const [nextModuleId, setNextModuleId] = useState(initialModules.length + 1);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);

  const addModule = () => {
    setModules((currentModules) => [...currentModules, createCustomModule(nextModuleId)]);
    setNextModuleId((currentId) => currentId + 1);
  };

  const removeModule = (id: number) => {
    setModules((currentModules) => currentModules.filter((module) => module.id !== id));
  };

  const resetLayout = () => {
    setModules(initialModules);
    setNextModuleId(initialModules.length + 1);
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
