# Workspace Layout Persistence (Prototype)

This prototype persists the trading workspace layout in browser `localStorage` so module order and custom widgets survive reloads and new sessions.

## Where It Is Implemented

- `apps/web/components/workspace/use-workspace-modules.ts`

## Storage Key

- `dexera-prototype.workspace-layout.v1`

## Serialized Shape

```json
{
  "modules": [
    {
      "id": 1,
      "kind": "overview",
      "label": "Market Overview",
      "size": "full"
    }
  ]
}
```

`modules` is an array of `WorkspaceModule` objects.

## Runtime Flow

1. Initial render starts from in-code defaults (`initialModules`).
2. On mount, the hook reads the storage key.
3. Stored data is parsed and validated:
   - Must be an object with a `modules` array.
   - Each module must have valid `id`, `kind`, `label`, and `size`.
4. If valid, the stored layout replaces defaults.
5. `nextModuleId` is recalculated from the max existing module id (`max + 1`) so new custom modules continue correctly.
6. After the initial load completes, any layout change writes the latest serialized `modules` back to `localStorage`.

## Failure/Fallback Behavior

- Missing key: use default layout.
- Invalid JSON or invalid module shape: ignore persisted value and use defaults.
- Storage write failures (quota/private mode): ignored silently (prototype-safe behavior).
- Server-side rendering safety: storage access is guarded with `typeof window !== 'undefined'`.

## Reset Behavior

`Reset Layout` restores `initialModules`. The persistence effect then overwrites the stored layout with the reset default state.

## Manual Verification

1. Open web app and move modules/add a custom module.
2. Refresh the page: layout should remain.
3. Close tab/browser and reopen the app: layout should still remain.
4. Click `Reset Layout`: default layout should return.
5. Refresh again: reset layout should persist.
