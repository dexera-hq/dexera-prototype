import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TOKENS = ['USDC', 'USDT', 'ETH', 'BTC', 'SOL', 'AVAX'] as const;
type Token = (typeof TOKENS)[number];
type OrderSide = 'buy' | 'sell';

type QuoteRequest = {
  side: OrderSide;
  sellToken: Token;
  buyToken: Token;
  sellAmount: number;
  slippageBps: number;
};

type QuoteLeg = {
  venue: string;
  allocationPct: number;
  path: string;
  expectedBuyAmount: number;
};

type QuoteResponse = {
  id: string;
  createdAt: string;
  expiresAt: string;
  side: OrderSide;
  sellToken: Token;
  buyToken: Token;
  sellAmount: number;
  expectedBuyAmount: number;
  minBuyAmount: number;
  referenceRate: number;
  effectiveRate: number;
  priceImpactBps: number;
  protocolFeeUsd: number;
  gasFeeUsd: number;
  slippageBps: number;
  route: QuoteLeg[];
};

type ExecutionPreview = {
  quoteId: string;
  preparedAt: string;
  deadline: string;
  approvalToken: Token;
  approvalAmount: number;
  calldata: string;
};

const TOKEN_PRICE_USD: Record<Token, number> = {
  USDC: 1,
  USDT: 1,
  ETH: 2845.32,
  BTC: 68432.1,
  SOL: 142.67,
  AVAX: 38.92,
};

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const AMOUNT_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const NOTIONAL_PRESETS = [250, 1000, 2500, 5000] as const;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeAllocations(weights: number[]): number[] {
  const positiveWeights = weights.map((weight) => Math.max(0, weight));
  const total = positiveWeights.reduce((sum, current) => sum + current, 0);
  if (total <= 0) {
    return [100];
  }

  const scaled = positiveWeights.map((weight) => Math.floor((weight / total) * 100));
  let remainder = 100 - scaled.reduce((sum, current) => sum + current, 0);
  let index = 0;
  while (remainder > 0) {
    scaled[index % scaled.length] += 1;
    remainder -= 1;
    index += 1;
  }
  return scaled;
}

function buildRoutePath(sellToken: Token, buyToken: Token, venue: string): string {
  if (
    (sellToken === 'USDC' || sellToken === 'USDT') &&
    (buyToken === 'ETH' || buyToken === 'BTC' || buyToken === 'SOL')
  ) {
    if (venue === 'Curve') {
      return `${sellToken} -> ${buyToken}`;
    }
    return `${sellToken} -> WETH -> ${buyToken}`;
  }

  if (sellToken === 'ETH' && (buyToken === 'USDC' || buyToken === 'USDT')) {
    return `ETH -> WETH -> ${buyToken}`;
  }

  if (sellToken === buyToken) {
    return `${sellToken} -> ${buyToken}`;
  }

  return `${sellToken} -> ${buyToken}`;
}

