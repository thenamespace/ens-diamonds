"use client";

import { useMemo } from "react";

import { useQueries } from "@tanstack/react-query";

import { activeChain } from "@/lib/network";

const PRICE_BATCH_SIZE = 24;
const PRICE_CACHE_TIME = 5 * 60_000;

type NamePriceResult = {
  ethUsd: string | null;
  prices: Record<string, string>;
};

export const useEnsNamePrices = (labels: string[]) => {
  const batches = useMemo(() => chunkLabels(labels), [labels]);
  const queries = useQueries({
    queries: batches.map((batch) => ({
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchNamePrices(batch, signal),
      queryKey: ["ens-name-prices", activeChain.id, batch],
      staleTime: PRICE_CACHE_TIME,
      gcTime: 6 * PRICE_CACHE_TIME,
    })),
  });

  const prices = useMemo(() => {
    const values = new Map<string, bigint>();

    for (const query of queries) {
      if (!query.data) continue;
      for (const [label, value] of Object.entries(query.data.prices)) {
        values.set(label, BigInt(value));
      }
    }

    return values;
  }, [queries]);
  const ethUsd = queries.find(({ data }) => data?.ethUsd)?.data?.ethUsd;

  return {
    ethUsd: ethUsd ? BigInt(ethUsd) : undefined,
    prices,
    isPending: queries.some(({ isPending }) => isPending),
  };
};

async function fetchNamePrices(labels: string[], signal: AbortSignal): Promise<NamePriceResult> {
  const parameters = new URLSearchParams();
  for (const label of labels) parameters.append("label", label);

  const response = await fetch(`/api/ens/name-prices?${parameters}`, { signal });
  if (!response.ok) throw new Error("Name prices are unavailable");

  return response.json() as Promise<NamePriceResult>;
}

function chunkLabels(labels: string[]) {
  const uniqueLabels = [...new Set(labels)];
  const chunks: string[][] = [];

  for (let index = 0; index < uniqueLabels.length; index += PRICE_BATCH_SIZE) {
    chunks.push(uniqueLabels.slice(index, index + PRICE_BATCH_SIZE));
  }

  return chunks;
}
