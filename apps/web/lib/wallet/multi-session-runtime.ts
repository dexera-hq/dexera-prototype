import type { UnsignedActionPayload } from '@dexera/shared-types';

import { WALLET_CONNECTOR_IDS, type ConnectWalletReason, type WalletConnectorId } from './types';

export type RuntimeAccountSnapshot = {
  isConnected: boolean;
  accountId?: string;
  connectorId?: WalletConnectorId;
  connectorLabel?: string;
};

export type RuntimeConnectResult = {
  connected: boolean;
  reason: ConnectWalletReason;
  account?: RuntimeAccountSnapshot;
};

type ProviderRequestParameters = {
  method: string;
  params?: readonly unknown[];
};

type ProviderEventHandler = (...args: unknown[]) => void;

type BrowserWalletProvider = {
  request: (parameters: ProviderRequestParameters) => Promise<unknown>;
  on?: (eventName: string, listener: ProviderEventHandler) => void;
  addListener?: (eventName: string, listener: ProviderEventHandler) => void;
  removeListener?: (eventName: string, listener: ProviderEventHandler) => void;
  off?: (eventName: string, listener: ProviderEventHandler) => void;
};

type BrowserWalletProviderContainer = {
  ethereum?: unknown;
  providers?: unknown;
};

type BrowserWalletWindow = Window & {
  ethereum?: unknown;
};

type SlotRuntime = {
  account: RuntimeAccountSnapshot;
  provider: BrowserWalletProvider | null;
  listeners: Set<(account: RuntimeAccountSnapshot) => void>;
};

const slotRuntimeById = new Map<string, SlotRuntime>();

const CONNECTOR_LABELS: Record<WalletConnectorId, string> = {
  metaMaskInjected: 'MetaMask',
  coinbaseInjected: 'Coinbase Wallet',
  rabbyInjected: 'Rabby',
  injected: 'Injected Wallet',
};

type RequestError = {
  code?: number;
  message?: string;
};

export function isWalletConnectEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_WALLET_RUNTIME_ENABLED?.trim().toLowerCase();
  if (!value) {
    return true;
  }
  return value !== 'false' && value !== '0' && value !== 'no';
}

function getOrCreateSlotRuntime(slotId: string): SlotRuntime {
  const existingRuntime = slotRuntimeById.get(slotId);
  if (existingRuntime) {
    return existingRuntime;
  }

  const createdRuntime: SlotRuntime = {
    account: { isConnected: false },
    provider: null,
    listeners: new Set(),
  };
  slotRuntimeById.set(slotId, createdRuntime);

  return createdRuntime;
}

function coerceConnectorId(connectorId: string | undefined): WalletConnectorId | undefined {
  if (!connectorId) {
    return undefined;
  }

  return WALLET_CONNECTOR_IDS.includes(connectorId as WalletConnectorId)
    ? (connectorId as WalletConnectorId)
    : undefined;
}

function notifyAccountChange(slotRuntime: SlotRuntime): void {
  for (const listener of slotRuntime.listeners) {
    listener(slotRuntime.account);
  }
}

function sameRuntimeAccount(left: RuntimeAccountSnapshot, right: RuntimeAccountSnapshot): boolean {
  return (
    left.isConnected === right.isConnected &&
    left.accountId === right.accountId &&
    left.connectorId === right.connectorId &&
    left.connectorLabel === right.connectorLabel
  );
}

function setRuntimeAccount(slotRuntime: SlotRuntime, nextAccount: RuntimeAccountSnapshot): void {
  if (sameRuntimeAccount(slotRuntime.account, nextAccount)) {
    return;
  }

  slotRuntime.account = nextAccount;
  notifyAccountChange(slotRuntime);
}

function isMethodUnsupported(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const requestError = error as RequestError;
  if (requestError.code === 4200 || requestError.code === -32601) {
    return true;
  }

  const message = requestError.message?.toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes('unsupported') ||
    message.includes('not supported') ||
    message.includes('method not found')
  );
}