function buildQuote(request: QuoteRequest): QuoteResponse {
  const notionalUsd = request.sellAmount * TOKEN_PRICE_USD[request.sellToken];
  const seed = hashSeed(
    `${request.side}-${request.sellToken}-${request.buyToken}-${request.sellAmount}-${request.slippageBps}`,
  );
  const referenceRate = TOKEN_PRICE_USD[request.sellToken] / TOKEN_PRICE_USD[request.buyToken];

  const spreadBps = 7 + (seed % 9);
  const impactBps = Math.min(95, Math.max(6, Math.round(notionalUsd / 1300) + ((seed >> 4) % 8)));
  const protocolFeeBps = 6;
  const totalCostBps = spreadBps + impactBps + protocolFeeBps;
  const expectedBuyAmount = request.sellAmount * referenceRate * (1 - totalCostBps / 10_000);
  const minBuyAmount = expectedBuyAmount * (1 - request.slippageBps / 10_000);

  const routeShift = Math.min(8, Math.max(-8, Math.round(notionalUsd / 1800) - 3));
  const routeWeights = normalizeAllocations([52 + routeShift, 31 - routeShift, 17]);
  const routeVenues = ['Uniswap v3', '0x RFQ', 'Curve'];
  const route = routeWeights.map((allocationPct, index) => ({
    venue: routeVenues[index] ?? 'Aggregator',
    allocationPct,
    path: buildRoutePath(request.sellToken, request.buyToken, routeVenues[index] ?? 'Aggregator'),
    expectedBuyAmount: expectedBuyAmount * (allocationPct / 100),
  }));

  const now = Date.now();
  const idSuffix = seed.toString(16).toUpperCase().padStart(8, '0').slice(0, 8);
  const protocolFeeUsd = notionalUsd * (protocolFeeBps / 10_000);
  const gasFeeUsd = 1.35 + route.length * 0.44 + Math.min(7.9, notionalUsd * 0.00012);

  return {
    id: `Q-${idSuffix}`,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 28_000).toISOString(),
    side: request.side,
    sellToken: request.sellToken,
    buyToken: request.buyToken,
    sellAmount: request.sellAmount,
    expectedBuyAmount,
    minBuyAmount,
    referenceRate,
    effectiveRate: expectedBuyAmount / request.sellAmount,
    priceImpactBps: impactBps,
    protocolFeeUsd,
    gasFeeUsd,
    slippageBps: request.slippageBps,
    route,
  };
}

async function requestQuote(request: QuoteRequest): Promise<QuoteResponse> {
  const seed = hashSeed(
    `${request.sellToken}-${request.buyToken}-${request.sellAmount}-${request.slippageBps}`,
  );
  const delayMs = 380 + (seed % 340);
  await sleep(delayMs);
  return buildQuote(request);
}

function buildExecutionPreview(quote: QuoteResponse): ExecutionPreview {
  const seed = hashSeed(
    `${quote.id}-${quote.sellToken}-${quote.buyToken}-${quote.sellAmount}-${quote.expectedBuyAmount}`,
  );
  const payloadA = seed.toString(16).padStart(8, '0');
  const payloadB = Math.round(quote.sellAmount * 1_000_000)
    .toString(16)
    .padStart(12, '0');
  const payloadC = Math.round(quote.minBuyAmount * 1_000_000)
    .toString(16)
    .padStart(12, '0');

  const now = Date.now();
  return {
    quoteId: quote.id,
    preparedAt: new Date(now).toISOString(),
    deadline: new Date(now + 15 * 60_000).toISOString(),
    approvalToken: quote.sellToken,
    approvalAmount: quote.sellAmount,
    calldata: `0x7c025200${payloadA}${payloadB}${payloadC}`,
  };
}

function formatAmount(value: number): string {
  return AMOUNT_FORMATTER.format(value);
}

function formatRelativeQuoteExpiry(expiresAt: string): string {
  const deltaMs = new Date(expiresAt).getTime() - Date.now();
  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  return `${seconds}s`;
}

function formatUtcTime(timestamp: string): string {
  return `${timestamp.slice(11, 19)} UTC`;
}

