import { describe, expect, it } from 'vitest';

import {
  HYPER_EVM_CHAIN_ID,
  HYPER_EVM_EXPLORER_URL,
  HYPER_EVM_RPC_URL,
  getWalletChainLabel,
  hyperEvmChainDefinition,
  walletChains,
} from '../lib/wallet/chains';

describe('wallet chains', () => {
  it('defines HyperEVM with the expected chain metadata', () => {
    expect(HYPER_EVM_CHAIN_ID).toBe(999);
    expect(HYPER_EVM_RPC_URL).toBe('https://rpc.hyperliquid.xyz/evm');
    expect(HYPER_EVM_EXPLORER_URL).toBe('https://hyperevmscan.io');
    expect(hyperEvmChainDefinition.nativeCurrency.symbol).toBe('HYPE');
    expect(hyperEvmChainDefinition.rpcUrls.default.http).toContain(HYPER_EVM_RPC_URL);
  });

  it('resolves supported chain labels and falls back for unknown ids', () => {
    expect(walletChains.map((chain) => chain.id)).toContain(HYPER_EVM_CHAIN_ID);
    expect(getWalletChainLabel(1)).toBe('Ethereum');
    expect(getWalletChainLabel(HYPER_EVM_CHAIN_ID)).toBe('HyperEVM');
    expect(getWalletChainLabel(8453)).toBe('Chain 8453');
  });
});
