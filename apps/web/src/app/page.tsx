"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Button,
  EmptyState,
  Label,
  ListBox,
  SearchField,
  Select,
  ToggleButton,
  ToggleButtonGroup,
} from "@thenamespace/uikit";
import { GridViewIcon, HugeiconsIcon, ListViewIcon, Search01Icon } from "@thenamespace/uikit/icons";
import InfiniteScroll from "react-infinite-scroll-component";

import {
  NameCard,
  NameListItem,
  PremiumNameGridSkeleton,
  PremiumNameListSkeleton,
} from "@/components";
import { usePremiumNames } from "@/hooks";
import type { PremiumNameMatch, PremiumNamesFilters } from "@/lib/ens";

const DAY_SECONDS = 24 * 60 * 60;
const AVAILABILITY_OPTIONS = [
  { id: "any", label: "Any time", seconds: null },
  { id: "1-day", label: "Within 24 hours", seconds: DAY_SECONDS },
  { id: "3-days", label: "Within 3 days", seconds: 3 * DAY_SECONDS },
  { id: "7-days", label: "Within 7 days", seconds: 7 * DAY_SECONDS },
  { id: "14-days", label: "Within 14 days", seconds: 14 * DAY_SECONDS },
] as const;
const NAME_MATCH_OPTIONS: Array<{ id: PremiumNameMatch; label: string }> = [
  { id: "contains", label: "Contains" },
  { id: "startsWith", label: "Starts with" },
  { id: "exact", label: "Is exactly" },
];
const END_MESSAGE = <p className="py-8 text-center text-sm text-muted">You’ve reached the end.</p>;

type Availability = (typeof AVAILABILITY_OPTIONS)[number]["id"];
type ViewMode = "grid" | "list";

export default function Home() {
  const [name, setName] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [nameMatch, setNameMatch] = useState<PremiumNameMatch>("contains");
  const [availability, setAvailability] = useState<Availability>("any");
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedName(name.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [name]);

  const filters = useMemo<PremiumNamesFilters>(() => {
    const seconds = AVAILABILITY_OPTIONS.find((option) => option.id === availability)?.seconds;

    return {
      ...(debouncedName
        ? {
            name: {
              match: nameMatch,
              value: debouncedName,
            },
          }
        : {}),
      ...(seconds
        ? {
            availableAt: {
              to: Math.floor(Date.now() / 1000) + seconds,
            },
          }
        : {}),
    };
  }, [availability, debouncedName, nameMatch]);

  const query = usePremiumNames({ filters });
  const names = query.data?.pages.flatMap((page) => page.names) ?? [];
  const hasFilters = Boolean(name || availability !== "any");
  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = query;
  const selectedView = useMemo(() => [view], [view]);
  const nextPageLoader = useMemo(
    () => <NameSkeletons count={view === "grid" ? 4 : 3} view={view} />,
    [view],
  );

  const resetFilters = useCallback(() => {
    setName("");
    setDebouncedName("");
    setNameMatch("contains");
    setAvailability("any");
  }, []);
  const handleNameMatch = useCallback((key: React.Key | null) => {
    if (key) setNameMatch(key as PremiumNameMatch);
  }, []);
  const handleAvailability = useCallback((key: React.Key | null) => {
    if (key) setAvailability(key as Availability);
  }, []);
  const handleView = useCallback((keys: Set<React.Key>) => {
    const selected = [...keys][0];
    if (selected === "grid" || selected === "list") setView(selected);
  }, []);
  const retry = useCallback(() => void refetch(), [refetch]);
  const loadNextPage = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Premium names
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Discover expired .eth names as their temporary premium decays.
          </p>
        </div>
        {!query.isPending && !query.isError ? (
          <p aria-live="polite" className="text-sm tabular-nums text-muted">
            {names.length} {names.length === 1 ? "name" : "names"} loaded
          </p>
        ) : null}
      </header>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-default bg-surface p-3 shadow-xs lg:flex-row lg:items-end">
        <SearchField className="min-w-0 flex-1" value={name} onChange={setName}>
          <Label className="sr-only">Name</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter by name…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(10rem,12rem)_minmax(11rem,13rem)_auto]">
          <Select
            aria-label="Name match"
            selectedKey={nameMatch}
            onSelectionChange={handleNameMatch}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={NAME_MATCH_OPTIONS}>
                {(item) => (
                  <ListBox.Item id={item.id} textValue={item.label}>
                    {item.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                )}
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            aria-label="Available in"
            selectedKey={availability}
            onSelectionChange={handleAvailability}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={AVAILABILITY_OPTIONS}>
                {(item) => (
                  <ListBox.Item id={item.id} textValue={item.label}>
                    {item.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                )}
              </ListBox>
            </Select.Popover>
          </Select>

          <ToggleButtonGroup
            aria-label="View"
            className="col-span-2 justify-self-end sm:col-span-1"
            disallowEmptySelection
            selectedKeys={selectedView}
            selectionMode="single"
            onSelectionChange={handleView}
          >
            <ToggleButton aria-label="Grid view" id="grid" isIconOnly>
              <HugeiconsIcon icon={GridViewIcon} width={18} />
            </ToggleButton>
            <ToggleButton aria-label="List view" id="list" isIconOnly>
              <HugeiconsIcon icon={ListViewIcon} width={18} />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
      </div>

      {query.isPending ? (
        <NameSkeletons view={view} />
      ) : query.isError ? (
        <QueryState
          action="Try again"
          description="The ENS index could not be reached. Your filters are still applied."
          title="Premium names are unavailable"
          onAction={retry}
        />
      ) : names.length === 0 ? (
        <QueryState
          description={
            hasFilters
              ? "Try a broader name match or a longer availability window."
              : "There are no names in the premium period right now."
          }
          title="No premium names found"
          {...(hasFilters ? { action: "Clear filters", onAction: resetFilters } : {})}
        />
      ) : (
        <InfiniteScroll
          aria-label="Premium ENS names"
          dataLength={names.length}
          endMessage={END_MESSAGE}
          hasMore={query.hasNextPage}
          loader={nextPageLoader}
          next={loadNextPage}
          role="feed"
          scrollThreshold="400px"
        >
          {view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {names.map((premiumName) => (
                <NameCard key={premiumName.labelhash} {...premiumName} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {names.map((premiumName) => (
                <NameListItem key={premiumName.labelhash} {...premiumName} />
              ))}
            </div>
          )}
        </InfiniteScroll>
      )}
    </main>
  );
}

const NameSkeletons = ({ view, count }: { view: ViewMode; count?: number }) =>
  view === "grid" ? (
    <PremiumNameGridSkeleton {...(count === undefined ? {} : { count })} />
  ) : (
    <PremiumNameListSkeleton {...(count === undefined ? {} : { count })} />
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