export function OrderEntryBlock() {
  const [side, setSide] = useState<OrderSide>('buy');
  const [sellToken, setSellToken] = useState<Token>('USDC');
  const [buyToken, setBuyToken] = useState<Token>('ETH');
  const [sellAmountInput, setSellAmountInput] = useState('1000');
  const [slippageInput, setSlippageInput] = useState('50');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [executionPreview, setExecutionPreview] = useState<ExecutionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRequestingQuote, setIsRequestingQuote] = useState(false);
  const [isPreparingExecution, setIsPreparingExecution] = useState(false);
  const requestIdRef = useRef(0);

  const sellAmount = Number(sellAmountInput);
  const slippageBps = Number(slippageInput);
  const sellAmountIsValid = Number.isFinite(sellAmount) && sellAmount > 0;
  const slippageIsValid = Number.isFinite(slippageBps) && slippageBps >= 5 && slippageBps <= 300;
  const canRequestQuote = sellAmountIsValid && slippageIsValid && sellToken !== buyToken;
  const notionalUsd = sellAmountIsValid ? sellAmount * TOKEN_PRICE_USD[sellToken] : 0;

  const resetPricingState = () => {
    requestIdRef.current += 1;
    setIsRequestingQuote(false);
    setQuote(null);
    setExecutionPreview(null);
    setError(null);
  };

  const applyNotionalPreset = (presetUsd: number) => {
    const nextAmount = presetUsd / TOKEN_PRICE_USD[sellToken];
    setSellAmountInput(nextAmount.toFixed(6).replace(/\.?0+$/, ''));
    resetPricingState();
  };

  const handleRequestQuote = async () => {
    if (!canRequestQuote || !sellAmountIsValid || !slippageIsValid) {
      return;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    setIsRequestingQuote(true);
    setQuote(null);
    setExecutionPreview(null);
    setError(null);

    try {
      const nextQuote = await requestQuote({
        side,
        sellToken,
        buyToken,
        sellAmount,
        slippageBps,
      });

      if (currentRequestId !== requestIdRef.current) return;
      setQuote(nextQuote);
    } catch {
      if (currentRequestId !== requestIdRef.current) return;
      setQuote(null);
      setError('Quote request failed. Retry in a moment.');
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsRequestingQuote(false);
      }
    }
  };

  const handlePrepareExecution = async () => {
    if (!quote) return;
    setIsPreparingExecution(true);
    await sleep(180);
    setExecutionPreview(buildExecutionPreview(quote));
    setIsPreparingExecution(false);
  };

  return (
    <section className="order-entry-block" aria-label="Order entry">
      <div className="order-entry-side" role="tablist" aria-label="Order side">
        <Button
          type="button"
          size="sm"
          className={side === 'buy' ? 'trade-switch-active' : ''}
          variant={side === 'buy' ? 'default' : 'soft'}
          aria-selected={side === 'buy'}
          role="tab"
          onClick={() => {
            setSide('buy');
            resetPricingState();
          }}
        >
          Buy
        </Button>
        <Button
          type="button"
          size="sm"
          className={side === 'sell' ? 'trade-switch-active' : ''}
          variant={side === 'sell' ? 'default' : 'soft'}
          aria-selected={side === 'sell'}
          role="tab"
          onClick={() => {
            setSide('sell');
            resetPricingState();
          }}
        >
          Sell
        </Button>
      </div>

      <div className="order-entry-grid">
        <label>
          Sell token
          <select
            value={sellToken}
            className="order-entry-select"
            onChange={(event) => {
              setSellToken(event.target.value as Token);
              resetPricingState();
            }}
          >
            {TOKENS.map((token) => (
              <option key={`sell-${token}`} value={token}>
                {token}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buy token
          <select
            value={buyToken}
            className="order-entry-select"
            onChange={(event) => {
              setBuyToken(event.target.value as Token);
              resetPricingState();
            }}
          >
            {TOKENS.map((token) => (
              <option key={`buy-${token}`} value={token}>
                {token}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Sell amount
        <Input
          value={sellAmountInput}
          inputMode="decimal"
          placeholder="0.00"
          onChange={(event) => {
            setSellAmountInput(event.target.value);
            resetPricingState();
          }}
        />
      </label>

      <div className="order-entry-presets" role="group" aria-label="Notional presets">
        {NOTIONAL_PRESETS.map((presetUsd) => (
          <Button
            key={presetUsd}
            type="button"
            variant="soft"
            size="sm"
            onClick={() => applyNotionalPreset(presetUsd)}
          >
            {USD_FORMATTER.format(presetUsd)}
          </Button>
        ))}
      </div>

      <label>
        Max slippage (bps)
        <Input
          value={slippageInput}
          inputMode="numeric"
          placeholder="50"
          onChange={(event) => {
            setSlippageInput(event.target.value);
            resetPricingState();
          }}
        />
      </label>

      <p className="order-entry-notional">
        Notional: <strong>{USD_FORMATTER.format(notionalUsd)}</strong>
      </p>

      <div className="order-entry-actions">
        <Button type="button" onClick={handleRequestQuote} disabled={!canRequestQuote || isRequestingQuote}>
          {isRequestingQuote ? 'Requesting quote...' : 'Request Quote'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handlePrepareExecution}
          disabled={!quote || isRequestingQuote || isPreparingExecution}
        >
          {isPreparingExecution ? 'Preparing...' : 'Prepare Execution'}
        </Button>
      </div>

      {!canRequestQuote ? (
        <p className="order-entry-hint">
          Enter a positive amount, keep slippage between 5-300 bps, and choose different tokens.
        </p>
      ) : null}
      {error ? <p className="order-entry-error">{error}</p> : null}

      <section className="quote-summary" aria-label="Route summary">
        <header>
          <p>Route Summary</p>
          {quote ? <span>Valid for {formatRelativeQuoteExpiry(quote.expiresAt)}</span> : null}
        </header>

        {quote ? (
          <>
            <div className="quote-metrics">
              <p>
                <span>Quote ID</span>
                <strong>{quote.id}</strong>
              </p>
              <p>
                <span>Expected Receive</span>
                <strong>
                  {formatAmount(quote.expectedBuyAmount)} {quote.buyToken}
                </strong>
              </p>
              <p>
                <span>Min Receive</span>
                <strong>
                  {formatAmount(quote.minBuyAmount)} {quote.buyToken}
                </strong>
              </p>
              <p>
                <span>Rate</span>
                <strong>
                  1 {quote.sellToken} = {formatAmount(quote.effectiveRate)} {quote.buyToken}
                </strong>
              </p>
              <p>
                <span>Price Impact</span>
                <strong>{PERCENT_FORMATTER.format(quote.priceImpactBps / 100)}%</strong>
              </p>
              <p>
                <span>Fees</span>
                <strong>{USD_FORMATTER.format(quote.protocolFeeUsd + quote.gasFeeUsd)}</strong>
              </p>
            </div>

            <ul className="quote-route-list">
              {quote.route.map((leg) => (
                <li key={`${quote.id}-${leg.venue}`}>
                  <div>
                    <p>{leg.venue}</p>
                    <span>
                      {leg.allocationPct}% · {leg.path}
                    </span>
                  </div>
                  <strong>
                    {formatAmount(leg.expectedBuyAmount)} {quote.buyToken}
                  </strong>
                  <i style={{ width: `${leg.allocationPct}%` }} aria-hidden="true" />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="order-entry-placeholder">
            Request a quote to review venue splits, expected output, and execution costs.
          </p>
        )}
      </section>

      <section className="execution-preview" aria-label="Execution preparation">
        <header>
          <p>Execution Preview</p>
          <span>No transaction will be sent</span>
        </header>
        {executionPreview ? (
          <>
            <p>
              Prepared from <strong>{executionPreview.quoteId}</strong> at{' '}
              <strong>{formatUtcTime(executionPreview.preparedAt)}</strong>
            </p>
            <p>
              Approve{' '}
              <strong>
                {formatAmount(executionPreview.approvalAmount)} {executionPreview.approvalToken}
              </strong>{' '}
              before routing call.
            </p>
            <p>
              Deadline: <strong>{formatUtcTime(executionPreview.deadline)}</strong>
            </p>
            <p className="execution-calldata">{executionPreview.calldata}</p>
            <Button type="button" className="trade-submit" disabled>
              Send Disabled (Prototype)
            </Button>
          </>
        ) : (
          <p className="order-entry-placeholder">
            Prepare execution after a quote to generate allowance + calldata preview.
          </p>
        )}
      </section>
    </section>
  );
}
