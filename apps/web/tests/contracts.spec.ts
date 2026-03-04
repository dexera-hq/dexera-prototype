import {
  BFF_PUBLIC_PATHS,
  type BffBuildUnsignedTransactionResponse,
  type BffQuoteResponse,
} from '@dexera/api-types/openapi';
import { describe, expect, it } from 'vitest';

describe('generated api contracts', () => {
  it('exposes expected public paths', () => {
    expect(BFF_PUBLIC_PATHS).toContain('/health');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/placeholder');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/quotes');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/transactions/unsigned');
  });

  it('exposes normalized quote fields in generated types', () => {
    const responseFixture: BffQuoteResponse = {
      quoteId: 'quote_1',
      chainId: 1,
      sellToken: '0x1111111111111111111111111111111111111111',
      buyToken: '0x2222222222222222222222222222222222222222',
      sellAmount: '1000000000000000000',
      amountOut: '1234500000000000000',
      minOut: '1220000000000000000',
      safety: {
        minOut: '1220000000000000000',
        deadline: '1735689600',
      },
      unsignedTx: {
        to: '0x5555555555555555555555555555555555555555',
        data: '0xabcdef',
        value: '0',
        gasLimit: '250000',
        maxFeePerGas: '35000000000',
        maxPriorityFeePerGas: '2000000000',
        chainId: 1,
      },
      route: [{ pathIndex: 0, hopIndex: 0, type: 'v3-pool' }],
      fees: { items: [] },
      requiredApprovals: [],
      source: 'uniswap',
    };

    expect(responseFixture.minOut).toBe('1220000000000000000');
  });

  it('exposes unsigned transaction build fields in generated types', () => {
    const responseFixture: BffBuildUnsignedTransactionResponse = {
      orderId: 'ord_1',
      signingPolicy: 'client-signing-only',
      disclaimer: 'Transactions are prepared server-side as unsigned payloads only.',
      unsignedTxPayload: {
        id: 'utxp_1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        kind: 'evm_transaction',
        to: '0x2222222222222222222222222222222222222222',
        data: '0xdeadbeef',
        value: '0',
        gasLimit: '210000',
      },
    };

    expect(responseFixture.unsignedTxPayload.walletAddress).toBe(
      '0x1111111111111111111111111111111111111111',
    );
  });
});
