'use client';

import { WorkspaceModuleCard } from '@/components/workspace/module-card';
import { TerminalHeader } from '@/components/workspace/terminal-header';
import { useWorkspaceMarketData } from '@/components/workspace/use-workspace-market-data';
import { useWorkspaceModules } from '@/components/workspace/use-workspace-modules';
import { WorkspaceToolbar } from '@/components/workspace/workspace-toolbar';

export function TradingWorkspace() {
  const marketData = useWorkspaceMarketData();
  const {
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
  } = useWorkspaceModules();

  return (
    <main className="terminal-page">
      <section className="terminal-shell">
        <TerminalHeader />
        <WorkspaceToolbar onAddModule={addModule} onResetLayout={resetLayout} />

        <section
          className="workspace-grid"
          aria-label="Trading workspace modules"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDropOnCanvas}
        >
          {modules.map((module) => (
            <WorkspaceModuleCard
              key={module.id}
              module={module}
              marketData={marketData}
              draggingId={draggingId}
              dropTargetId={dropTargetId}
              onRemove={removeModule}
              onDragStart={handleDragStart}
              onPointerDownOnModule={handlePointerDownOnModule}
              onPointerEnterModule={handlePointerEnterModule}
              onPointerUpOnModule={handlePointerUpOnModule}
              onDragOverModule={handleDragOverModule}
              onDropOnModule={handleDropOnModule}
              onDragEnd={clearDragState}
            />
          ))}
        </section>
      </section>
    </main>
  );
}