function coerceWalletProvider(candidate: unknown): BrowserWalletProvider | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  if (!('request' in candidate) || typeof candidate.request !== 'function') {
    return null;
  }

  return candidate as BrowserWalletProvider;
}

function getWalletWindow(): BrowserWalletWindow | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window as BrowserWalletWindow;
}

function coerceProviderContainer(candidate: unknown): BrowserWalletProviderContainer | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  return candidate as BrowserWalletProviderContainer;
}

function coerceProviderList(candidate: unknown): BrowserWalletProvider[] {
  if (!Array.isArray(candidate)) {
    return [];
  }

  const providers: BrowserWalletProvider[] = [];
  for (const item of candidate) {
    const provider = coerceWalletProvider(item);
    if (provider) {
      providers.push(provider);
    }
  }

  return providers;
}

function pushProviderIfMissing(
  target: BrowserWalletProvider[],
  provider: BrowserWalletProvider | null,
): void {
  if (!provider) {
    return;
  }

  if (!target.includes(provider)) {
    target.push(provider);
  }
}

function inferProviderTextHints(provider: BrowserWalletProvider): string[] {
  const providerRecord = provider as unknown as Record<string, unknown>;
  const hints: string[] = [];

  for (const field of ['name', 'id', 'rdns'] as const) {
    const value = providerRecord[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      hints.push(value.trim().toLowerCase());
    }
  }

  const providerInfo = providerRecord.providerInfo;
  if (providerInfo && typeof providerInfo === 'object') {
    const providerInfoRecord = providerInfo as Record<string, unknown>;
    for (const field of ['name', 'id', 'rdns'] as const) {
      const value = providerInfoRecord[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        hints.push(value.trim().toLowerCase());
      }
    }
  }

  return hints;
}

function providerHasMarker(provider: BrowserWalletProvider, markers: readonly string[]): boolean {
  const providerRecord = provider as unknown as Record<string, unknown>;
  for (const marker of markers) {
    const rawValue = providerRecord[marker];
    if (rawValue === true || rawValue === 'true') {
      return true;
    }
  }

  const hints = inferProviderTextHints(provider);
  return hints.some((hint) => markers.some((marker) => hint.includes(marker.toLowerCase())));
}

function isMetaMaskProvider(provider: BrowserWalletProvider): boolean {
  if (!providerHasMarker(provider, ['isMetaMask', 'metamask'])) {
    return false;
  }

  return !providerHasMarker(provider, ['isBraveWallet', 'brave']);
}

function isCoinbaseProvider(provider: BrowserWalletProvider): boolean {
  return providerHasMarker(provider, ['isCoinbaseWallet', 'coinbase']);
}

function isRabbyProvider(provider: BrowserWalletProvider): boolean {
  return providerHasMarker(provider, ['isRabby', 'rabby']);
}

function isKnownNamedProvider(provider: BrowserWalletProvider): boolean {
  return isMetaMaskProvider(provider) || isCoinbaseProvider(provider) || isRabbyProvider(provider);
}

function collectInjectedProviders(walletWindow: BrowserWalletWindow): BrowserWalletProvider[] {
  const providers: BrowserWalletProvider[] = [];
  const ethereumRoot = walletWindow.ethereum;
  const rootProvider = coerceWalletProvider(ethereumRoot);
  pushProviderIfMissing(providers, rootProvider);

  const rootContainer = coerceProviderContainer(ethereumRoot);
  if (!rootContainer) {
    return providers;
  }

  pushProviderIfMissing(providers, coerceWalletProvider(rootContainer.ethereum));
  for (const provider of coerceProviderList(rootContainer.providers)) {
    pushProviderIfMissing(providers, provider);
  }

  return providers;
}

