'use client';

import { useState } from 'react';

type ModuleKind = 'overview' | 'chart' | 'trade' | 'orderbook' | 'positions' | 'custom';
type ModuleSize = 'full' | 'wide' | 'normal';

type WorkspaceModule = {
  id: number;
  kind: ModuleKind;
  label: string;
  size: ModuleSize;
};

const initialModules: WorkspaceModule[] = [
  { id: 1, kind: 'overview', label: 'Market Overview', size: 'full' },
  { id: 2, kind: 'chart', label: 'Price Chart', size: 'wide' },
  { id: 3, kind: 'trade', label: 'Trade Panel', size: 'normal' },
  { id: 4, kind: 'orderbook', label: 'Order Book', size: 'normal' },
  { id: 5, kind: 'positions', label: 'Open Positions', size: 'wide' },
];

function moveModule(modules: WorkspaceModule[], sourceId: number, targetId: number): WorkspaceModule[] {
  if (sourceId === targetId) return modules;
  const sourceIndex = modules.findIndex((module) => module.id === sourceId);
  const targetIndex = modules.findIndex((module) => module.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return modules;

  const nextModules = [...modules];
  const [movedModule] = nextModules.splice(sourceIndex, 1);
  if (!movedModule) return modules;
  nextModules.splice(targetIndex, 0, movedModule);
  return nextModules;
}

function pushModuleToEnd(modules: WorkspaceModule[], sourceId: number): WorkspaceModule[] {
  const sourceIndex = modules.findIndex((module) => module.id === sourceId);
  if (sourceIndex < 0) return modules;

  const nextModules = [...modules];
  const [movedModule] = nextModules.splice(sourceIndex, 1);
  if (!movedModule) return modules;
  nextModules.push(movedModule);
  return nextModules;
}

function createCustomModule(id: number): WorkspaceModule {
  return { id, kind: 'custom', label: `Custom Widget ${id}`, size: 'normal' };
}

function metricPill(pair: string, price: string, delta: string, positive: boolean) {
  return (
    <li className="ticker-pill">
      <span>{pair}</span>
      <strong>{price}</strong>
      <em className={positive ? 'up' : 'down'}>{delta}</em>
    </li>
  );
}

function renderModuleBody(module: WorkspaceModule) {
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
          <button type="button" className="trade-switch-active">
            Buy
          </button>
          <button type="button">Sell</button>
        </div>
        <label>
          Price
          <input defaultValue="2845.32" />
        </label>
        <label>
          Amount (ETH)
          <input defaultValue="0.00" />
        </label>
        <div className="quick-split" role="group" aria-label="Allocation presets">
          <button type="button">25%</button>
          <button type="button">50%</button>
          <button type="button">75%</button>
          <button type="button">100%</button>
        </div>
        <button type="button" className="trade-submit">
          Buy ETH
        </button>
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

export default function HomePage() {
  const [modules, setModules] = useState<WorkspaceModule[]>(initialModules);
  const [nextModuleId, setNextModuleId] = useState(initialModules.length + 1);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);

  const addModule = () => {
    setModules((currentModules) => [...currentModules, createCustomModule(nextModuleId)]);
    setNextModuleId((currentId) => currentId + 1);
  };

  const removeModule = (id: number) => {
    setModules((currentModules) => currentModules.filter((module) => module.id !== id));
  };

  const resetLayout = () => {
    setModules(initialModules);
    setNextModuleId(initialModules.length + 1);
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragStart = (id: number, event: React.DragEvent<HTMLElement>) => {
    event.dataTransfer.setData('text/plain', String(id));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const handleDragOverModule = (targetId: number, event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (targetId !== draggingId) {
      setDropTargetId(targetId);
    }
  };

  const handleDropOnModule = (targetId: number, event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceId = draggingId ?? Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(sourceId)) return;
    setModules((currentModules) => moveModule(currentModules, sourceId, targetId));
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDropOnCanvas = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceId = draggingId ?? Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(sourceId)) return;
    setModules((currentModules) => pushModuleToEnd(currentModules, sourceId));
    setDraggingId(null);
    setDropTargetId(null);
  };

  const clearDragState = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };

  return (
    <main className="terminal-page">
      <section className="terminal-shell">
        <header className="terminal-topbar">
          <div className="brand-wrap">
            <button type="button" className="icon-button" aria-label="Open navigation">
              &#9776;
            </button>
            <h1 className="brand">
              DEXERA <span>BETA</span>
            </h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="button button-outline">
              Customize
            </button>
            <button type="button" className="button button-primary">
              Connect Wallet
            </button>
          </div>
        </header>

        <section className="workspace-toolbar">
          <p>
            Drag and drop modules to rearrange your workspace. Drop on empty canvas area to move a
            module to the end.
          </p>
          <div className="workspace-controls">
            <button type="button" className="button button-soft" onClick={addModule}>
              Add Module
            </button>
            <button type="button" className="button button-soft" onClick={resetLayout}>
              Reset Layout
            </button>
          </div>
        </section>

        <section
          className="workspace-grid"
          aria-label="Trading workspace modules"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDropOnCanvas}
        >
          {modules.map((module) => (
            <article
              key={module.id}
              data-testid="module-card"
              className={`module-card module-${module.size}${draggingId === module.id ? ' is-dragging' : ''}${
                dropTargetId === module.id ? ' is-drop-target' : ''
              }`}
              draggable
              onDragStart={(event) => handleDragStart(module.id, event)}
              onDragOver={(event) => handleDragOverModule(module.id, event)}
              onDrop={(event) => handleDropOnModule(module.id, event)}
              onDragEnd={clearDragState}
            >
              <header className="module-header">
                <p>
                  <span className="drag-handle" aria-hidden="true">
                    &#8942;&#8942;
                  </span>
                  {module.label}
                </p>
                <button
                  type="button"
                  className="module-remove"
                  onClick={() => removeModule(module.id)}
                  aria-label={`Remove ${module.label}`}
                >
                  &#10005;
                </button>
              </header>
              <div className="module-body">{renderModuleBody(module)}</div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
