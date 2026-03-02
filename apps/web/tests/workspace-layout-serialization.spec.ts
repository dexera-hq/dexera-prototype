import { describe, expect, it } from 'vitest';
import {
  deserializeWorkspaceLayout,
  serializeWorkspaceLayout,
  type WorkspaceLayoutState,
} from '../components/workspace/layout-serialization';

describe('workspace layout serialization', () => {
  it('serializes with deterministic ordering', () => {
    const workspaceState: WorkspaceLayoutState = {
      nextModuleId: 3,
      modules: [
        {
          id: 2,
          kind: 'custom',
          label: 'B',
          size: 'normal',
          config: { z: 2, a: 1, nested: { y: true, x: false } },
        },
        {
          id: 1,
          kind: 'overview',
          label: 'A',
          size: 'full',
          config: { stats: { gamma: 3, alpha: 1 }, mode: 'spot' },
        },
      ],
    };

    const serialized = serializeWorkspaceLayout(workspaceState);
    expect(serialized).toBe(
      '{"version":1,"nextModuleId":3,"layout":[2,1],"blocks":[{"id":1,"kind":"overview","label":"A","size":"full","config":{"mode":"spot","stats":{"alpha":1,"gamma":3}}},{"id":2,"kind":"custom","label":"B","size":"normal","config":{"a":1,"nested":{"x":false,"y":true},"z":2}}]}',
    );
  });

  it('round-trips layout and block config', () => {
    const inputState: WorkspaceLayoutState = {
      nextModuleId: 12,
      modules: [
        {
          id: 10,
          kind: 'trade',
          label: 'Trade Panel',
          size: 'normal',
          config: {
            mode: 'limit',
            allocations: [25, 50, 75, 100],
            advanced: { reduceOnly: false, postOnly: true },
          },
        },
        {
          id: 7,
          kind: 'chart',
          label: 'Chart',
          size: 'wide',
          config: { indicators: ['ema', 'rsi'], timeframe: '1h' },
        },
      ],
    };

    const serialized = serializeWorkspaceLayout(inputState);
    const deserialized = deserializeWorkspaceLayout(serialized);

    expect(deserialized).not.toBeNull();
    expect(serializeWorkspaceLayout(deserialized as WorkspaceLayoutState)).toBe(serialized);
  });

  it('deserializes layout ids and appends blocks missing from layout', () => {
    const deserialized = deserializeWorkspaceLayout(
      JSON.stringify({
        version: 1,
        nextModuleId: 2,
        layout: [20, 20, 999],
        blocks: [
          { id: 3, kind: 'positions', label: 'Positions', size: 'wide', config: { b: 2, a: 1 } },
          { id: 20, kind: 'orderbook', label: 'Order Book', size: 'normal', config: {} },
        ],
      }),
    );

    expect(deserialized).toEqual({
      nextModuleId: 21,
      modules: [
        { id: 20, kind: 'orderbook', label: 'Order Book', size: 'normal', config: {} },
        { id: 3, kind: 'positions', label: 'Positions', size: 'wide', config: { a: 1, b: 2 } },
      ],
    });
  });

  it('returns null for invalid payloads', () => {
    expect(deserializeWorkspaceLayout('not-json')).toBeNull();
    expect(deserializeWorkspaceLayout(JSON.stringify({ version: 2 }))).toBeNull();
  });
});
