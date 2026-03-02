import { expect, test, type Page } from '@playwright/test';

type HexChainId = `0x${string}`;
type MockWalletController = { emit: (event: string, payload: unknown) => void };
type MockWalletWindow = Window & {
  ethereum?: {
    request: ({ method }: { method: string }) => Promise<string | string[]>;
    on: (event: string, listener: (payload: unknown) => void) => void;
    removeListener: (event: string, listener: (payload: unknown) => void) => void;
  };
  __mockWallet?: MockWalletController;
};

function isHexChainId(value: unknown): value is HexChainId {
  return typeof value === 'string' && value.startsWith('0x');
}

async function injectMockWallet(
  page: Page,
  {
    initialAccounts = [],
    requestableAccounts = [],
    chainId = '0x1',
  }: {
    initialAccounts?: string[];
    requestableAccounts?: string[];
    chainId?: HexChainId;
  } = {},
) {
  await page.addInitScript(
    ({ initialAccounts, requestableAccounts, chainId }) => {
      type WalletListener = (payload: unknown) => void;

      const listeners = new Map<string, Set<WalletListener>>();
      let currentAccounts = [...initialAccounts];
      let currentChainId = chainId;

      const provider = {
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_accounts') {
            return [...currentAccounts];
          }

          if (method === 'eth_requestAccounts') {
            currentAccounts = [...requestableAccounts];
            return [...currentAccounts];
          }

          if (method === 'eth_chainId') {
            return currentChainId;
          }

          throw new Error(`Unsupported method: ${method}`);
        },
        on: (event: string, listener: WalletListener) => {
          const bucket = listeners.get(event) ?? new Set<WalletListener>();
          bucket.add(listener);
          listeners.set(event, bucket);
        },
        removeListener: (event: string, listener: WalletListener) => {
          listeners.get(event)?.delete(listener);
        },
      };

      (window as MockWalletWindow).ethereum = provider;

      (window as MockWalletWindow).__mockWallet = {
        emit: (event: string, payload: unknown) => {
          if (event === 'accountsChanged' && Array.isArray(payload)) {
            currentAccounts = payload.filter((entry): entry is string => typeof entry === 'string');
          }

          if (event === 'chainChanged' && isHexChainId(payload)) {
            currentChainId = payload;
          }

          for (const listener of listeners.get(event) ?? []) {
            listener(payload);
          }
        },
      };
    },
    { initialAccounts, requestableAccounts, chainId },
  );
}

test('shows the unsupported state without an injected wallet', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('No injected wallet detected.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeDisabled();
});

test('connects and reacts to provider account and chain events', async ({ page }) => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';

  await injectMockWallet(page, {
    initialAccounts: [],
    requestableAccounts: [address],
    chainId: '0x1',
  });

  await page.goto('/');

  await expect(page.getByText('Wallet available. Connect to expose account and chain context.')).toBeVisible();
  await expect(page.getByText('Ethereum Mainnet (0x1 / 1)')).toBeVisible();

  await page.getByRole('button', { name: 'Connect Wallet' }).click();

  await expect(page.getByText('0x1234...5678')).toBeVisible();
  await expect(page.getByText('Select HyperEVM before Hyperliquid trading goes live.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();

  await page.evaluate(() => {
    const mockWallet = (window as MockWalletWindow).__mockWallet;

    if (!mockWallet) {
      throw new Error('Mock wallet was not injected.');
    }

    mockWallet.emit('chainChanged', '0x3e7');
  });

  await expect(page.getByText('HyperEVM (0x3e7 / 999)')).toBeVisible();
  await expect(page.getByText('Aligned with the Hyperliquid execution target.')).toBeVisible();

  await page.evaluate(() => {
    const mockWallet = (window as MockWalletWindow).__mockWallet;

    if (!mockWallet) {
      throw new Error('Mock wallet was not injected.');
    }

    mockWallet.emit('accountsChanged', []);
  });

  await expect(page.getByText('Not connected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
});

test('keeps Dexera disconnected after an app-level disconnect until connect is clicked again', async ({
  page,
}) => {
  const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

  await injectMockWallet(page, {
    initialAccounts: [address],
    requestableAccounts: [address],
    chainId: '0x3e7',
  });

  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect' }).click();

  await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
  await expect(page.getByText('Not connected')).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
  await expect(page.getByText('Not connected')).toBeVisible();
});
