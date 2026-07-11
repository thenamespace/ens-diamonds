"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import AddressLabel from "@/components/address-label";
import EnsAvatar from "@/components/ens-avatar";

export default function CofferConnectButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
        if (!mounted) return <button className="btn btn-primary btn-sm">Connect wallet</button>;

        // Not connected → open RainbowKit's wallet picker.
        if (!account || !chain) {
          return (
            <button className="btn btn-primary btn-sm" onClick={openConnectModal}>
              Connect wallet
            </button>
          );
        }

        // Connected to the wrong network → prompt to switch to Sepolia.
        if (chain.unsupported) {
          return (
            <button className="btn btn-sm" style={{ background: "var(--warn-soft)", color: "#9a5316" }} onClick={openChainModal}>
              ⚠ Switch to Sepolia
            </button>
          );
        }

        // Connected → account modal (balance, copy address, disconnect).
        return (
          <button className="btn btn-ghost btn-sm" onClick={openAccountModal} title="Account">
            <EnsAvatar address={account.address} size={18} fallback={<span className="wallet-dot" />} />
            <AddressLabel address={account.address} mono={false} />
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
