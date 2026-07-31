"use client";

import { useMemo } from "react";

import { Button, EmptyState } from "@thenamespace/uikit";
import { HugeiconsIcon, Search01Icon } from "@thenamespace/uikit/icons";
import InfiniteScroll from "react-infinite-scroll-component";

import { useEnsNamePrices, useEthPrice } from "@/hooks";
import type { PremiumName } from "@/lib/ens";
import type { PremiumNameView } from "@/lib/search-params";

import { NameGridCard, NameGridCardSkeleton, NameListCard, NameListCardSkeleton } from "../cards";

const END_MESSAGE = <p className="py-8 text-center text-sm text-muted">You’ve reached the end.</p>;
const INFINITE_SCROLL_STYLE = { overflow: "visible" } as const;

type PremiumNameResultsProps = {
  names: PremiumName[];
  view: PremiumNameView;
  isPending: boolean;
  isError: boolean;
  hasFilters: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onReset: () => void;
  onRetry: () => void;
};

export const PremiumNameResults = ({
  names,
  view,
  isPending,
  isError,
  hasFilters,
  hasNextPage,
  onLoadMore,
  onReset,
  onRetry,
}: PremiumNameResultsProps) => {
  if (isPending) return <NameSkeletons view={view} />;

  if (isError) {
    return (
      <QueryState
        action="Try again"
        description="The ENS index could not be reached. Your filters are still applied."
        title="Premium names are unavailable"
        onAction={onRetry}
      />
    );
  }

  if (names.length === 0) {
    return (
      <QueryState
        description={
          hasFilters
            ? "Try a broader name match or a longer availability window."
            : "There are no names in the premium period right now."
        }
        title="No premium names found"
        {...(hasFilters ? { action: "Clear filters", onAction: onReset } : {})}
      />
    );
  }

  return (
    <LoadedPremiumNameResults
      hasNextPage={hasNextPage}
      names={names}
      view={view}
      onLoadMore={onLoadMore}
    />
  );
};

const LoadedPremiumNameResults = ({
  names,
  view,
  hasNextPage,
  onLoadMore,
}: Pick<PremiumNameResultsProps, "names" | "view" | "hasNextPage" | "onLoadMore">) => {
  const labels = useMemo(() => names.map(({ label }) => label), [names]);
  const priceQuery = useEnsNamePrices(labels);
  const ethPriceQuery = useEthPrice();
  const nextPageLoader = useMemo(
    () => <NameSkeletons count={view === "grid" ? 4 : 3} view={view} />,
    [view],
  );
  const isPricePending = priceQuery.isPending || ethPriceQuery.isPending;

  return (
    <InfiniteScroll
      aria-label="Premium ENS names"
      dataLength={names.length}
      endMessage={END_MESSAGE}
      hasMore={hasNextPage}
      loader={nextPageLoader}
      next={onLoadMore}
      role="feed"
      scrollThreshold="400px"
      style={INFINITE_SCROLL_STYLE}
    >
      {view === "grid" ? (
        <div className="-mt-3 grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {names.map((name) => (
            <NameGridCard
              ethUsd={ethPriceQuery.data}
              isPricePending={isPricePending}
              key={name.labelhash}
              name={name}
              price={priceQuery.prices.get(name.label)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {names.map((name) => (
            <NameListCard
              ethUsd={ethPriceQuery.data}
              isPricePending={isPricePending}
              key={name.labelhash}
              name={name}
              price={priceQuery.prices.get(name.label)}
            />
          ))}
        </div>
      )}
    </InfiniteScroll>
  );
};

const NameSkeletons = ({ view, count }: { view: PremiumNameView; count?: number }) =>
  view === "grid" ? (
    <NameGridCardSkeleton {...(count === undefined ? {} : { count })} />
  ) : (
    <NameListCardSkeleton {...(count === undefined ? {} : { count })} />
  );

const QueryState = ({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) => (
  <EmptyState className="min-h-80 rounded-2xl border border-dashed border-default bg-surface">
    <EmptyState.Media>
      <HugeiconsIcon icon={Search01Icon} width={24} />
    </EmptyState.Media>
    <EmptyState.Header>
      <EmptyState.Title>{title}</EmptyState.Title>
      <EmptyState.Description>{description}</EmptyState.Description>
    </EmptyState.Header>
    {action && onAction ? (
      <EmptyState.Content>
        <Button variant="secondary" onPress={onAction}>
          {action}
        </Button>
      </EmptyState.Content>
    ) : null}
  </EmptyState>
);
