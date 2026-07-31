"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { useQueryState, useQueryStates } from "nuqs";
import { useDebounceCallback } from "usehooks-ts";

import { usePremiumNames } from "@/hooks";
import {
  getPremiumNameDateBounds,
  getPremiumNameDateRange,
  premiumNameFilterParsers,
  premiumNameViewParser,
  toPremiumNamesFilters,
  type PremiumNameDateRange,
  type PremiumNameOrder,
  type PremiumNameView,
} from "@/lib/search-params";

import { PremiumNameFilters } from "./premium-name-filters";
import { PremiumNameHeader } from "./premium-name-header";
import { PremiumNameResults } from "./premium-name-results";

type PremiumNameBrowserProps = {
  asOf: number;
};

export const PremiumNameBrowser = ({ asOf }: PremiumNameBrowserProps) => {
  const [isNavigating, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(premiumNameFilterParsers, {
    history: "replace",
    shallow: false,
    startTransition,
  });
  const [view, setView] = useQueryState("view", premiumNameViewParser);
  const [nameInput, setNameInput] = useState(search.name);
  const updateName = useDebounceCallback(
    (name: string) => void setSearch({ name: name || null }),
    300,
  );

  useEffect(() => setNameInput(search.name), [search.name]);

  const filters = useMemo(() => toPremiumNamesFilters(search, asOf), [asOf, search]);
  const dateBounds = useMemo(() => getPremiumNameDateBounds(asOf), [asOf]);
  const dateRange = useMemo(() => getPremiumNameDateRange(search, asOf), [asOf, search]);
  const query = usePremiumNames({
    filters,
    enabled: !isNavigating,
    order: search.order,
  });
  const names = useMemo(
    () => query.data?.pages.flatMap((page) => page.names) ?? [],
    [query.data?.pages],
  );
  const hasFilters = Boolean(
    search.name ||
    search.availableFrom !== null ||
    search.availableTo !== null ||
    search.order !== "desc",
  );
  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = query;

  const handleNameChange = useCallback(
    (name: string) => {
      setNameInput(name);
      updateName(name.trim());
    },
    [updateName],
  );
  const handleNameMatchChange = useCallback(
    (match: typeof search.match) => void setSearch({ match }),
    [setSearch],
  );
  const handleDateRangeChange = useCallback(
    ({ start, end }: PremiumNameDateRange) =>
      void setSearch({ availableFrom: start, availableTo: end }),
    [setSearch],
  );
  const handleOrderChange = useCallback(
    (order: PremiumNameOrder) => void setSearch({ order }),
    [setSearch],
  );
  const handleViewChange = useCallback(
    (nextView: PremiumNameView) => void setView(nextView),
    [setView],
  );
  const resetFilters = useCallback(() => {
    updateName.cancel();
    setNameInput("");
    void setSearch({
      name: null,
      match: null,
      availableFrom: null,
      availableTo: null,
      order: null,
    });
  }, [setSearch, updateName]);
  const retry = useCallback(() => void refetch(), [refetch]);
  const loadNextPage = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <PremiumNameHeader />
      <PremiumNameFilters
        dateBounds={dateBounds}
        dateRange={dateRange}
        name={nameInput}
        nameMatch={search.match}
        order={search.order}
        view={view}
        onDateRangeChange={handleDateRangeChange}
        onNameChange={handleNameChange}
        onNameMatchChange={handleNameMatchChange}
        onOrderChange={handleOrderChange}
        onViewChange={handleViewChange}
      />
      <PremiumNameResults
        hasFilters={hasFilters}
        hasNextPage={query.hasNextPage}
        isError={query.isError}
        isPending={query.isPending || isNavigating}
        names={names}
        view={view}
        onLoadMore={loadNextPage}
        onReset={resetFilters}
        onRetry={retry}
      />
    </main>
  );
};
