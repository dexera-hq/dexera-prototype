import { describe, expect, it } from 'vitest';
import {
  createModuleLayout,
  moveModule,
  moveModuleToSharedRow,
  packWorkspaceModules,
  updateModuleLayout,
} from '../components/workspace/logic';
import type { WorkspaceModule } from '../components/workspace/types';

describe('workspace layout logic', () => {
  it('expands a module to the full row when it is alone', () => {
    const modules: WorkspaceModule[] = [
      {
        id: 1,
        kind: 'chart',
        label: 'Chart',
        layout: createModuleLayout('chart', { columns: 8 }),
        config: {},
      },
      {
        id: 2,
        kind: 'trade',
        label: 'Trade',
        layout: createModuleLayout('trade', { columns: 4 }),
        config: {},
      },
      {
        id: 3,
        kind: 'positions',
        label: 'Positions',
        layout: createModuleLayout('positions', { columns: 8 }),
        config: {},
      },
    ];

    const packedModules = packWorkspaceModules(modules);

    expect(packedModules).toEqual([
      expect.objectContaining({
        module: expect.objectContaining({ id: 1 }),
        columnStart: 1,
        columnSpan: 8,
        isSoloRow: false,
      }),
      expect.objectContaining({
        module: expect.objectContaining({ id: 2 }),
        columnStart: 9,
        columnSpan: 4,
        isSoloRow: false,
      }),
      expect.objectContaining({
        module: expect.objectContaining({ id: 3 }),
        columnStart: 1,
        columnSpan: 12,
        isSoloRow: true,
      }),
    ]);
  });

  it('keeps multiple modules on their explicit spans within the same row', () => {
    const modules: WorkspaceModule[] = [
      {
        id: 1,
        kind: 'custom',
        label: 'A',
        layout: createModuleLayout('custom', { columns: 3 }),
        config: {},
      },
      {
        id: 2,
        kind: 'custom',
        label: 'B',
        layout: createModuleLayout('custom', { columns: 5 }),
        config: {},
      },
      {
        id: 3,
        kind: 'custom',
        label: 'C',
        layout: createModuleLayout('custom', { columns: 4 }),
        config: {},
      },
    ];

    const packedModules = packWorkspaceModules(modules);

    expect(
      packedModules.map(({ module, columnStart, columnSpan }) => ({
        id: module.id,
        columnStart,
        columnSpan,
      })),
    ).toEqual([
      { id: 1, columnStart: 1, columnSpan: 3 },
      { id: 2, columnStart: 4, columnSpan: 5 },
      { id: 3, columnStart: 9, columnSpan: 4 },
    ]);
  });

  it('clamps resized layout updates into valid bounds', () => {
    const modules: WorkspaceModule[] = [
      {
        id: 1,
        kind: 'custom',
        label: 'Custom',
        layout: createModuleLayout('custom'),
        config: {},
      },
    ];

    const nextModules = updateModuleLayout(modules, 1, {
      columns: 99,
      minHeight: 50,
    });

    expect(nextModules[0]).toEqual(
      expect.objectContaining({
        layout: {
          columns: 12,
          minHeight: 280,
        },
      }),
    );
  });

  it('can insert a module after a target to build a shared row intentionally', () => {
    const modules: WorkspaceModule[] = [
      {
        id: 1,
        kind: 'chart',
        label: 'Chart',
        layout: createModuleLayout('chart', { columns: 8 }),
        config: {},
      },
      {
        id: 2,
        kind: 'positions',
        label: 'Positions',
        layout: createModuleLayout('positions', { columns: 8 }),
        config: {},
      },
      {
        id: 3,
        kind: 'trade',
        label: 'Trade',
        layout: createModuleLayout('trade', { columns: 4 }),
        config: {},
      },
    ];

    const reorderedModules = moveModule(modules, 3, 1, 'after');
    const packedModules = packWorkspaceModules(reorderedModules);

    expect(reorderedModules.map((module) => module.id)).toEqual([1, 3, 2]);
    expect(
      packedModules.map(({ module, columnStart, columnSpan }) => ({
        id: module.id,
        columnStart,
        columnSpan,
      })),
    ).toEqual([
      { id: 1, columnStart: 1, columnSpan: 8 },
      { id: 3, columnStart: 9, columnSpan: 4 },
      { id: 2, columnStart: 1, columnSpan: 12 },
    ]);
  });

  it('rebalances the target row so a side drop actually lands in that row', () => {
    const modules: WorkspaceModule[] = [
      {
        id: 1,
        kind: 'chart',
        label: 'Chart',
        layout: createModuleLayout('chart', { columns: 8 }),
        config: {},
      },
      {
        id: 2,
        kind: 'positions',
        label: 'Positions',
        layout: createModuleLayout('positions', { columns: 8 }),
        config: {},
      },
      {
        id: 3,
        kind: 'trade',
        label: 'Trade',
        layout: createModuleLayout('trade', { columns: 4 }),
        config: {},
      },
    ];

    const nextModules = moveModuleToSharedRow(modules, 2, 1, 'after');
    const packedModules = packWorkspaceModules(nextModules);

    expect(nextModules.map((module) => ({ id: module.id, columns: module.layout.columns }))).toEqual([
      { id: 1, columns: 6 },
      { id: 2, columns: 6 },
      { id: 3, columns: 4 },
    ]);
    expect(
      packedModules.map(({ module, rowIndex, columnStart, columnSpan }) => ({
        id: module.id,
        rowIndex,
        columnStart,
        columnSpan,
      })),
    ).toEqual([
      { id: 1, rowIndex: 0, columnStart: 1, columnSpan: 6 },
      { id: 2, rowIndex: 0, columnStart: 7, columnSpan: 6 },
      { id: 3, rowIndex: 1, columnStart: 1, columnSpan: 12 },
    ]);
  });
});
