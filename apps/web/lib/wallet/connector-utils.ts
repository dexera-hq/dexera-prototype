const PREFERRED_CONNECTOR_IDS = [
  'metaMaskInjected',
  'coinbaseInjected',
  'rabbyInjected',
  'injected',
] as const;

type ProviderDetectingConnector = {
  id: string;
  getProvider: () => Promise<unknown>;
};

function getConnectorPriority(connectorId: string): number {
  const preferredIndex = PREFERRED_CONNECTOR_IDS.indexOf(
    connectorId as (typeof PREFERRED_CONNECTOR_IDS)[number],
  );

  return preferredIndex === -1 ? PREFERRED_CONNECTOR_IDS.length : preferredIndex;
}

export function sortConnectorsForConnection<T extends { id: string }>(
  connectors: readonly T[],
): T[] {
  return connectors
    .map((connector, index) => ({
      connector,
      index,
      priority: getConnectorPriority(connector.id),
    }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map((entry) => entry.connector);
}

export async function findFirstAvailableConnector<T extends ProviderDetectingConnector>(
  connectors: readonly T[],
): Promise<T | null> {
  for (const connector of sortConnectorsForConnection(connectors)) {
    try {
      const provider = await connector.getProvider();

      if (provider) {
        return connector;
      }
    } catch {
      continue;
    }
  }

  return null;
}
