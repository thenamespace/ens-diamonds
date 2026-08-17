"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import {
  getNextPremiumNamesPage,
  PREMIUM_NAMES_PAGE_SIZE,
  premiumNamesQueryKey,
  type PremiumNameMatch,
  type PremiumNameSort,
  type PremiumNamesFilters,
  type PremiumNamesPage,
} from "@/lib/ens";

type UsePremiumNamesOptions = {
  filters?: PremiumNamesFilters;
  limit?: number;
  enabled?: boolean;
  sort?: PremiumNameSort;
};

type ApiError = {
  error?: string;
};

const CACHE_TIME = 5 * 60_000;

export const usePremiumNames = ({
  filters,
  limit = PREMIUM_NAMES_PAGE_SIZE,
  enabled = true,
  sort = "ending",
}: UsePremiumNamesOptions = {}) => {
  const resolvedFilters = filters ?? {};

  return useInfiniteQuery({
    queryKey: premiumNamesQueryKey(resolvedFilters, sort, limit),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      fetchPremiumNames({
        limit,
        cursor: pageParam,
        sort,
        signal,
        filters: resolvedFilters,
      }),
    getNextPageParam: getNextPremiumNamesPage,
    enabled,
    staleTime: CACHE_TIME,
    gcTime: CACHE_TIME,
    retry: 2,
  });
};

async function fetchPremiumNames({
  filters,
  limit,
  cursor,
  sort,
  signal,
}: {
  filters?: PremiumNamesFilters;
  limit: number;
  cursor: string | null;
  sort: PremiumNameSort;
  signal: AbortSignal;
}): Promise<PremiumNamesPage> {
  const parameters = new URLSearchParams({ limit: String(limit) });
  parameters.set("sort", sort);

  if (cursor) parameters.set("cursor", cursor);
  appendNameFilter(parameters, filters?.name);

  if (filters?.availableAt?.from !== undefined) {
    parameters.set("availableFrom", String(filters.availableAt.from));
  }
  if (filters?.availableAt?.to !== undefined) {
    parameters.set("availableTo", String(filters.availableAt.to));
  }

  const response = await fetch(`/api/ens/premium-names?${parameters}`, { signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error ?? "Unable to load premium names");
  }

  return (await response.json()) as PremiumNamesPage;
}

function appendNameFilter(
  parameters: URLSearchParams,
  name: { match: PremiumNameMatch; value: string } | undefined,
) {
  if (!name) return;

  parameters.set("name", name.value);
  parameters.set("match", name.match);
}
