import type { WorkspaceModule } from '@/components/workspace/types';

export const initialModules: WorkspaceModule[] = [
  { id: 1, kind: 'overview', label: 'Market Overview', size: 'full', config: {} },
  { id: 2, kind: 'chart', label: 'Price Chart', size: 'wide', config: {} },
  { id: 3, kind: 'trade', label: 'Order Entry', size: 'normal', config: {} },
  { id: 4, kind: 'orders', label: 'Perp Orders & Fills', size: 'wide', config: {} },
  { id: 5, kind: 'orderbook', label: 'Order Book', size: 'normal', config: {} },
  { id: 6, kind: 'positions', label: 'Open Positions', size: 'wide', config: {} },
];

export function moveModule(
  modules: WorkspaceModule[],
  sourceId: number,
  targetId: number,
): WorkspaceModule[] {
  if (sourceId === targetId) return modules;
  const sourceIndex = modules.findIndex((module) => module.id === sourceId);
  const targetIndex = modules.findIndex((module) => module.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return modules;

  const nextModules = [...modules];
  const [movedModule] = nextModules.splice(sourceIndex, 1);
  if (!movedModule) return modules;
  nextModules.splice(targetIndex, 0, movedModule);
  return nextModules;
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

export function createCustomModule(id: number): WorkspaceModule {
  return { id, kind: 'custom', label: `Custom Widget ${id}`, size: 'normal', config: {} };
}
