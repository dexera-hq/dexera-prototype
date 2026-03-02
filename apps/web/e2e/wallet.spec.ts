import { expect, test, type Page } from '@playwright/test';

type HexChainId = `0x${string}`;
type WalletListener = (payload: unknown) => void;
type MockWalletController = { emit: (event: string, payload: unknown) => void };
type MockWalletRequest = { method: string; params?: unknown[] };
type MockWalletWindow = Window & {
  ethereum?: {
    request: (request: MockWalletRequest) => Promise<null | string | string[]>;
    on: (event: string, listener: WalletListener) => void;
    removeListener: (event: string, listener: WalletListener) => void;
  };
  __mockWallet?: MockWalletController;
};

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
      const listeners = new Map<string, Set<WalletListener>>();
      let currentAccounts = [...initialAccounts];
      let currentChainId = chainId;
      const hasHexChainIdShape = (value: unknown): value is HexChainId =>
        typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value);

      const emit = (event: string, payload: unknown) => {
        for (const listener of listeners.get(event) ?? []) {
          listener(payload);
        }
      };

      const provider = {
        request: async ({ method, params }: MockWalletRequest) => {
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

          if (method === 'wallet_switchEthereumChain') {
            const [nextChain] = params ?? [];
            const requestedChainId =
              nextChain && typeof nextChain === 'object' && 'chainId' in nextChain
                ? (nextChain as { chainId?: unknown }).chainId
                : null;

            if (hasHexChainIdShape(requestedChainId)) {
              currentChainId = requestedChainId;
              emit('chainChanged', currentChainId);
            }

            return null;
          }

          if (method === 'wallet_addEthereumChain') {
            return null;
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

          if (event === 'chainChanged' && hasHexChainIdShape(payload)) {
            currentChainId = payload;
          }

          emit(event, payload);
        },
      };
    },
    { initialAccounts, requestableAccounts, chainId },
  );
}

test('shows the unsupported state without an injected wallet', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByText('Install an injected wallet or configure WalletConnect to connect from Dexera.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Injected Wallet' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'WalletConnect Unavailable' })).toBeDisabled();
});

test('connects through the injected connector and can switch to HyperEVM', async ({ page }) => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';

  await injectMockWallet(page, {
    initialAccounts: [],
    requestableAccounts: [address],
    chainId: '0x1',
  });

  await page.goto('/');

  await expect(
    page.getByText(
      'Connect with an injected wallet or WalletConnect to expose account and chain context.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Connect Injected Wallet' }).click();

  await expect(page.getByText('0x1234...5678')).toBeVisible();
  await expect(page.getByText('Ethereum Mainnet (0x1 / 1)')).toBeVisible();
  await expect(
    page.getByText('Select HyperEVM before Hyperliquid trading goes live.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to HyperEVM' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to HyperEVM' }).click();

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
  await expect(page.getByRole('button', { name: 'Connect Injected Wallet' })).toBeVisible();
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

  await expect(page.getByRole('button', { name: 'Connect Injected Wallet' })).toBeVisible();
  await expect(page.getByText('Not connected')).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: 'Connect Injected Wallet' })).toBeVisible();
  await expect(page.getByText('Not connected')).toBeVisible();
});
