"use client";

import { useMemo } from "react";

import { useQueries } from "@tanstack/react-query";

import { SECONDS_PER_DAY } from "@/lib/constants";
import { activeChain } from "@/lib/network";

const BATCH_SIZE = 24;
const CACHE_TIME = 5 * 60_000;
const GRACE_PERIOD_SECONDS = 90 * SECONDS_PER_DAY;
const PREMIUM_PERIOD_SECONDS = 21 * SECONDS_PER_DAY;

type NameStatusResult = Record<
  string,
  {
    isAvailable: boolean | null;
    registrationExpiresAt: string | null;
  }
>;

export type FavouriteNameDetails = {
  availableAt: number | undefined;
  isAvailable: boolean | undefined;
  label: string;
  premiumStartsAt: number | undefined;
};

export const useFavouriteNameDetails = (labels: string[]) => {
  const batches = useMemo(() => chunkLabels(labels), [labels]);
  const queries = useQueries({
    queries: batches.map((batch) => ({
      gcTime: 6 * CACHE_TIME,
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchNameStatuses(batch, signal),
      queryKey: ["ens-name-statuses", activeChain.id, batch],
      staleTime: CACHE_TIME,
    })),
  });
  const statuses = useMemo(
    () => Object.assign({}, ...queries.map(({ data }) => data ?? {})) as NameStatusResult,
    [queries],
  );
  const names = useMemo(
    () =>
      labels.map((label): FavouriteNameDetails => {
        const status = statuses[label];
        const registrationExpiresAt = status?.registrationExpiresAt
          ? Number(status.registrationExpiresAt)
          : undefined;
        const premiumStartsAt =
          registrationExpiresAt && registrationExpiresAt > 0
            ? registrationExpiresAt + GRACE_PERIOD_SECONDS
            : undefined;

        return {
          availableAt:
            premiumStartsAt === undefined ? undefined : premiumStartsAt + PREMIUM_PERIOD_SECONDS,
          isAvailable: status?.isAvailable ?? undefined,
          label,
          premiumStartsAt,
        };
      }),
    [labels, statuses],
  );

  return {
    isError: queries.some(({ isError }) => isError),
    isPending: queries.some(({ isPending }) => isPending),
    names,
  };
};

async function fetchNameStatuses(labels: string[], signal: AbortSignal): Promise<NameStatusResult> {
  const parameters = new URLSearchParams();
  for (const label of labels) parameters.append("label", label);

  const response = await fetch(`/api/ens/name-statuses?${parameters}`, { signal });
  if (!response.ok) throw new Error("Name statuses are unavailable");

  return response.json() as Promise<NameStatusResult>;
}

function chunkLabels(labels: string[]) {
  const uniqueLabels = [...new Set(labels)];
  const chunks: string[][] = [];

  for (let index = 0; index < uniqueLabels.length; index += BATCH_SIZE) {
    chunks.push(uniqueLabels.slice(index, index + BATCH_SIZE));
  }

  return chunks;
}