function resolveConnectorProvider(connectorId: WalletConnectorId): BrowserWalletProvider | null {
  const walletWindow = getWalletWindow();
  if (!walletWindow) {
    return null;
  }

  const injectedProviders = collectInjectedProviders(walletWindow);
  if (injectedProviders.length === 0) {
    return null;
  }

  if (connectorId === 'metaMaskInjected') {
    return injectedProviders.find((provider) => isMetaMaskProvider(provider)) ?? null;
  }

  if (connectorId === 'coinbaseInjected') {
    return injectedProviders.find((provider) => isCoinbaseProvider(provider)) ?? null;
  }

  if (connectorId === 'rabbyInjected') {
    return injectedProviders.find((provider) => isRabbyProvider(provider)) ?? null;
  }

  return (
    injectedProviders.find((provider) => !isKnownNamedProvider(provider)) ??
    injectedProviders[0] ??
    null
  );
}

function normalizeWalletAccountId(candidate: unknown): string | null {
  if (typeof candidate !== 'string') {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith('0x') ? trimmed.toLowerCase() : trimmed;
}

function firstNormalizedAccountId(candidate: unknown): string | null {
  if (!Array.isArray(candidate)) {
    return null;
  }

  for (const accountCandidate of candidate) {
    const accountId = normalizeWalletAccountId(accountCandidate);
    if (accountId) {
      return accountId;
    }
  }

  return null;
}

async function requestAccountId(
  provider: BrowserWalletProvider,
  method: 'eth_accounts' | 'eth_requestAccounts',
): Promise<string | null> {
  const response = await provider.request({ method });

  if (!Array.isArray(response)) {
    return null;
  }

  for (const candidate of response) {
    const accountId = normalizeWalletAccountId(candidate);
    if (accountId) {
      return accountId;
    }
  }

  return null;
}

async function requestAccountPermissions(provider: BrowserWalletProvider): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return;
    }

    throw error;
  }
}

function addProviderEventListener(
  provider: BrowserWalletProvider,
  eventName: string,
  listener: ProviderEventHandler,
): () => void {
  const subscribe =
    typeof provider.on === 'function'
      ? provider.on.bind(provider)
      : typeof provider.addListener === 'function'
        ? provider.addListener.bind(provider)
        : null;
  const unsubscribe =
    typeof provider.removeListener === 'function'
      ? provider.removeListener.bind(provider)
      : typeof provider.off === 'function'
        ? provider.off.bind(provider)
        : null;

  if (!subscribe) {
    return () => {};
  }

  try {
    subscribe(eventName, listener);
  } catch {
    return () => {};
  }

  if (!unsubscribe) {
    return () => {};
  }

  return () => {
    try {
      unsubscribe(eventName, listener);
    } catch {
      // No-op: some providers expose partial listener APIs with asymmetric behavior.
    }
  };
}

async function syncRuntimeAccountFromProvider(
  slotRuntime: SlotRuntime,
  provider: BrowserWalletProvider,
): Promise<void> {
  try {
    const accountId = await requestAccountId(provider, 'eth_accounts');
    if (!accountId) {
      setRuntimeAccount(slotRuntime, { isConnected: false });
      return;
    }

    const connectorId = slotRuntime.account.connectorId;
    if (!connectorId) {
      setRuntimeAccount(slotRuntime, { isConnected: false });
      return;
    }

    setRuntimeAccount(slotRuntime, {
      isConnected: true,
      accountId,
      connectorId,
      connectorLabel: slotRuntime.account.connectorLabel ?? CONNECTOR_LABELS[connectorId],
    });
  } catch {
    setRuntimeAccount(slotRuntime, { isConnected: false });
  }
}

