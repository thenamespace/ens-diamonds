"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useWindowVirtualizer } from "@tanstack/react-virtual";

import { Spinner } from "@thenamespace/uikit";
import { useMediaQuery } from "usehooks-ts";

import { NameGridCard, NameListCard } from "@/components/cards";
import type { PremiumName } from "@/lib/ens";
import type { PremiumNameView } from "@/lib/search-params";

type VirtualizedNameResultsProps = {
  ethUsd: bigint | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isPricePending: boolean;
  names: PremiumName[];
  prices: Map<string, bigint>;
  view: PremiumNameView;
  onLoadMore: () => void;
};

export const VirtualizedNameResults = (props: VirtualizedNameResultsProps) => (
  <div aria-label="Premium ENS names" role="feed">
    {props.view === "grid" ? <VirtualizedGrid {...props} /> : <VirtualizedList {...props} />}
    {props.isFetchingNextPage ? (
      <div className="flex justify-center py-8">
        <Spinner aria-label="Loading more premium names" />
      </div>
    ) : null}
    {!props.hasNextPage ? (
      <p className="py-8 text-center text-sm text-muted">You’ve reached the end.</p>
    ) : null}
  </div>
);

const VirtualizedGrid = (props: VirtualizedNameResultsProps) => {
  const columns = useGridColumns();
  const rows = Math.ceil(props.names.length / columns);
  const { containerRef, scrollMargin } = useVirtualContainer(columns);
  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: rows,
    directDomUpdates: true,
    estimateSize: () => 308,
    overscan: 3,
    scrollMargin,
  });
  const virtualRows = virtualizer.getVirtualItems();

  useLoadNextPage({
    count: rows,
    hasNextPage: props.hasNextPage,
    isFetchingNextPage: props.isFetchingNextPage,
    lastVisibleIndex: virtualRows.at(-1)?.index,
    onLoadMore: props.onLoadMore,
  });

  return (
    <div className="-mt-3 pt-3" ref={containerRef}>
      <div className="relative w-full" ref={virtualizer.containerRef}>
        {virtualRows.map((virtualRow) => {
          const start = virtualRow.index * columns;
          const names = props.names.slice(start, start + columns);

          return (
            <div
              className={`absolute top-0 left-0 grid w-full gap-4 pb-4 ${GRID_COLUMN_CLASSES[columns]}`}
              data-index={virtualRow.index}
              key={virtualRow.key}
              ref={virtualizer.measureElement}
            >
              {names.map((name) => (
                <NameGridCard
                  ethUsd={props.ethUsd}
                  isPricePending={props.isPricePending}
                  key={name.labelhash}
                  name={name}
                  price={props.prices.get(name.label)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const VirtualizedList = (props: VirtualizedNameResultsProps) => {
  const { containerRef, scrollMargin } = useVirtualContainer(props.names.length);
  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: props.names.length,
    directDomUpdates: true,
    estimateSize: () => 92,
    overscan: 5,
    scrollMargin,
  });
  const virtualRows = virtualizer.getVirtualItems();

  useLoadNextPage({
    count: props.names.length,
    hasNextPage: props.hasNextPage,
    isFetchingNextPage: props.isFetchingNextPage,
    lastVisibleIndex: virtualRows.at(-1)?.index,
    onLoadMore: props.onLoadMore,
  });

  return (
    <div ref={containerRef}>
      <div className="relative w-full" ref={virtualizer.containerRef}>
        {virtualRows.map((virtualRow) => {
          const name = props.names[virtualRow.index];
          if (!name) return null;

          return (
            <div
              className="absolute top-0 left-0 w-full pb-3"
              data-index={virtualRow.index}
              key={virtualRow.key}
              ref={virtualizer.measureElement}
            >
              <NameListCard
                ethUsd={props.ethUsd}
                isPricePending={props.isPricePending}
                name={name}
                price={props.prices.get(name.label)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GRID_COLUMN_CLASSES: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

function useGridColumns() {
  const isSmall = useMediaQuery("(min-width: 640px)");
  const isLarge = useMediaQuery("(min-width: 1024px)");
  const isExtraLarge = useMediaQuery("(min-width: 1280px)");

  if (isExtraLarge) return 4;
  if (isLarge) return 3;
  if (isSmall) return 2;
  return 1;
}

function useVirtualContainer(layoutKey: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    setScrollMargin(element.getBoundingClientRect().top + window.scrollY);
  }, [layoutKey]);

  return { containerRef, scrollMargin };
}

function useLoadNextPage({
  count,
  hasNextPage,
  isFetchingNextPage,
  lastVisibleIndex,
  onLoadMore,
}: {
  count: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  lastVisibleIndex: number | undefined;
  onLoadMore: () => void;
}) {
  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      lastVisibleIndex !== undefined &&
      lastVisibleIndex >= count - 2
    ) {
      onLoadMore();
    }
  }, [count, hasNextPage, isFetchingNextPage, lastVisibleIndex, onLoadMore]);
}
