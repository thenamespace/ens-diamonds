"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { useEffect, useState } from "react";
import { shortAddr } from "@/lib/chain";

export default function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  useEffect(() => setMounted(true), []);
  if (!mounted) return <button className="btn btn-primary btn-sm">Connect wallet</button>;

  if (isConnected && chainId !== sepolia.id) {
    return (
      <button className="btn btn-sm" style={{ background: "var(--warn-soft)", color: "#9a5316" }} onClick={() => switchChain({ chainId: sepolia.id })}>
        ⚠ Switch to Sepolia
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => disconnect()} title="Disconnect">
        <span className="wallet-dot" /> {shortAddr(address)}
      </button>
    );
  }

  return (
    <button className="btn btn-primary btn-sm" onClick={() => connect({ connector: injected() })} disabled={isPending}>
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
