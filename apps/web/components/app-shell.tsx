import Link from "next/link";
import ConnectButton from "./connect-button";
import SearchBar from "./search-bar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            <span className="mark" aria-hidden />
            <span>Coffer</span>
          </Link>

          <nav className="topnav">
            <Link href="/">Discover</Link>
            <Link href="/pools">Pools</Link>
            <Link href="/portfolio">Portfolio</Link>
          </nav>

          <div className="topbar-right">
            <SearchBar />
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <span className="fine">Coffer · pool ETH to claim premium ENS names, together</span>
          <span className="fine mono">Ethereum mainnet · non-custodial · audited escrow</span>
        </div>
      </footer>
    </div>
  );
}
