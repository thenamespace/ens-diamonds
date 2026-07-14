import Link from "next/link";
import ConnectButton from "./connect-button";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/coffer-logo.png" alt="" width={30} height={30} />
            <span>Coffer</span>
          </Link>

          <nav className="topnav">
            <Link href="/">Discover</Link>
            <Link href="/pools">Vaults</Link>
            <Link href="/watching">Watching</Link>
            <Link href="/portfolio">Portfolio</Link>
            <Link href="/about">About</Link>
          </nav>

          <div className="topbar-right">
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <span className="fine">
            Built by{" "}
            <a href="https://namespace.ninja" target="_blank" rel="noreferrer" className="footer-link">
              Namespace
            </a>{" "}
            · <Link href="/about" className="footer-link">About Coffer</Link>
          </span>
          <span className="fine mono">non-custodial · open-source escrow · on Sepolia testnet</span>
        </div>
      </footer>
    </div>
  );
}
