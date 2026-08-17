"use client";

import type { ComponentProps } from "react";
import { useCallback, useState } from "react";

import { Avatar } from "@thenamespace/uikit";
import { normalize } from "viem/ens";
import { useEnsAvatar } from "wagmi";

const FALLBACK_AVATAR_COUNT = 10;
const FALLBACK_AVATAR_BASE_URL = "https://app.namespace.ninja/assets/avatars";

export interface NameAvatarProps extends Omit<ComponentProps<typeof Avatar>, "children"> {
  label: string;
  resolveEnsAvatar?: boolean;
}

export const NameAvatar = ({ label, resolveEnsAvatar = true, ...props }: NameAvatarProps) => {
  const normalizedLabel = label.trim().replace(/\.eth$/iu, "");
  const name = normalize(`${normalizedLabel}.eth`);
  const { data: ensAvatar } = useEnsAvatar({
    name,
    query: {
      enabled: resolveEnsAvatar,
      staleTime: 60 * 60_000,
      gcTime: 24 * 60 * 60_000,
    },
  });
  const fallbackAvatar = getDeterministicAvatar(normalizedLabel);
  const [failedEnsAvatar, setFailedEnsAvatar] = useState<string | null>(null);
  const avatar = ensAvatar && ensAvatar !== failedEnsAvatar ? ensAvatar : fallbackAvatar;

  const handleAvatarError = useCallback(() => {
    if (ensAvatar && avatar === ensAvatar) {
      setFailedEnsAvatar(ensAvatar);
    }
  }, [avatar, ensAvatar]);

  return (
    <Avatar {...props}>
      <Avatar.Image key={avatar} alt={`${name} avatar`} onError={handleAvatarError} src={avatar} />
      <Avatar.Fallback />
    </Avatar>
  );
};

export const getDeterministicAvatar = (value: string) => {
  let hash = 2_166_136_261;

  for (const character of value.toLocaleLowerCase("en-US")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }

  const avatar = ((hash >>> 0) % FALLBACK_AVATAR_COUNT) + 1;
  return `${FALLBACK_AVATAR_BASE_URL}/${avatar}.webp`;
};
