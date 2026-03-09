import { LayoutTemplate, PanelsTopLeft } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WalletConnectButton } from '@/components/workspace/wallet-connect-button';

export function TerminalHeader() {
  return (
    <Card className="overflow-hidden border-border/80 bg-background/75 backdrop-blur">
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-border/70 bg-card/90 p-3 text-foreground shadow-sm">
              <PanelsTopLeft className="size-5" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight" data-testid="app-brand">
                  Dexera
                </h1>
                <Badge variant="outline" className="border-border/70 bg-background/50">
                  Beta
                </Badge>
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Neutral-dark execution workspace for venue-connected trading, modular signal blocks,
                and wallet-controlled order flows.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline">
              <LayoutTemplate className="size-4" />
              Customize
            </Button>
            <WalletConnectButton />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
