"use client";

import type { ComponentProps } from "react";

import { Avatar } from "@thenamespace/uikit";
import { normalize } from "viem/ens";
import { useEnsAvatar } from "wagmi";

const FALLBACK_AVATAR_COUNT = 10;
const FALLBACK_AVATAR_BASE_URL = "https://app.namespace.ninja/assets/avatars";

export type NameAvatarProps = Omit<ComponentProps<typeof Avatar>, "children"> & {
  label: string;
};

export const NameAvatar = ({ label, ...props }: NameAvatarProps) => {
  const normalizedLabel = label.trim().replace(/\.eth$/iu, "");
  const name = normalize(`${normalizedLabel}.eth`);
  const { data: ensAvatar } = useEnsAvatar({ name });
  const fallbackAvatar = getFallbackAvatar(normalizedLabel);

  return (
    <Avatar {...props}>
      <Avatar.Image alt={`${name} avatar`} src={ensAvatar ?? fallbackAvatar} />
      <Avatar.Fallback>{normalizedLabel.slice(0, 2).toUpperCase()}</Avatar.Fallback>
    </Avatar>
  );
};

const getFallbackAvatar = (label: string) => {
  let hash = 2_166_136_261;

  for (const character of label.toLocaleLowerCase("en-US")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }

  const avatar = ((hash >>> 0) % FALLBACK_AVATAR_COUNT) + 1;
  return `${FALLBACK_AVATAR_BASE_URL}/${avatar}.webp`;
};
