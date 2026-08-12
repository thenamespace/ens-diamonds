"use client";

import { useCallback, useState } from "react";

import { Avatar } from "@thenamespace/uikit";

import { useEnsIdentity } from "@/hooks";

import { getDeterministicAvatar } from "./name-avatar";

interface WalletAvatarProps {
  address: string;
  className?: string;
}

export function WalletAvatar({ address, className = "size-6" }: WalletAvatarProps) {
  const identity = useEnsIdentity(address as `0x${string}`);

  return <WalletIdentityAvatar address={address} avatar={identity.avatar} className={className} />;
}

interface WalletIdentityAvatarProps extends WalletAvatarProps {
  avatar?: string | null;
}

export function WalletIdentityAvatar({
  address,
  avatar,
  className = "size-6",
}: WalletIdentityAvatarProps) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const source = avatar && avatar !== failedAvatar ? avatar : getDeterministicAvatar(address);
  const handleError = useCallback(() => {
    if (avatar) setFailedAvatar(avatar);
  }, [avatar]);

  return (
    <Avatar className={className}>
      <Avatar.Image key={source} alt="" onError={handleError} src={source} />
      <Avatar.Fallback />
    </Avatar>
  );
}
