"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import {
  getNextPremiumNamesPage,
  PREMIUM_NAMES_PAGE_SIZE,
  premiumNamesQueryKey,
  type PremiumNameMatch,
  type PremiumNameOrder,
  type PremiumNamesFilters,
  type PremiumNamesPage,
} from "@/lib/ens";

type UsePremiumNamesOptions = {
  filters?: PremiumNamesFilters;
  limit?: number;
  enabled?: boolean;
  order?: PremiumNameOrder;
};

type ApiError = {
  error?: string;
};

export const usePremiumNames = ({
  filters,
  limit = PREMIUM_NAMES_PAGE_SIZE,
  enabled = true,
  order = "desc",
}: UsePremiumNamesOptions = {}) => {
  const resolvedFilters = filters ?? {};

  return useInfiniteQuery({
    queryKey: premiumNamesQueryKey(resolvedFilters, order, limit),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      fetchPremiumNames({
        limit,
        cursor: pageParam,
        order,
        signal,
        filters: resolvedFilters,
      }),
    getNextPageParam: getNextPremiumNamesPage,
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
};

async function fetchPremiumNames({
  filters,
  limit,
  cursor,
  order,
  signal,
}: {
  filters?: PremiumNamesFilters;
  limit: number;
  cursor: string | null;
  order: PremiumNameOrder;
  signal: AbortSignal;
}): Promise<PremiumNamesPage> {
  const parameters = new URLSearchParams({ limit: String(limit) });
  parameters.set("order", order);

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
