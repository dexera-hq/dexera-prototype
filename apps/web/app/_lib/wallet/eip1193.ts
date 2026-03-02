import type { Eip1193Provider, HexChainId, ProviderEvent, WalletEventHandler } from './types';

type BrowserWindow = Window &
  typeof globalThis & {
    ethereum?: Eip1193Provider;
  };

function isEip1193Provider(candidate: unknown): candidate is Eip1193Provider {
  return Boolean(
    candidate &&
      typeof candidate === 'object' &&
      'request' in candidate &&
      typeof (candidate as { request?: unknown }).request === 'function',
  );
}

function toAccountList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function isHexChainId(value: unknown): value is HexChainId {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value);
}

export function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const { ethereum } = window as BrowserWindow;
  return isEip1193Provider(ethereum) ? ethereum : null;
}

export async function getAuthorizedAccounts(provider: Eip1193Provider): Promise<string[]> {
  const response = await provider.request({ method: 'eth_accounts' });
  return toAccountList(response);
}

export async function requestAccounts(provider: Eip1193Provider): Promise<string[]> {
  const response = await provider.request({ method: 'eth_requestAccounts' });
  return toAccountList(response);
}

export async function getChainId(provider: Eip1193Provider): Promise<HexChainId> {
  const response = await provider.request({ method: 'eth_chainId' });

  if (!isHexChainId(response)) {
    throw new Error('Wallet returned an invalid chain id.');
  }

  return response;
}

export function parseAccountsEvent(value: unknown): string[] {
  return toAccountList(value);
}

export function parseChainIdEvent(value: unknown): HexChainId {
  if (!isHexChainId(value)) {
    throw new Error('Wallet returned an invalid chain update.');
  }

  return value;
}

export function subscribeToProviderEvent(
  provider: Eip1193Provider,
  event: ProviderEvent,
  listener: WalletEventHandler,
): () => void {
  if (typeof provider.on !== 'function') {
    return () => {};
  }

  provider.on(event, listener);

  return () => {
    if (typeof provider.removeListener === 'function') {
      provider.removeListener(event, listener);
    }
  };
}

export function normalizeProviderError(
  error: unknown,
  fallbackMessage = 'Wallet request failed.',
): string {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === 'object') {
    const providerError = error as { code?: unknown; message?: unknown };

    if (providerError.code === 4001) {
      return 'Connection request was rejected in the wallet.';
    }

    if (typeof providerError.message === 'string' && providerError.message.trim().length > 0) {
      return providerError.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}
