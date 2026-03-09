'use client';

import { WorkspaceModuleCard } from '@/components/workspace/module-card';
import { TerminalHeader } from '@/components/workspace/terminal-header';
import { useWorkspaceMarketData } from '@/components/workspace/use-workspace-market-data';
import { useWorkspaceModules } from '@/components/workspace/use-workspace-modules';
import { SubmittedPerpActionsTrackerProvider } from '@/lib/wallet/use-submitted-perp-actions';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';

export function TradingWorkspace() {
  const { activeSlot } = useWalletManager();
  const marketData = useWorkspaceMarketData();
  const {
    modules,
    draggingId,
    dropTargetId,
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
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6">
      <section className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
        <TerminalHeader onResetLayout={resetLayout} />

        <SubmittedPerpActionsTrackerProvider
          activeWallet={
            activeSlot
              ? {
                  accountId: activeSlot.accountId,
                  venue: activeSlot.venue,
                }
              : null
          }
        >
          <section
            className="grid grid-cols-1 gap-4 xl:grid-cols-12"
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
        </SubmittedPerpActionsTrackerProvider>
      </section>
    </main>
  );
}
