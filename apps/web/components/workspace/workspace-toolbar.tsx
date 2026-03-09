import { BarChart3, LayoutDashboard, RotateCcw, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type WorkspaceToolbarProps = {
  moduleCount: number;
  onAddModule: () => void;
  onResetLayout: () => void;
};

export function WorkspaceToolbar({
  moduleCount,
  onAddModule,
  onResetLayout,
}: WorkspaceToolbarProps) {
  return (
    <Card className="overflow-hidden bg-card/80">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <LayoutDashboard className="size-3.5" />
                Workspace Canvas
              </Badge>
              <Badge variant="outline" className="gap-1.5 border-border/70 bg-background/40">
                {moduleCount} active blocks
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Drag blocks to reorder the canvas. Dropping on empty space moves a block to the end
                of the layout.
              </p>
              <p className="text-sm text-muted-foreground">
                Order entry, wallet operations, fills, and live market views all stay available in
                the same dashboard.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={onAddModule}>
              <Sparkles className="size-4" />
              Add Module
            </Button>
            <Button type="button" variant="secondary" onClick={onResetLayout}>
              <RotateCcw className="size-4" />
              Reset Layout
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-background/40 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
            <p className="mt-2 text-sm text-foreground">Persistent layout with modular cards.</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Execution</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <BarChart3 className="size-4 text-muted-foreground" />
              Preview and submit venue actions from the same ticket.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Wallets</p>
            <p className="mt-2 text-sm text-foreground">
              Multi-slot wallet sessions stay available while you switch venues.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
