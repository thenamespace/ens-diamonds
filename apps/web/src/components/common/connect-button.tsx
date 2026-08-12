"use client";

import { useCallback, useEffect, useState } from "react";

import { ConnectButton as RainbowKitConnectButton } from "@rainbow-me/rainbowkit";
import { Button, Dropdown, Label } from "@thenamespace/uikit";
import {
  CheckIcon,
  Copy01Icon,
  HugeiconsIcon,
  LogoutSquare01Icon,
} from "@thenamespace/uikit/icons";
import { useDisconnect } from "wagmi";

import { truncateAddress } from "@/lib/helpers";

import { WalletIdentityAvatar } from "./wallet-avatar";

type AccountDropdownProps = {
  address: string;
  avatar: string | null;
  displayName: string;
  fullWidth: boolean;
  onDisconnect: () => void;
};

function AccountDropdown({
  address,
  avatar,
  displayName,
  fullWidth,
  onDisconnect,
}: AccountDropdownProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
  }, [address]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopied(false);
    }, 1500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copied]);

  return (
    <Dropdown>
      <Button fullWidth={fullWidth} aria-label="Open wallet menu" variant="secondary">
        <WalletIdentityAvatar address={address} avatar={avatar} />
        <span className="text-sm font-normal">{displayName}</span>
      </Button>
      <Dropdown.Popover className="min-w-64" placement="bottom end">
        <Dropdown.Menu>
          <Dropdown.Item
            id="copy-address"
            onAction={copyAddress}
            shouldCloseOnSelect={false}
            textValue="Copy address"
          >
            <WalletIdentityAvatar address={address} avatar={avatar} />
            <div className="flex min-w-0 flex-col">
              <Label>{displayName}</Label>
              {displayName !== truncateAddress(address) ? (
                <span className="text-xs text-muted">{truncateAddress(address)}</span>
              ) : null}
            </div>
            <HugeiconsIcon
              className="ms-auto size-4 text-muted"
              icon={copied ? CheckIcon : Copy01Icon}
            />
          </Dropdown.Item>
          <Dropdown.Item
            id="disconnect"
            onAction={onDisconnect}
            textValue="Disconnect"
            variant="danger"
          >
            <HugeiconsIcon className="size-4 shrink-0 text-danger" icon={LogoutSquare01Icon} />
            <Label>Disconnect</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

type ConnectButtonProps = {
  fullWidth?: boolean;
};

export function ConnectButton({ fullWidth = false }: ConnectButtonProps) {
  const { disconnect } = useDisconnect();

  return (
    <RainbowKitConnectButton.Custom>
      {({ account, authenticationStatus, chain, mounted, openChainModal, openConnectModal }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            aria-hidden={!ready}
            className={ready ? undefined : "pointer-events-none opacity-0 select-none"}
          >
            {!connected ? (
              <Button fullWidth={fullWidth} onPress={openConnectModal}>
                Connect Wallet
              </Button>
            ) : chain.unsupported ? (
              <Button fullWidth={fullWidth} onPress={openChainModal} variant="danger-soft">
                Switch Network
              </Button>
            ) : (
              <AccountDropdown
                address={account.address}
                avatar={account.ensAvatar ?? null}
                displayName={account.ensName ?? account.displayName}
                fullWidth={fullWidth}
                onDisconnect={disconnect}
              />
            )}
          </div>
        );
      }}
    </RainbowKitConnectButton.Custom>
  );
}
