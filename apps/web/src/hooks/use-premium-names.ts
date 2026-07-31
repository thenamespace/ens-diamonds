"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import type { PremiumNameMatch, PremiumNamesFilters, PremiumNamesPage } from "@/lib/ens";

const DEFAULT_PAGE_SIZE = 24;

type UsePremiumNamesOptions = {
  filters?: PremiumNamesFilters;
  limit?: number;
};

type ApiError = {
  error?: string;
};

export const usePremiumNames = ({
  filters,
  limit = DEFAULT_PAGE_SIZE,
}: UsePremiumNamesOptions = {}) => {
  return useInfiniteQuery({
    queryKey: ["premium-names", filters, limit],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      fetchPremiumNames({
        limit,
        cursor: pageParam,
        signal,
        ...(filters === undefined ? {} : { filters }),
      }),
    getNextPageParam: (page) =>
      page.pageInfo.hasNextPage ? (page.pageInfo.endCursor ?? undefined) : undefined,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
};

async function fetchPremiumNames({
  filters,
  limit,
  cursor,
  signal,
}: {
  filters?: PremiumNamesFilters;
  limit: number;
  cursor: string | null;
  signal: AbortSignal;
}): Promise<PremiumNamesPage> {
  const parameters = new URLSearchParams({ limit: String(limit) });

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
