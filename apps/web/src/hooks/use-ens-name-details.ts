"use client";

import { useMemo } from "react";

import {
  baseRegistrarAvailableSnippet,
  baseRegistrarNameExpiresSnippet,
  ethRegistrarControllerRentPriceSnippet,
} from "@ensdomains/ensjs/contracts";
import { keccak256, toBytes } from "viem";
import { useReadContracts } from "wagmi";

import { SECONDS_PER_DAY, SECONDS_PER_YEAR } from "@/lib/constants";
import { activeChain, Contracts } from "@/lib/network";

import { useEthPrice } from "./use-eth-price";

type UseEnsNameDetailsProps = {
  duration?: number;
  label: string;
};

const GRACE_PERIOD_SECONDS = 90 * SECONDS_PER_DAY;
const PREMIUM_PERIOD_SECONDS = 21 * SECONDS_PER_DAY;

export const useEnsNameDetails = ({
  duration = SECONDS_PER_YEAR,
  label,
}: UseEnsNameDetailsProps) => {
  const tokenId = useMemo(() => BigInt(keccak256(toBytes(label))), [label]);
  const nameContracts = useMemo(
    () =>
      [
        {
          abi: ethRegistrarControllerRentPriceSnippet,
          address: Contracts.ensEthRegistrarController.address,
          functionName: "rentPrice",
          args: [label, BigInt(duration)],
          chainId: activeChain.id,
        },
        {
          abi: baseRegistrarAvailableSnippet,
          address: Contracts.ensBaseRegistrar.address,
          functionName: "available",
          args: [tokenId],
          chainId: activeChain.id,
        },
        {
          abi: baseRegistrarNameExpiresSnippet,
          address: Contracts.ensBaseRegistrar.address,
          functionName: "nameExpires",
          args: [tokenId],
          chainId: activeChain.id,
        },
      ] as const,
    [duration, label, tokenId],
  );
  const reads = useReadContracts({
    allowFailure: false,
    contracts: nameContracts,
    query: {
      refetchInterval: 60_000,
      staleTime: 30_000,
    },
  });
  const ethPrice = useEthPrice();

  const rentPrice = reads.data?.[0];
  const isAvailable = reads.data?.[1];
  const nameExpires = reads.data?.[2];
  const registrationExpiresAt =
    nameExpires === undefined || nameExpires === 0n ? undefined : Number(nameExpires);
  const premiumStartsAt =
    registrationExpiresAt === undefined ? undefined : registrationExpiresAt + GRACE_PERIOD_SECONDS;
  const availableAt =
    premiumStartsAt === undefined ? undefined : premiumStartsAt + PREMIUM_PERIOD_SECONDS;

  return {
    availableAt,
    basePrice: rentPrice?.base,
    ethUsd: ethPrice.data,
    isAvailable,
    isError: reads.isError || ethPrice.isError,
    isInPremium: rentPrice === undefined ? undefined : rentPrice.premium > 0n,
    isPending: reads.isPending || ethPrice.isPending,
    premium: rentPrice?.premium,
    premiumStartsAt,
    registrationExpiresAt,
    totalPrice: rentPrice === undefined ? undefined : rentPrice.base + rentPrice.premium,
  };
};

export type EnsNameDetails = ReturnType<typeof useEnsNameDetails>;