function watchProviderLifecycle(
  slotRuntime: SlotRuntime,
  provider: BrowserWalletProvider,
): () => void {
  const handleAccountsChanged: ProviderEventHandler = (accounts: unknown) => {
    if (slotRuntime.provider !== provider) {
      return;
    }

    const nextAccountId = firstNormalizedAccountId(accounts);
    if (!nextAccountId) {
      setRuntimeAccount(slotRuntime, { isConnected: false });
      return;
    }

    const connectorId = slotRuntime.account.connectorId;
    if (!connectorId) {
      setRuntimeAccount(slotRuntime, { isConnected: false });
      return;
    }

    setRuntimeAccount(slotRuntime, {
      isConnected: true,
      accountId: nextAccountId,
      connectorId,
      connectorLabel: slotRuntime.account.connectorLabel ?? CONNECTOR_LABELS[connectorId],
    });
  };
  const handleDisconnect: ProviderEventHandler = () => {
    if (slotRuntime.provider !== provider) {
      return;
    }

    setRuntimeAccount(slotRuntime, { isConnected: false });
  };
  const handleConnect: ProviderEventHandler = () => {
    if (slotRuntime.provider !== provider) {
      return;
    }

    void syncRuntimeAccountFromProvider(slotRuntime, provider);
  };

  const stopWatchingAccountsChanged = addProviderEventListener(
    provider,
    'accountsChanged',
    handleAccountsChanged,
  );
  const stopWatchingDisconnect = addProviderEventListener(provider, 'disconnect', handleDisconnect);
  const stopWatchingConnect = addProviderEventListener(provider, 'connect', handleConnect);

  return () => {
    stopWatchingAccountsChanged();
    stopWatchingDisconnect();
    stopWatchingConnect();
  };
}

async function connectWithReason(parameters: {
  slotId: string;
  connectorId: WalletConnectorId;
  connectedReason: 'connected' | 'reconnected';
  accountMethod: 'eth_accounts' | 'eth_requestAccounts';
}): Promise<RuntimeConnectResult> {
  const runtime = getOrCreateSlotRuntime(parameters.slotId);
  const connectorId = coerceConnectorId(parameters.connectorId);

  if (!connectorId) {
    return {
      connected: false,
      reason: 'connector-missing',
    };
  }

  const provider = resolveConnectorProvider(connectorId);
  if (!provider) {
    return {
      connected: false,
      reason: 'connector-missing',
    };
  }

  let accountId: string | null = null;
  try {
    if (parameters.accountMethod === 'eth_requestAccounts') {
      await requestAccountPermissions(provider);
    }

    accountId = await requestAccountId(provider, parameters.accountMethod);
  } catch {
    return {
      connected: false,
      reason: 'failed',
    };
  }

  if (!accountId) {
    return {
      connected: false,
      reason: 'failed',
    };
  }

  runtime.provider = provider;
  runtime.account = {
    isConnected: true,
    accountId,
    connectorId,
    connectorLabel: CONNECTOR_LABELS[connectorId],
  };
  notifyAccountChange(runtime);

  return {
    connected: true,
    reason: parameters.connectedReason,
    account: runtime.account,
  };
}

