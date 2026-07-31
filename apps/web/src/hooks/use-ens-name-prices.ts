"use client";

import { useMemo } from "react";

import { addresses, ethRegistrarControllerRentPriceSnippet } from "@ensdomains/ensjs/contracts";
import { useReadContracts } from "wagmi";
import { mainnet } from "wagmi/chains";

import { SECONDS_PER_YEAR } from "@/lib/constants";

export const useEnsNamePrices = (labels: string[]) => {
  const contracts = useMemo(
    () =>
      labels.map((label) => ({
        abi: ethRegistrarControllerRentPriceSnippet,
        address: addresses[mainnet.id].ensEthRegistrarController.address,
        functionName: "rentPrice" as const,
        args: [label, BigInt(SECONDS_PER_YEAR)] as const,
        chainId: mainnet.id,
      })),
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

  const prices = useMemo(() => {
    const values = new Map<string, bigint>();

    query.data?.forEach((result, index) => {
      if (result.status !== "success") return;

      const label = labels[index];
      if (!label) return;

      values.set(label, result.result.base + result.result.premium);
    });

    return values;
  }, [labels, query.data]);

  return {
    prices,
    isPending: query.isPending,
  };
};
