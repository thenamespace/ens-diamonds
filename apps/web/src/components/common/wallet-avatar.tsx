"use client";

import { useCallback, useState } from "react";

import { Avatar } from "@thenamespace/uikit";
import { mainnet } from "viem/chains";
import { useEnsAvatar, useEnsName } from "wagmi";

import { getDeterministicAvatar } from "./name-avatar";

interface WalletAvatarProps {
  address: string;
  className?: string;
}

export function WalletAvatar({ address, className = "size-6" }: WalletAvatarProps) {
  const [failedAvatar, setFailedAvatar] = useState(false);
  const { data: ensName } = useEnsName({ address: address as `0x${string}`, chainId: mainnet.id });
  const { data: ensAvatar } = useEnsAvatar({
    chainId: mainnet.id,
    name: ensName ?? undefined,
    query: { enabled: Boolean(ensName) },
  });
  const avatar = ensAvatar && !failedAvatar ? ensAvatar : getDeterministicAvatar(address);
  const handleError = useCallback(() => setFailedAvatar(true), []);

  return (
    <Avatar className={className}>
      <Avatar.Image alt="" onError={handleError} src={avatar} />
      <Avatar.Fallback />
    </Avatar>
  );
}