async function requestSignature(
  provider: BrowserWalletProvider,
  method: string,
  params: readonly unknown[],
): Promise<string | null> {
  const result = await provider.request({ method, params });
  if (typeof result !== 'string') {
    return null;
  }

  const trimmed = result.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeComparableAccountId(candidate: string): string {
  const trimmed = candidate.trim();
  return trimmed.startsWith('0x') ? trimmed.toLowerCase() : trimmed;
}

function readRequestedSignerAccount(params: readonly unknown[]): string | null {
  if (params.length === 0) {
    return null;
  }
  const candidate = params[0];
  if (typeof candidate !== 'string') {
    return null;
  }
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function ensureProviderAccountMatches(
  provider: BrowserWalletProvider,
  expectedAccountId: string,
): Promise<void> {
  const activeAccountId = await requestAccountId(provider, 'eth_accounts');
  if (!activeAccountId) {
    throw new Error('No active account is currently selected in wallet.');
  }

  if (
    normalizeComparableAccountId(activeAccountId) !==
    normalizeComparableAccountId(expectedAccountId)
  ) {
    throw new Error(
      `Wallet selected account ${activeAccountId} does not match expected account ${expectedAccountId}. Switch wallet account and retry.`,
    );
  }
}

function normalizeSignature(signature: string): string {
  const trimmed = signature.trim();
  if (!trimmed) {
    throw new Error('Wallet signature is empty.');
  }

  return trimmed;
}

function resolveHyperliquidSigningRpcURL(): string | null {
  const rawValue = process.env.NEXT_PUBLIC_HYPERLIQUID_SIGNING_CHAIN_RPC_URL;
  if (typeof rawValue !== 'string') {
    return null;
  }

  const trimmed = rawValue.trim();
  if (trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
    return null;
  }
  return trimmed.length > 0 ? trimmed : null;
}

function isHyperliquidTypedDataSigningMethod(method: string): boolean {
  return method.trim().toLowerCase() === 'eth_signtypeddata_v4';
}

function normalizeHexChainID(candidate: unknown): string | null {
  if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 0) {
    return `0x${candidate.toString(16)}`;
  }
  if (typeof candidate !== 'string') {
    return null;
  }

  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    return `0x${BigInt(trimmed).toString(16)}`;
  } catch {
    return null;
  }
}

function parseTypedDataDomainChainID(params: readonly unknown[]): string | null {
  if (params.length < 2) {
    return null;
  }

  const typedDataParam = params[1];
  if (!typedDataParam) {
    return null;
  }

  let typedDataRecord: Record<string, unknown> | null = null;
  if (typeof typedDataParam === 'string') {
    const trimmed = typedDataParam.trim();
    if (!trimmed) {
      return null;
    }
    try {
      typedDataRecord = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof typedDataParam === 'object') {
    typedDataRecord = typedDataParam as Record<string, unknown>;
  }

  if (!typedDataRecord) {
    return null;
  }
  const domain = typedDataRecord.domain;
  if (!domain || typeof domain !== 'object') {
    return null;
  }

  return normalizeHexChainID((domain as Record<string, unknown>).chainId);
}

async function requestProviderChainID(provider: BrowserWalletProvider): Promise<string | null> {
  try {
    const chainID = await provider.request({ method: 'eth_chainId' });
    return normalizeHexChainID(chainID);
  } catch {
    return null;
  }
}

function formatChainLabel(chainID: string): string {
  try {
    return `${BigInt(chainID).toString(10)} (${chainID})`;
  } catch {
    return chainID;
  }
}

function isChainMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const requestError = error as RequestError;
  if (requestError.code === 4902) {
    return true;
  }

  const message = requestError.message?.toLowerCase() ?? '';
  return message.includes('unrecognized chain') || message.includes('unknown chain');
}

async function ensureWalletOnSigningChain(
  provider: BrowserWalletProvider,
  method: string,
  params: readonly unknown[],
): Promise<void> {
  if (!isHyperliquidTypedDataSigningMethod(method)) {
    return;
  }

  const requiredChainID = parseTypedDataDomainChainID(params);
  if (!requiredChainID) {
    return;
  }

  const activeChainID = await requestProviderChainID(provider);
  if (!activeChainID || activeChainID === requiredChainID) {
    return;
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: requiredChainID }],
    });
    return;
  } catch (switchError) {
    if (!isChainMissingError(switchError)) {
      throw new Error(
        `Wallet is on chain ${formatChainLabel(activeChainID)}, but this signature requires ${formatChainLabel(requiredChainID)}. Switch network in wallet and retry.`,
      );
    }
  }

  const rpcURL = resolveHyperliquidSigningRpcURL();
  if (!rpcURL) {
    throw new Error(
      `Wallet does not have chain ${formatChainLabel(requiredChainID)} configured. Set NEXT_PUBLIC_HYPERLIQUID_SIGNING_CHAIN_RPC_URL and retry.`,
    );
  }

  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        chainId: requiredChainID,
        chainName: 'Anvil 1337',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: [rpcURL],
      },
    ],
  });

  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: requiredChainID }],
  });
}

