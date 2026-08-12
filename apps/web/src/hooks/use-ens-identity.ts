"use client";

import type { Address } from "viem";
import { mainnet } from "viem/chains";
import { useEnsAvatar, useEnsName } from "wagmi";

export const useEnsIdentity = (address: Address | null) => {
  const nameQuery = useEnsName({
    address: address ?? undefined,
    chainId: mainnet.id,
    query: { enabled: address !== null },
  });
  const avatarQuery = useEnsAvatar({
    chainId: mainnet.id,
    name: nameQuery.data ?? undefined,
    query: { enabled: Boolean(nameQuery.data) },
  });

  return {
    avatar: avatarQuery.data ?? null,
    isFetching: nameQuery.isFetching || avatarQuery.isFetching,
    name: nameQuery.data ?? null,
  };
};
