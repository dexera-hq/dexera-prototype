import type { CSSProperties, DragEvent, PointerEvent } from 'react';
import { GripVertical, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { WorkspaceInsertionPlacement } from '@/components/workspace/logic';
import { ModuleContent } from '@/components/workspace/module-content';
import type { WorkspaceMarketDataState } from '@/components/workspace/use-workspace-market-data';
import type { WorkspaceModule } from '@/components/workspace/types';
import { cn } from '@/lib/utils';

type ResizeDirection = 'east' | 'south' | 'southeast';

const MD_COLUMN_START_CLASSES = [
  '',
  'md:col-start-1',
  'md:col-start-2',
  'md:col-start-3',
  'md:col-start-4',
  'md:col-start-5',
  'md:col-start-6',
  'md:col-start-7',
  'md:col-start-8',
  'md:col-start-9',
  'md:col-start-10',
  'md:col-start-11',
  'md:col-start-12',
] as const;

const MD_COLUMN_SPAN_CLASSES = [
  '',
  'md:col-span-1',
  'md:col-span-2',
  'md:col-span-3',
  'md:col-span-4',
  'md:col-span-5',
  'md:col-span-6',
  'md:col-span-7',
  'md:col-span-8',
  'md:col-span-9',
  'md:col-span-10',
  'md:col-span-11',
  'md:col-span-12',
] as const;

type WorkspaceModuleCardProps = {
  module: WorkspaceModule;
  columnStart: number;
  columnSpan: number;
  marketData: WorkspaceMarketDataState;
  draggingId: number | null;
  dropTarget: { id: number; placement: WorkspaceInsertionPlacement } | null;
  isResizing: boolean;
  onRemove: (id: number) => void;
  onDragStart: (id: number, event: DragEvent<HTMLElement>) => void;
  onPointerDownOnModule: (id: number, event: PointerEvent<HTMLElement>) => void;
  onPointerEnterModule: (id: number, placement: WorkspaceInsertionPlacement) => void;
  onPointerUpOnModule: (id: number, placement: WorkspaceInsertionPlacement) => void;
  onDragOverModule: (
    id: number,
    placement: WorkspaceInsertionPlacement,
    event: DragEvent<HTMLElement>,
  ) => void;
  onDropOnModule: (
    id: number,
    placement: WorkspaceInsertionPlacement,
    event: DragEvent<HTMLElement>,
  ) => void;
  onResizeStart: (id: number, direction: ResizeDirection, event: PointerEvent<HTMLElement>) => void;
  onDragEnd: () => void;
};

export function WorkspaceModuleCard({
  module,
  columnStart,
  columnSpan,
  marketData,
  draggingId,
  dropTarget,
  isResizing,
  onRemove,
  onDragStart,
  onPointerDownOnModule,
  onPointerEnterModule,
  onPointerUpOnModule,
  onDragOverModule,
  onDropOnModule,
  onResizeStart,
  onDragEnd,
}: WorkspaceModuleCardProps) {
  const isDraggingAnotherModule = draggingId !== null && draggingId !== module.id;
  const isLeftDropTarget = dropTarget?.id === module.id && dropTarget.placement === 'before';
  const isRightDropTarget = dropTarget?.id === module.id && dropTarget.placement === 'after';
  const moduleStyle = {
    minHeight: `${module.layout.minHeight}px`,
  } as CSSProperties;
  const columnStartClass = MD_COLUMN_START_CLASSES[columnStart] ?? 'md:col-start-1';
  const columnSpanClass = MD_COLUMN_SPAN_CLASSES[columnSpan] ?? 'md:col-span-12';
  const resolvePlacement = (
    event: DragEvent<HTMLElement> | PointerEvent<HTMLElement>,
  ): WorkspaceInsertionPlacement => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after';
  };

  return (
    <Card
      data-testid="module-card"
      className={cn(
        'relative col-span-1 flex flex-col overflow-hidden border-border/80 bg-card/90 transition-all duration-150',
        columnStartClass,
        columnSpanClass,
        draggingId === module.id && 'scale-[0.99] opacity-55',
        dropTarget?.id === module.id && 'border-primary/60 ring-1 ring-primary/40',
        isResizing && 'border-primary/70 shadow-[0_0_0_1px_rgba(244,114,182,0.25)]',
      )}
      style={moduleStyle}
      draggable={!isDraggingAnotherModule}
      onDragStart={(event) => onDragStart(module.id, event)}
      onPointerDown={(event) => onPointerDownOnModule(module.id, event)}
      onPointerEnter={(event) => {
        if (!isDraggingAnotherModule) {
          return;
        }
        onPointerEnterModule(module.id, resolvePlacement(event));
      }}
      onPointerMove={(event) => {
        if (!isDraggingAnotherModule) {
          return;
        }
        onPointerEnterModule(module.id, resolvePlacement(event));
      }}
      onPointerUp={(event) => {
        if (!isDraggingAnotherModule) {
          return;
        }
        onPointerUpOnModule(module.id, resolvePlacement(event));
      }}
      onDragOver={(event) => {
        if (!isDraggingAnotherModule) {
          return;
        }
        onDragOverModule(module.id, resolvePlacement(event), event);
      }}
      onDrop={(event) => {
        if (!isDraggingAnotherModule) {
          return;
        }
        onDropOnModule(module.id, resolvePlacement(event), event);
      }}
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

      {isDraggingAnotherModule ? (
        <div className="pointer-events-none absolute inset-0 z-10 hidden md:grid md:grid-cols-2">
          <span
            className={cn(
              'border-r border-transparent bg-transparent transition-colors',
              isLeftDropTarget && 'border-primary/60 bg-primary/10',
            )}
          />
          <span
            className={cn(
              'border-l border-transparent bg-transparent transition-colors',
              isRightDropTarget && 'border-primary/60 bg-primary/10',
            )}
          />
        </div>
      ) : null}

      <span
        data-resize-handle="true"
        className="absolute bottom-0 right-0 top-14 hidden w-3 cursor-ew-resize md:block"
        onPointerDown={(event) => onResizeStart(module.id, 'east', event)}
      />
      <span
        data-resize-handle="true"
        className="absolute bottom-0 left-0 right-0 hidden h-3 cursor-ns-resize md:block"
        onPointerDown={(event) => onResizeStart(module.id, 'south', event)}
      />
      <span
        data-resize-handle="true"
        className="absolute bottom-0 right-0 hidden size-4 cursor-nwse-resize rounded-tl-sm border-l border-t border-border/60 bg-background/80 md:block"
        onPointerDown={(event) => onResizeStart(module.id, 'southeast', event)}
      />
    </Card>
  );
}
