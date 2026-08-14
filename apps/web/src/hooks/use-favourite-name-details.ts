"use client";

import { useMemo } from "react";

import {
  baseRegistrarAvailableSnippet,
  baseRegistrarNameExpiresSnippet,
} from "@ensdomains/ensjs/contracts";
import { keccak256, toBytes } from "viem";
import { useReadContracts } from "wagmi";

import { SECONDS_PER_DAY } from "@/lib/constants";
import { activeChain, Contracts } from "@/lib/network";

const GRACE_PERIOD_SECONDS = 90 * SECONDS_PER_DAY;
const PREMIUM_PERIOD_SECONDS = 21 * SECONDS_PER_DAY;

export type FavouriteNameDetails = {
  availableAt: number | undefined;
  isAvailable: boolean | undefined;
  label: string;
  premiumStartsAt: number | undefined;
};

export const useFavouriteNameDetails = (labels: string[]) => {
  const contracts = useMemo(
    () =>
      labels.flatMap((label) => {
        const tokenId = BigInt(keccak256(toBytes(label)));

        return [
          {
            abi: baseRegistrarAvailableSnippet,
            address: Contracts.ensBaseRegistrar.address,
            args: [tokenId],
            chainId: activeChain.id,
            functionName: "available" as const,
          },
          {
            abi: baseRegistrarNameExpiresSnippet,
            address: Contracts.ensBaseRegistrar.address,
            args: [tokenId],
            chainId: activeChain.id,
            functionName: "nameExpires" as const,
          },
        ];
      }),
    [labels],
  );
  const query = useReadContracts({
    allowFailure: true,
    contracts,
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 60_000,
      staleTime: 30_000,
    },
  });
  const names = useMemo(
    () =>
      labels.map((label, index): FavouriteNameDetails => {
        const availability = query.data?.[index * 2];
        const expiry = query.data?.[index * 2 + 1];
        const isAvailable =
          availability?.status === "success" && typeof availability.result === "boolean"
            ? availability.result
            : undefined;
        const registrationExpiresAt =
          expiry?.status === "success" && typeof expiry.result === "bigint"
            ? Number(expiry.result)
            : undefined;
        const premiumStartsAt =
          registrationExpiresAt && registrationExpiresAt > 0
            ? registrationExpiresAt + GRACE_PERIOD_SECONDS
            : undefined;

        return {
          availableAt:
            premiumStartsAt === undefined ? undefined : premiumStartsAt + PREMIUM_PERIOD_SECONDS,
          isAvailable,
          label,
          premiumStartsAt,
        };
      }),
    [labels, query.data],
  );

  return {
    isError: query.isError,
    isPending: query.isPending,
    names,
  };
};
