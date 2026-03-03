import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WorkspaceMarketDataState } from '@/components/workspace/use-workspace-market-data';
import type { WorkspaceModule } from '@/components/workspace/types';

const DEFAULT_SYMBOL_ORDER = ['ETH', 'BTC', 'USDC', 'SOL'];

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUSD(value: number): string {
  return USD_FORMATTER.format(value);
}

function metricPill(
  key: string,
  pair: string,
  price: string,
  delta: string,
  positive: boolean,
) {
  return (
    <li className="ticker-pill" key={key}>
      <span>{pair}</span>
      <strong>{price}</strong>
      <em className={positive ? 'up' : 'down'}>{delta}</em>
    </li>
  );
}

function deterministicDelta(symbol: string): { label: string; positive: boolean } {
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const delta = ((seed % 700) - 350) / 100;
  const positive = delta >= 0;
  const label = `${positive ? '+' : ''}${delta.toFixed(2)}%`;
  return { label, positive };
}

function resolveOverviewSymbols(marketData: WorkspaceMarketDataState): string[] {
  if (marketData.tokens.length > 0) {
    return marketData.tokens.slice(0, 4).map((token) => token.symbol.toUpperCase());
  }
  return DEFAULT_SYMBOL_ORDER;
}

function parseBalance(balance: string): number {
  const parsed = Number.parseFloat(balance);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderMarketDataError(error: string | null) {
  if (!error) {
    return null;
  }
  return <p className="placeholder-text">{error}</p>;
}

type ModuleContentProps = {
  module: WorkspaceModule;
  marketData: WorkspaceMarketDataState;
};

export function ModuleContent({ module, marketData }: ModuleContentProps) {
  const tokenBySymbol = new Map(
    marketData.tokens.map((token) => [token.symbol.toUpperCase(), token] as const),
  );

  if (module.kind === 'overview') {
    const overviewSymbols = resolveOverviewSymbols(marketData);
    return (
      <>
        {renderMarketDataError(marketData.error)}
        <ul className="ticker-row">
          {overviewSymbols.map((symbol) => {
            const spotPrice = marketData.prices[symbol];
            const delta = deterministicDelta(symbol);
            return metricPill(
              symbol,
              `${symbol}/USD`,
              spotPrice ? formatUSD(spotPrice.price) : '--',
              delta.label,
              delta.positive,
            );
          })}
        </ul>
      </>
    );
  }

  if (module.kind === 'chart') {
    const ethPrice = marketData.prices.ETH;
    const delta = deterministicDelta('ETH');

    return (
      <>
        {renderMarketDataError(marketData.error)}
        <div className="chart-wrap">
          <div className="chart-meta">
            <p className="pair">ETH/USD</p>
            <p className="price">{ethPrice ? formatUSD(ethPrice.price) : '--'}</p>
            <p className={`delta ${delta.positive ? 'up' : 'down'}`}>{delta.label}</p>
          </div>
          <div className="chart-frame">
            <svg viewBox="0 0 800 280" aria-hidden="true">
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(19, 201, 145, 0.36)" />
                  <stop offset="100%" stopColor="rgba(19, 201, 145, 0)" />
                </linearGradient>
              </defs>
              <path
                d="M0 250 C80 225, 130 210, 190 205 C260 200, 315 215, 370 190 C430 160, 500 120, 570 125 C640 130, 700 150, 800 70"
                fill="none"
                stroke="#13c991"
                strokeWidth="3"
              />
              <path
                d="M0 250 C80 225, 130 210, 190 205 C260 200, 315 215, 370 190 C430 160, 500 120, 570 125 C640 130, 700 150, 800 70 L800 280 L0 280 Z"
                fill="url(#chartFill)"
              />
            </svg>
          </div>
        </div>
      </>
    );
  }

  if (module.kind === 'trade') {
    const ethToken = tokenBySymbol.get('ETH');
    const ethPrice = marketData.prices.ETH;
    const amountLabel = `${ethToken?.symbol ?? 'ETH'} · ${ethToken?.decimals ?? 18} decimals`;

    return (
      <>
        {renderMarketDataError(marketData.error)}
        <div className="trade-panel">
          <div className="trade-switch" role="tablist" aria-label="Trade mode">
            <Button type="button" size="sm" className="trade-switch-active">
              Buy
            </Button>
            <Button type="button" variant="soft" size="sm">
              Sell
            </Button>
          </div>
          <label>
            Price
            <Input
              key={`trade-price-${ethPrice?.timestampMs ?? 'default'}`}
              defaultValue={ethPrice ? ethPrice.price.toFixed(2) : '0.00'}
            />
          </label>
          <label>
            Amount ({amountLabel})
            <Input defaultValue="0.00" />
          </label>
          <div className="quick-split" role="group" aria-label="Allocation presets">
            <Button type="button" variant="soft" size="sm">
              25%
            </Button>
            <Button type="button" variant="soft" size="sm">
              50%
            </Button>
            <Button type="button" variant="soft" size="sm">
              75%
            </Button>
            <Button type="button" variant="soft" size="sm">
              100%
            </Button>
          </div>
          <Button type="button" className="trade-submit">
            Buy {ethToken?.symbol ?? 'ETH'}
          </Button>
        </div>
      </>
    );
  }

  if (module.kind === 'orderbook') {
    const ethPrice = marketData.prices.ETH?.price ?? 0;
    const bid = ethPrice > 0 ? ethPrice - 0.7 : 2845.1;
    const ask = ethPrice > 0 ? ethPrice + 0.7 : 2846.8;

    return (
      <>
        {renderMarketDataError(marketData.error)}
        <div className="orderbook">
          <div className="orderbook-row sell">
            <span>{ask.toFixed(2)}</span>
            <span>2.458</span>
            <span>{(ask * 2.458).toFixed(2)}</span>
          </div>
          <div className="orderbook-row sell">
            <span>{(ask + 0.4).toFixed(2)}</span>
            <span>1.192</span>
            <span>{((ask + 0.4) * 1.192).toFixed(2)}</span>
          </div>
          <p className="spread">Spread: {(ask - bid).toFixed(2)}</p>
          <div className="orderbook-row buy">
            <span>{bid.toFixed(2)}</span>
            <span>1.567</span>
            <span>{(bid * 1.567).toFixed(2)}</span>
          </div>
          <div className="orderbook-row buy">
            <span>{(bid - 0.4).toFixed(2)}</span>
            <span>2.204</span>
            <span>{((bid - 0.4) * 2.204).toFixed(2)}</span>
          </div>
        </div>
      </>
    );
  }

  if (module.kind === 'positions') {
    const balances = marketData.balances;
    const totalValue = balances.reduce((sum, balance) => {
      const spotPrice = marketData.prices[balance.symbol.toUpperCase()]?.price ?? 0;
      return sum + parseBalance(balance.balance) * spotPrice;
    }, 0);

    return (
      <div className="positions">
        {renderMarketDataError(marketData.error)}
        <div className="positions-pnl">
          TOTAL VALUE: <strong>{formatUSD(totalValue)}</strong>
        </div>
        <div className="positions-grid positions-head">
          <span>Asset</span>
          <span>Name</span>
          <span>Decimals</span>
          <span>Spot</span>
          <span>Balance</span>
          <span>Value</span>
        </div>
        {balances.map((balance) => {
          const symbol = balance.symbol.toUpperCase();
          const token = tokenBySymbol.get(symbol);
          const spotPrice = marketData.prices[symbol];
          const numericBalance = parseBalance(balance.balance);
          const usdValue = (spotPrice?.price ?? 0) * numericBalance;

          return (
            <div className="positions-grid" key={symbol}>
              <strong>{symbol}</strong>
              <span className="tag">{token?.name ?? 'Unknown asset'}</span>
              <span>{token?.decimals ?? '--'}</span>
              <strong>{spotPrice ? formatUSD(spotPrice.price) : '--'}</strong>
              <span>{balance.balance}</span>
              <strong className="up">{spotPrice ? formatUSD(usdValue) : '--'}</strong>
            </div>
          );
        })}
        {marketData.loading && balances.length === 0 ? (
          <p className="placeholder-text">Loading balances...</p>
        ) : null}
      </div>
    );
  }

  return <p className="placeholder-text">Drop strategy notes, KPI tiles or custom signals here.</p>;
}
