import type {
  BffHealthResponse,
  BffPlaceholderResponse,
  BffPublicPath,
} from '@dexera/api-types/openapi';
import { BFF_PUBLIC_PATHS } from '@dexera/api-types/openapi';
import type { DexeraHealthStatus } from '@dexera/shared-types';

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
      <section className="panel">
        <h1>Dexera workspace bootstrap</h1>
        <p className="subtitle">
          Next.js frontend is connected to generated contract types from OpenAPI and protobuf sources.
        </p>
        <dl>
          <dt>Status</dt>
          <dd>{status.status}</dd>
          <dt>Service</dt>
          <dd>{status.service}</dd>
          <dt>Placeholder</dt>
          <dd>{samplePlaceholder.message}</dd>
          <dt>Paths</dt>
          <dd>{exposedPaths.join(', ')}</dd>
        </dl>
      </section>
    </main>
  );
}
