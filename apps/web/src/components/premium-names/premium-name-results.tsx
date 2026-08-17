"use client";

import { useMemo } from "react";

import {
  Button,
  EmptyState,
  EmptyStateContent,
  EmptyStateDescription,
  EmptyStateHeader,
  EmptyStateMedia,
  Spinner,
  Typography,
} from "@thenamespace/uikit";
import { HugeiconsIcon, Search01Icon } from "@thenamespace/uikit/icons";
import InfiniteScroll from "react-infinite-scroll-component";

import {
  NameGridCard,
  NameGridCardSkeleton,
  NameListCard,
  NameListCardSkeleton,
} from "@/components/cards";
import { useEnsNamePrices } from "@/hooks";
import type { PremiumName } from "@/lib/ens";
import type { PremiumNameView } from "@/lib/search-params";

const END_MESSAGE = <p className="py-8 text-center text-sm text-muted">You’ve reached the end.</p>;
const NEXT_PAGE_LOADER = (
  <div className="flex justify-center py-8">
    <Spinner aria-label="Loading more premium names" />
  </div>
);
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

  return (
    <InfiniteScroll
      aria-label="Premium ENS names"
      dataLength={names.length}
      endMessage={END_MESSAGE}
      hasMore={hasNextPage}
      loader={NEXT_PAGE_LOADER}
      next={onLoadMore}
      role="feed"
      scrollThreshold="400px"
      style={INFINITE_SCROLL_STYLE}
    >
      {view === "grid" ? (
        <div className="-mt-3 grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {names.map((name) => (
            <NameGridCard
              ethUsd={priceQuery.ethUsd}
              isPricePending={priceQuery.isPending}
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
              ethUsd={priceQuery.ethUsd}
              isPricePending={priceQuery.isPending}
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
    <EmptyStateMedia variant="icon">
      <HugeiconsIcon aria-hidden icon={Search01Icon} width={22} />
    </EmptyStateMedia>
    <EmptyStateHeader>
      <Typography.Heading className="empty-state__title text-balance" level={2}>
        {title}
      </Typography.Heading>
      <EmptyStateDescription>{description}</EmptyStateDescription>
    </EmptyStateHeader>
    {action && onAction ? (
      <EmptyStateContent>
        <Button variant="secondary" onPress={onAction}>
          {action}
        </Button>
      </EmptyStateContent>
    ) : null}
  </EmptyState>
);
