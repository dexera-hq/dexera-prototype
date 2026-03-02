import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WorkspaceModule } from '@/components/workspace/types';

function metricPill(pair: string, price: string, delta: string, positive: boolean) {
  return (
    <li className="ticker-pill">
      <span>{pair}</span>
      <strong>{price}</strong>
      <em className={positive ? 'up' : 'down'}>{delta}</em>
    </li>
  );
}

export function ModuleContent({ module }: { module: WorkspaceModule }) {
  if (module.kind === 'overview') {
    return (
      <ul className="ticker-row">
        {metricPill('ETH/USDT', '$2,845.32', '+3.24%', true)}
        {metricPill('BTC/USDT', '$68,432.10', '+1.85%', true)}
        {metricPill('SOL/USDT', '$142.67', '-2.14%', false)}
        {metricPill('AVAX/USDT', '$38.92', '+5.67%', true)}
      </ul>
    );
  }

  if (module.kind === 'chart') {
    return (
      <div className="chart-wrap">
        <div className="chart-meta">
          <p className="pair">ETH/USDT</p>
          <p className="price">$2,845.32</p>
          <p className="delta up">+3.24% (+$89.21)</p>
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
    );
  }

  if (module.kind === 'trade') {
    return (
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
          <Input defaultValue="2845.32" />
        </label>
        <label>
          Amount (ETH)
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
          Buy ETH
        </Button>
      </div>
    );
  }

  if (module.kind === 'orderbook') {
    return (
      <div className="orderbook">
        <div className="orderbook-row sell">
          <span>2,847.50</span>
          <span>2.458</span>
          <span>6,997.02</span>
        </div>
        <div className="orderbook-row sell">
          <span>2,846.80</span>
          <span>1.192</span>
          <span>3,392.58</span>
        </div>
        <p className="spread">Spread: 0.40 (0.014%)</p>
        <div className="orderbook-row buy">
          <span>2,845.10</span>
          <span>1.567</span>
          <span>4,460.11</span>
        </div>
        <div className="orderbook-row buy">
          <span>2,844.70</span>
          <span>2.204</span>
          <span>6,269.32</span>
        </div>
      </div>
    );
  }

  if (module.kind === 'positions') {
    return (
      <div className="positions">
        <div className="positions-pnl">
          TOTAL PNL: <strong>+$1,079.78 (+3.21%)</strong>
        </div>
        <div className="positions-grid positions-head">
          <span>Pair</span>
          <span>Type</span>
          <span>Entry</span>
          <span>Current</span>
          <span>Amount</span>
          <span>PNL</span>
        </div>
        <div className="positions-grid">
          <strong>ETH/USDT</strong>
          <span className="tag">Long</span>
          <span>$2,720.50</span>
          <strong>$2,845.32</strong>
          <span>1.5 ETH</span>
          <strong className="up">+187.23</strong>
        </div>
      </div>
    );
  }

  return <p className="placeholder-text">Drop strategy notes, KPI tiles or custom signals here.</p>;
}

