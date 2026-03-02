import { Button } from '@/components/ui/button';

export function TerminalHeader() {
  return (
    <header className="terminal-topbar">
      <div className="brand-wrap">
        <Button type="button" variant="soft" size="icon" className="icon-button" aria-label="Open navigation">
          &#9776;
        </Button>
        <h1 className="brand">
          DEXERA <span>BETA</span>
        </h1>
      </div>
      <div className="topbar-actions">
        <Button type="button" variant="outline">
          Customize
        </Button>
        <Button type="button">Connect Wallet</Button>
      </div>
    </header>
  );
}

