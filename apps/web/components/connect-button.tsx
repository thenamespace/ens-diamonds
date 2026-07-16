"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@thenamespace/uikit";
import AddressLabel from "@/components/address-label";
import EnsAvatar from "@/components/ens-avatar";
import { APP_CHAIN } from "@/lib/app-chain";

export default function CofferConnectButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
        // "wallet" is dropped on very narrow screens so the button fits the navbar.
        const connectLabel = (
          <>
            Connect<span className="hidden min-[440px]:inline"> wallet</span>
          </>
        );
        if (!mounted) return <Button size="sm">{connectLabel}</Button>;

        // Not connected → open RainbowKit's wallet picker.
        if (!account || !chain) {
          return (
            <Button size="sm" onPress={openConnectModal}>
              {connectLabel}
            </Button>
          );
        }

        // Connected to the wrong network → prompt to switch to the app chain.
        if (chain.unsupported) {
          return (
            <Button className="bg-warning text-warning-foreground" size="sm" onPress={openChainModal}>
              ⚠ Switch to {APP_CHAIN.label}
            </Button>
          );
        }

        // Connected → account modal (balance, copy address, disconnect).
        return (
          <Button aria-label="Account" size="sm" variant="outline" onPress={openAccountModal}>
            <EnsAvatar address={account.address} size={18} fallback={<span className="bg-success inline-block size-[7px] rounded-full" />} />
            <AddressLabel address={account.address} mono={false} />
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