export async function connectRuntimeSlot(
  slotId: string,
  connectorId: WalletConnectorId,
): Promise<RuntimeConnectResult> {
  return connectWithReason({
    slotId,
    connectorId,
    connectedReason: 'connected',
    accountMethod: 'eth_requestAccounts',
  });
}

export async function reconnectRuntimeSlot(
  slotId: string,
  connectorId: WalletConnectorId,
): Promise<RuntimeConnectResult> {
  return connectWithReason({
    slotId,
    connectorId,
    connectedReason: 'reconnected',
    accountMethod: 'eth_accounts',
  });
}

export async function signRuntimeSlotMessage(parameters: {
  slotId: string;
  accountId: string;
  message: string;
}): Promise<string> {
  const runtime = slotRuntimeById.get(parameters.slotId);
  if (!runtime || !runtime.account.isConnected || !runtime.account.accountId) {
    throw new Error('No active runtime session is available for this wallet slot.');
  }

  if (runtime.account.accountId !== parameters.accountId) {
    throw new Error('The runtime session account does not match the selected account.');
  }

  if (!runtime.provider) {
    throw new Error('No EIP-1193 provider is attached to this wallet slot.');
  }

  const message = parameters.message.trim();
  if (message.length === 0) {
    throw new Error('Challenge message is empty.');
  }

  const provider = runtime.provider;

  try {
    const personal = await requestSignature(provider, 'personal_sign', [
      message,
      parameters.accountId,
    ]);
    if (personal) {
      return normalizeSignature(personal);
    }
  } catch (error) {
    if (!isMethodUnsupported(error)) {
      throw error;
    }
  }

  try {
    const personalReversed = await requestSignature(provider, 'personal_sign', [
      parameters.accountId,
      message,
    ]);
    if (personalReversed) {
      return normalizeSignature(personalReversed);
    }
  } catch (error) {
    if (!isMethodUnsupported(error)) {
      throw error;
    }
  }

  const ethSign = await requestSignature(provider, 'eth_sign', [parameters.accountId, message]);
  if (!ethSign) {
    throw new Error('Wallet did not return a challenge signature.');
  }

  return normalizeSignature(ethSign);
}

async function requestActionSubmission(
  provider: BrowserWalletProvider,
  method: string,
  params: readonly unknown[] | undefined,
): Promise<unknown> {
  if (params) {
    return provider.request({ method, params });
  }

  return provider.request({ method });
}

