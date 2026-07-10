"use client";

import { useEffect, useState } from "react";

// Minimal real wallet connect via the injected provider (MetaMask, Rabby, …).
// No WalletConnect key needed. Swaps to wagmi v2 + RainbowKit when the app
// starts making on-chain calls (Phase 3).

type Eth = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...a: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...a: unknown[]) => void) => void;
};

function short(addr: string): string {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function ConnectButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasWallet, setHasWallet] = useState(true);

  useEffect(() => {
    const eth = (window as unknown as { ethereum?: Eth }).ethereum;
    if (!eth) {
      setHasWallet(false);
      return;
    }
    eth.request({ method: "eth_accounts" }).then((accts) => {
      const a = accts as string[];
      if (a && a.length) setAddress(a[0]);
    });
    const onAccts = (...a: unknown[]) => {
      const accts = a[0] as string[];
      setAddress(accts && accts.length ? accts[0] : null);
    };
    eth.on?.("accountsChanged", onAccts);
    return () => eth.removeListener?.("accountsChanged", onAccts);
  }, []);

  async function connect() {
    const eth = (window as unknown as { ethereum?: Eth }).ethereum;
    if (!eth) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    setBusy(true);
    try {
      const accts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      if (accts && accts.length) setAddress(accts[0]);
    } catch {
      /* user rejected */
    } finally {
      setBusy(false);
    }
  }

  if (address) {
    return (
      <button className="btn btn-ghost btn-sm" title={address}>
        <span className="wallet-dot" /> {short(address)}
      </button>
    );
  }

  return (
    <button className="btn btn-primary btn-sm" onClick={connect} disabled={busy}>
      {busy ? "Connecting…" : hasWallet ? "Connect wallet" : "Get a wallet"}
    </button>
  );
}
