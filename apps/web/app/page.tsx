import type {
  BffHealthResponse,
  BffPlaceholderResponse,
  BffPublicPath,
} from '@dexera/api-types/openapi';
import { BFF_PUBLIC_PATHS } from '@dexera/api-types/openapi';
import type { DexeraHealthStatus } from '@dexera/shared-types';
import { ArrowRight, Network, Orbit, ShieldCheck, Sparkles, Waypoints } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletShell } from './_components/wallet-shell';

const sampleHealth: BffHealthResponse = {
  status: 'ok',
  service: 'dexera-bff',
  timestamp: new Date().toISOString(),
};

const samplePlaceholder: BffPlaceholderResponse = {
  message: 'Bootstrap endpoint ready',
  source: 'bff-go',
};

const status: DexeraHealthStatus = {
  status: sampleHealth.status,
  service: sampleHealth.service,
  timestamp: sampleHealth.timestamp,
};

const exposedPaths: readonly BffPublicPath[] = BFF_PUBLIC_PATHS;

const capabilityCards = [
  {
    title: 'Non-custodial wallet edge',
    copy: 'Dexera exposes connector, account, and chain context without requesting signatures or holding funds.',
    icon: ShieldCheck,
  },
  {
    title: 'Shared contract surface',
    copy: 'Generated OpenAPI and protobuf types keep the frontend, BFF, and downstream services pinned to the same interface.',
    icon: Network,
  },
  {
    title: 'Execution-ready staging',
    copy: 'HyperEVM targeting, public routes, and live readiness cues stay visible before any trading logic is enabled.',
    icon: Waypoints,
  },
] as const;

const heroSignals = [
  {
    label: 'BFF status',
    value: status.status.toUpperCase(),
    detail: 'Server-side render heartbeat',
  },
  {
    label: 'Target chain',
    value: 'HyperEVM',
    detail: 'Execution alignment preset',
  },
  {
    label: 'Public routes',
    value: String(exposedPaths.length).padStart(2, '0'),
    detail: 'Typed surfaces exposed now',
  },
] as const;

const formattedTimestamp = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
}).format(new Date(status.timestamp));

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[32rem] bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
      <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
        <header className="flex flex-col gap-5 border-b border-border/60 pb-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_16px_36px_-24px_rgba(12,176,198,0.95)]">
                <Orbit className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  Dexera
                </p>
                <p className="text-sm text-muted-foreground">
                  Wallet-ready execution infrastructure
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Badge variant="success">Non-custodial</Badge>
            <Badge variant="outline">App Router</Badge>
            <Badge variant="warm">HyperEVM aware</Badge>
          </div>
        </header>

        <section className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 p-7 shadow-panel backdrop-blur-xl sm:p-10">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
            <div className="absolute -right-20 top-10 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />

            <Badge
              variant="outline"
              className="w-fit gap-2 border-primary/25 bg-primary/10 text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Front page redesign
            </Badge>

            <div className="mt-7 space-y-6">
              <h1 className="max-w-4xl text-balance text-5xl leading-[0.95] sm:text-6xl lg:text-[4.65rem]">
                A sharper operating surface for Dexera&apos;s non-custodial entry point.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                The front page now frames wallet access, shared contracts, and execution readiness
                as a single controlled surface instead of a bootstrap dashboard.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a href="#wallet-shell" className={buttonVariants({ size: 'lg' })}>
                Connect wallet
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#system-readiness"
                className={buttonVariants({
                  size: 'lg',
                  variant: 'outline',
                })}
              >
                Inspect system readiness
              </a>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {heroSignals.map((signal) => (
                <Card
                  key={signal.label}
                  className="border-border/60 bg-background/60 shadow-none backdrop-blur-sm"
                >
                  <CardHeader className="space-y-3 p-5">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      {signal.label}
                    </p>
                    <CardTitle className="text-2xl">{signal.value}</CardTitle>
                    <CardDescription>{signal.detail}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            <Card className="surface-veil overflow-hidden border-border/70 backdrop-blur-xl">
              <CardHeader className="gap-4">
                <Badge variant="secondary" className="w-fit">
                  Product posture
                </Badge>
                <CardTitle className="text-3xl sm:text-4xl">
                  Contracts, connectors, and chain targeting stay visible above the fold.
                </CardTitle>
                <CardDescription className="max-w-md text-base leading-7">
                  Dexera keeps the wallet boundary explicit while surfacing the type-safe backend
                  shape that the rest of the product will build on.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-border/60 bg-background/55 p-5">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Wallet session
                  </p>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    Connectors stay local, readable, and reversible.
                  </p>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/55 p-5">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Contract sync
                  </p>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    Shared types remain the source of truth across the stack.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="ml-auto w-full max-w-md border-primary/15 bg-background/75 shadow-aura backdrop-blur-xl">
              <CardHeader className="gap-3">
                <Badge
                  variant="outline"
                  className="w-fit border-primary/20 bg-primary/8 text-primary"
                >
                  Surface snapshot
                </Badge>
                <CardTitle className="text-2xl">
                  Execution features can stay staged without hiding the shape of the app.
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-3">
          {capabilityCards.map(({ title, copy, icon: Icon }) => (
            <Card
              key={title}
              className="relative overflow-hidden border-border/70 bg-card/70 backdrop-blur-xl"
            >
              <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent" />
              <CardHeader className="gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-7">{copy}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-14 grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <WalletShell />

          <aside
            id="system-readiness"
            className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 p-6 shadow-panel backdrop-blur-xl sm:p-8"
          >
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent" />

            <div className="relative space-y-8">
              <div className="space-y-4">
                <Badge variant="secondary">System readiness</Badge>
                <div className="space-y-3">
                  <h2 className="text-3xl sm:text-4xl">
                    The frontend is already wired to live contracts.
                  </h2>
                  <p className="text-base leading-7 text-muted-foreground">
                    The homepage keeps the current bootstrap signals visible, but frames them as
                    platform proof instead of a raw status dashboard.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="border-border/60 bg-background/60 shadow-none">
                  <CardHeader className="space-y-3 p-5">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Service status
                    </p>
                    <CardTitle className="text-2xl">{status.status}</CardTitle>
                    <CardDescription>Latest BFF heartbeat captured during render.</CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-border/60 bg-background/60 shadow-none">
                  <CardHeader className="space-y-3 p-5">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Source
                    </p>
                    <CardTitle className="text-2xl">{samplePlaceholder.source}</CardTitle>
                    <CardDescription>
                      Current backend stub serving the placeholder route.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-border/60 bg-background/60 shadow-none">
                  <CardHeader className="space-y-3 p-5">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Placeholder
                    </p>
                    <CardTitle className="text-lg leading-7">{samplePlaceholder.message}</CardTitle>
                    <CardDescription>
                      Shared API contracts are already consumed in the UI layer.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-border/60 bg-background/60 shadow-none">
                  <CardHeader className="space-y-3 p-5">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Rendered at
                    </p>
                    <CardTitle className="text-lg leading-7">
                      <time dateTime={status.timestamp}>{formattedTimestamp}</time>
                    </CardTitle>
                    <CardDescription>UTC reference time for contract validation.</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              <div className="rounded-[1.5rem] border border-border/70 bg-background/55 p-5">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Exposed public paths
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {exposedPaths.map((path) => (
                    <Badge key={path} variant="outline" className="text-[0.72rem]">
                      {path}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
