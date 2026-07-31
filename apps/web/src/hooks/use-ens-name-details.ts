"use client";

import { useMemo } from "react";

import {
  addresses,
  baseRegistrarAvailableSnippet,
  baseRegistrarNameExpiresSnippet,
  ethRegistrarControllerRentPriceSnippet,
} from "@ensdomains/ensjs/contracts";
import { keccak256, toBytes } from "viem";
import { useReadContracts } from "wagmi";
import { mainnet } from "wagmi/chains";

import { SECONDS_PER_DAY, SECONDS_PER_YEAR } from "@/lib/constants";

import { useEthPrice } from "./use-eth-price";

type UseEnsNameDetailsProps = {
  label: string;
};

const contracts = addresses[mainnet.id];
const GRACE_PERIOD_SECONDS = 90 * SECONDS_PER_DAY;
const PREMIUM_PERIOD_SECONDS = 21 * SECONDS_PER_DAY;

export const useEnsNameDetails = ({ label }: UseEnsNameDetailsProps) => {
  const tokenId = useMemo(() => BigInt(keccak256(toBytes(label))), [label]);
  const nameContracts = useMemo(
    () =>
      [
        {
          abi: ethRegistrarControllerRentPriceSnippet,
          address: contracts.ensEthRegistrarController.address,
          functionName: "rentPrice",
          args: [label, BigInt(SECONDS_PER_YEAR)],
          chainId: mainnet.id,
        },
        {
          abi: baseRegistrarAvailableSnippet,
          address: contracts.ensBaseRegistrarImplementation.address,
          functionName: "available",
          args: [tokenId],
          chainId: mainnet.id,
        },
        {
          abi: baseRegistrarNameExpiresSnippet,
          address: contracts.ensBaseRegistrarImplementation.address,
          functionName: "nameExpires",
          args: [tokenId],
          chainId: mainnet.id,
        },
      ] as const,
    [label, tokenId],
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
