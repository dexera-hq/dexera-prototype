import type { DragEvent, PointerEvent } from 'react';
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
  return (
    <Card
      data-testid="module-card"
      className={cn(
        'module-card',
        `module-${module.size}`,
        draggingId === module.id && 'is-dragging',
        dropTargetId === module.id && 'is-drop-target',
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
      <CardHeader className="module-header">
        <p>
          <span className="drag-handle" aria-hidden="true">
            &#8942;&#8942;
          </span>
          <span data-testid="module-title">{module.label}</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="module-remove"
          onClick={() => onRemove(module.id)}
          aria-label={`Remove ${module.label}`}
        >
          &#10005;
        </Button>
      </CardHeader>
      <CardContent className="module-body">
        <ModuleContent module={module} marketData={marketData} />
      </CardContent>
    </Card>
  );
}
