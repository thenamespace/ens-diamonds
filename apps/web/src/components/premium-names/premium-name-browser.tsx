"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { useQueryState, useQueryStates } from "nuqs";
import { useDebounceCallback } from "usehooks-ts";

import { PageMain } from "@/components/common";
import { usePremiumNames } from "@/hooks";
import {
  getPremiumNameDateBounds,
  getPremiumNameDateRange,
  premiumNameFilterParsers,
  premiumNameViewParser,
  toPremiumNamesFilters,
  type PremiumNameDateRange,
  type PremiumNameSort,
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
  const latestRequestedName = useRef(search.name);
  const updateNameSearchParam = useCallback(
    (name: string) => {
      latestRequestedName.current = name;
      void setSearch({ name: name || null });
    },
    [setSearch],
  );
  const updateName = useDebounceCallback(updateNameSearchParam, 300);

  useEffect(() => {
    if (search.name === latestRequestedName.current) return;

    updateName.cancel();
    latestRequestedName.current = search.name;
    setNameInput(search.name);
  }, [search.name, updateName]);

  const filters = useMemo(() => toPremiumNamesFilters(search, asOf), [asOf, search]);
  const dateBounds = useMemo(() => getPremiumNameDateBounds(asOf), [asOf]);
  const dateRange = useMemo(() => getPremiumNameDateRange(search, asOf), [asOf, search]);
  const query = usePremiumNames({
    filters,
    enabled: !isNavigating,
    sort: search.sort,
  });
  const names = useMemo(
    () => query.data?.pages.flatMap((page) => page.names) ?? [],
    [query.data?.pages],
  );
  const hasFilters = Boolean(
    search.name || search.availableFrom !== null || search.availableTo !== null,
  );
  const filterCount =
    Number(Boolean(search.name && search.match !== "contains")) +
    Number(search.availableFrom !== null || search.availableTo !== null);
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
  const handleSortChange = useCallback(
    (sort: PremiumNameSort) => void setSearch({ sort }),
    [setSearch],
  );
  const handleViewChange = useCallback(
    (nextView: PremiumNameView) => void setView(nextView),
    [setView],
  );
  const resetFilters = useCallback(() => {
    updateName.cancel();
    latestRequestedName.current = "";
    setNameInput("");
    void setSearch({
      name: null,
      match: null,
      availableFrom: null,
      availableTo: null,
    });
  }, [setSearch, updateName]);
  const clearAdvancedFilters = useCallback(
    () =>
      void setSearch({
        match: null,
        availableFrom: null,
        availableTo: null,
      }),
    [setSearch],
  );
  const retry = useCallback(() => void refetch(), [refetch]);
  const loadNextPage = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <PageMain>
      <PremiumNameHeader />
      <PremiumNameFilters
        dateBounds={dateBounds}
        dateRange={dateRange}
        filterCount={filterCount}
        name={nameInput}
        nameMatch={search.match}
        sort={search.sort}
        view={view}
        onClearFilters={clearAdvancedFilters}
        onDateRangeChange={handleDateRangeChange}
        onNameChange={handleNameChange}
        onNameMatchChange={handleNameMatchChange}
        onSortChange={handleSortChange}
        onViewChange={handleViewChange}
      />
      <PremiumNameResults
        hasFilters={hasFilters}
        hasNextPage={query.hasNextPage}
        isError={query.isError}
        isFetchingNextPage={query.isFetchingNextPage}
        isPending={query.isPending || isNavigating}
        names={names}
        view={view}
        onLoadMore={loadNextPage}
        onReset={resetFilters}
        onRetry={retry}
      />
    </PageMain>
  );
};
