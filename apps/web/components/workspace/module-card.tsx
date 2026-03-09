import type { DragEvent, PointerEvent } from 'react';
import { GripVertical, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ModuleContent } from '@/components/workspace/module-content';
import type { WorkspaceMarketDataState } from '@/components/workspace/use-workspace-market-data';
import type { WorkspaceModule } from '@/components/workspace/types';
import { cn } from '@/lib/utils';

type WorkspaceModuleCardProps = {
  module: WorkspaceModule;
  marketData: WorkspaceMarketDataState;
  draggingId: number | null;
  dropTargetId: number | null;
  onRemove: (id: number) => void;
  onDragStart: (id: number, event: DragEvent<HTMLElement>) => void;
  onPointerDownOnModule: (id: number, event: PointerEvent<HTMLElement>) => void;
  onPointerEnterModule: (id: number) => void;
  onPointerUpOnModule: (id: number) => void;
  onDragOverModule: (id: number, event: DragEvent<HTMLElement>) => void;
  onDropOnModule: (id: number, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
};

export function WorkspaceModuleCard({
  module,
  marketData,
  draggingId,
  dropTargetId,
  onRemove,
  onDragStart,
  onPointerDownOnModule,
  onPointerEnterModule,
  onPointerUpOnModule,
  onDragOverModule,
  onDropOnModule,
  onDragEnd,
}: WorkspaceModuleCardProps) {
  const sizeClassName =
    module.size === 'full'
      ? 'xl:col-span-12'
      : module.size === 'wide'
        ? 'xl:col-span-8'
        : 'xl:col-span-4';
  const minHeightClassName = module.kind === 'overview' ? 'min-h-[190px]' : 'min-h-[280px]';

  return (
    <Card
      data-testid="module-card"
      className={cn(
        'col-span-1 flex flex-col overflow-hidden border-border/80 bg-card/90 transition-all duration-150 xl:col-span-12',
        sizeClassName,
        minHeightClassName,
        draggingId === module.id && 'scale-[0.99] opacity-55',
        dropTargetId === module.id && 'border-primary/60 ring-1 ring-primary/40',
      )}
      draggable
      onDragStart={(event) => onDragStart(module.id, event)}
      onPointerDown={(event) => onPointerDownOnModule(module.id, event)}
      onPointerEnter={() => onPointerEnterModule(module.id)}
      onPointerUp={() => onPointerUpOnModule(module.id)}
      onDragOver={(event) => onDragOverModule(module.id, event)}
      onDrop={(event) => onDropOnModule(module.id, event)}
      onDragEnd={onDragEnd}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/70 bg-background/35 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-8 items-center justify-center rounded-md border border-border/70 bg-background/80 text-muted-foreground"
            aria-hidden="true"
          >
            <GripVertical className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground" data-testid="module-title">
              {module.label}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onRemove(module.id)}
          aria-label={`Remove ${module.label}`}
        >
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-4">
        <ModuleContent module={module} marketData={marketData} />
      </CardContent>
    </Card>
  );
}
