import type {
  BffHealthResponse,
  BffPlaceholderResponse,
  BffPublicPath,
} from '@dexera/api-types/openapi';
import { BFF_PUBLIC_PATHS } from '@dexera/api-types/openapi';
import type { DexeraHealthStatus } from '@dexera/shared-types';
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

export default function HomePage() {
  return (
    <main className="page">
      <div className="scene">
        <WalletShell />

        <section className="panel stack-panel">
          <p className="panel-kicker">Workspace Snapshot</p>
          <h2>Contracts are wired into the frontend.</h2>
          <p className="panel-intro">
            The web surface is already consuming generated OpenAPI and protobuf types. Wallet
            plumbing now sits on top of that baseline without introducing any execution logic yet.
          </p>

          <div className="contract-grid">
            <article className="data-tile">
              <span className="tile-label">Status</span>
              <strong className="tile-value">{status.status}</strong>
              <p className="tile-copy">Latest BFF heartbeat captured during render.</p>
            </article>

            <article className="data-tile">
              <span className="tile-label">Service</span>
              <strong className="tile-value">{status.service}</strong>
              <p className="tile-copy">Shared contracts remain the source of truth.</p>
            </article>

            <article className="data-tile">
              <span className="tile-label">Placeholder</span>
              <strong className="tile-value">{samplePlaceholder.message}</strong>
              <p className="tile-copy">Current backend stub: {samplePlaceholder.source}.</p>
            </article>

            <article className="data-tile">
              <span className="tile-label">Timestamp</span>
              <strong className="tile-value">
                <time dateTime={status.timestamp}>{status.timestamp}</time>
              </strong>
              <p className="tile-copy">Server-rendered reference time for the UI contract check.</p>
            </article>
          </div>

          <div className="path-strip" aria-label="Public API paths">
            {exposedPaths.map((path) => (
              <span key={path} className="path-chip">
                {path}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
