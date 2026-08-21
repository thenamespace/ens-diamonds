"use client";

import { useMemo } from "react";

import {
  Button,
  EmptyState,
  EmptyStateContent,
  EmptyStateDescription,
  EmptyStateHeader,
  EmptyStateMedia,
  Typography,
} from "@thenamespace/uikit";
import { HugeiconsIcon, Search01Icon } from "@thenamespace/uikit/icons";

import { NameGridCardSkeleton, NameListCardSkeleton } from "@/components/cards";
import { useEnsNamePrices } from "@/hooks";
import type { PremiumName } from "@/lib/ens";
import type { PremiumNameView } from "@/lib/search-params";

import { VirtualizedNameResults } from "./virtualized-name-results";

type PremiumNameResultsProps = {
  names: PremiumName[];
  now: number;
  view: PremiumNameView;
  isPending: boolean;
  isError: boolean;
  hasFilters: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onReset: () => void;
  onRetry: () => void;
};

export const PremiumNameResults = ({
  names,
  now,
  view,
  isPending,
  isError,
  hasFilters,
  hasNextPage,
  isFetchingNextPage,
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
      isFetchingNextPage={isFetchingNextPage}
      names={names}
      now={now}
      view={view}
      onLoadMore={onLoadMore}
    />
  );
};

const LoadedPremiumNameResults = ({
  names,
  now,
  view,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Pick<
  PremiumNameResultsProps,
  "names" | "now" | "view" | "hasNextPage" | "isFetchingNextPage" | "onLoadMore"
>) => {
  const labels = useMemo(() => names.map(({ label }) => label), [names]);
  const priceQuery = useEnsNamePrices(labels);

  return (
    <VirtualizedNameResults
      ethUsd={priceQuery.ethUsd}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isPricePending={priceQuery.isPending}
      names={names}
      now={now}
      prices={priceQuery.prices}
      view={view}
      onLoadMore={onLoadMore}
    />
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
