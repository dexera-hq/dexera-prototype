import type { WalletConnectorId } from './types';

export const INJECTED_CONNECTOR_ID: WalletConnectorId = 'injected';
export const WALLETCONNECT_CONNECTOR_ID: WalletConnectorId = 'walletConnect';

export function normalizeWalletConnectProjectId(
  projectId: string | null | undefined,
): string | null {
  const normalized = projectId?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export const WALLETCONNECT_PROJECT_ID = normalizeWalletConnectProjectId(
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
);

export const isWalletConnectConfigured = WALLETCONNECT_PROJECT_ID !== null;