function extractActionHash(submissionResult: unknown): string | null {
  if (typeof submissionResult === 'string') {
    const trimmed = submissionResult.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!submissionResult || typeof submissionResult !== 'object') {
    return null;
  }

  const submissionRecord = submissionResult as Record<string, unknown>;
  for (const key of ['actionHash', 'hash', 'txHash'] as const) {
    const candidate = submissionRecord[key];
    if (typeof candidate !== 'string') {
      continue;
    }

    const trimmed = candidate.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

export async function disconnectRuntimeSlot(slotId: string): Promise<void> {
  const runtime = slotRuntimeById.get(slotId);

  if (!runtime) {
    return;
  }

  runtime.provider = null;
  runtime.account = {
    isConnected: false,
  };
  notifyAccountChange(runtime);
}

export function watchRuntimeSlotAccount(
  slotId: string,
  onChange: (account: RuntimeAccountSnapshot) => void,
): () => void {
  const runtime = getOrCreateSlotRuntime(slotId);
  let watchedProvider: BrowserWalletProvider | null = null;
  let stopWatchingProvider: (() => void) | null = null;

  const refreshProviderWatch = (): void => {
    if (runtime.provider === watchedProvider) {
      return;
    }

    if (stopWatchingProvider) {
      stopWatchingProvider();
      stopWatchingProvider = null;
    }

    watchedProvider = runtime.provider;
    if (!watchedProvider) {
      return;
    }

    stopWatchingProvider = watchProviderLifecycle(runtime, watchedProvider);
  };

  const listener = (account: RuntimeAccountSnapshot): void => {
    refreshProviderWatch();
    onChange(account);
  };

  runtime.listeners.add(listener);
  refreshProviderWatch();
  onChange(runtime.account);

  return () => {
    runtime.listeners.delete(listener);
    if (stopWatchingProvider) {
      stopWatchingProvider();
      stopWatchingProvider = null;
    }
    watchedProvider = null;
  };
}

export async function clearRuntimeSlots(slotIds: readonly string[]): Promise<void> {
  for (const slotId of slotIds) {
    slotRuntimeById.delete(slotId);
  }
}

export async function signAndSubmitRuntimeSlotAction(parameters: {
  slotId: string;
  accountId: string;
  payload: UnsignedActionPayload;
}): Promise<string> {
  const runtime = slotRuntimeById.get(parameters.slotId);
  if (!runtime || !runtime.account.isConnected || !runtime.account.accountId) {
    throw new Error('No active runtime session is available for this wallet slot.');
  }

  if (runtime.account.accountId !== parameters.accountId) {
    throw new Error('The runtime session account does not match the selected account.');
  }

  if (
    parameters.payload.kind !== 'perp_order_action' &&
    parameters.payload.kind !== 'perp_cancel_action'
  ) {
    throw new Error('Unsupported unsigned action kind.');
  }
  if (!runtime.provider) {
    throw new Error('No EIP-1193 provider is attached to this wallet slot.');
  }

  const walletRequest = parameters.payload.walletRequest;
  const method = walletRequest.method.trim();
  if (method.length === 0) {
    throw new Error('Unsigned action payload wallet request method is required.');
  }

  await ensureProviderAccountMatches(runtime.provider, parameters.accountId);
  const response = await requestActionSubmission(runtime.provider, method, walletRequest.params);
  const actionHash = extractActionHash(response);
  if (!actionHash) {
    throw new Error('Wallet submission did not return an action hash.');
  }

  return actionHash;
}

export async function signRuntimeSlotActionPayload(parameters: {
  slotId: string;
  accountId: string;
  payload: UnsignedActionPayload;
}): Promise<string> {
  const runtime = slotRuntimeById.get(parameters.slotId);
  if (!runtime || !runtime.account.isConnected || !runtime.account.accountId) {
    throw new Error('No active runtime session is available for this wallet slot.');
  }

  if (runtime.account.accountId !== parameters.accountId) {
    throw new Error('The runtime session account does not match the selected account.');
  }

  if (
    parameters.payload.kind !== 'perp_order_action' &&
    parameters.payload.kind !== 'perp_cancel_action'
  ) {
    throw new Error('Unsupported unsigned action kind.');
  }
  if (!runtime.provider) {
    throw new Error('No EIP-1193 provider is attached to this wallet slot.');
  }

  const walletRequest = parameters.payload.walletRequest;
  const method = walletRequest.method.trim();
  if (method.length === 0) {
    throw new Error('Unsigned action payload wallet request method is required.');
  }

  const walletParams = walletRequest.params ?? [];
  const signerAccount = readRequestedSignerAccount(walletParams);
  if (
    signerAccount &&
    normalizeComparableAccountId(signerAccount) !==
      normalizeComparableAccountId(parameters.accountId)
  ) {
    throw new Error('Unsigned action payload signer account does not match the selected account.');
  }
  await ensureProviderAccountMatches(runtime.provider, parameters.accountId);
  if (parameters.payload.venue === 'hyperliquid') {
    await ensureWalletOnSigningChain(runtime.provider, method, walletParams);
    await ensureProviderAccountMatches(runtime.provider, parameters.accountId);
  }
  const signature = await requestSignature(runtime.provider, method, walletParams);

  if (!signature) {
    throw new Error('Wallet did not return a signed action signature.');
  }

  return normalizeSignature(signature);
}
