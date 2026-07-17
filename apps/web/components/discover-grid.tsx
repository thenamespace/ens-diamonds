"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Button, Card, EmptyState, Segment, Skeleton, Spinner, Tabs } from "@thenamespace/uikit";
import {
  Clock01Icon,
  Diamond02Icon,
  FavouriteIcon,
  GridViewIcon,
  HugeiconsIcon,
  LeftToRightListBulletIcon,
  SafeBoxIcon,
} from "@thenamespace/uikit/icons";
import type { PremiumEntry } from "@/lib/ens-premium";
import type { DiscoverPage } from "@/lib/discover-feed";
import { fmtUsd, fmtCountdown } from "@/lib/format";
import NameAvatar from "@/components/name-avatar";
import SearchBar from "@/components/search-bar";
import { SORTS, type Sort } from "@/lib/discover-sort";
import WatchButton from "@/components/watch-button";
import { SkeletonCard } from "@/components/skeletons";

function priceLabel(n: PremiumEntry): string {
  return n.priceUsd !== null ? fmtUsd(n.priceUsd) : `${n.priceEth.toFixed(3)} ETH`;
}

// Countdown pill on cards / rows. Ticks live — a timeout fires exactly when
// the displayed value next changes (each minute, or each hour above a day) —
// and the label plays a little drop-in flip on every change. `onSecondary`
// swaps the fill so the pill stays visible on a grey (surface-secondary) bg.
function TimerChip({ endsAt, onSecondary = false }: { endsAt: number; onSecondary?: boolean }) {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const left = endsAt - Math.floor(Date.now() / 1000);

  useEffect(() => {
    if (left <= 0) return;
    // Display granularity: d+h above a day (changes hourly), else h+m (changes each minute).
    const step = left > 86400 ? 3600 : 60;
    const t = setTimeout(tick, (left % step || step) * 1000 + 50);
    return () => clearTimeout(t);
  });

  const urgent = left > 0 && left < 3600;
  const label = left <= 0 ? "ended" : `${fmtCountdown(endsAt)} left`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap tabular-nums ${
        urgent
          ? "border-transparent bg-danger-soft text-danger-soft-foreground"
          : `border-transparent ${onSecondary ? "bg-surface" : "bg-surface-secondary"} text-muted`
      }`}
    >
      <HugeiconsIcon icon={Clock01Icon} size={13} strokeWidth={2} aria-hidden />
      <span key={label} className="tick-flip" suppressHydrationWarning>
        {label}
      </span>
    </span>
  );
}

// Engagement counts that drive the Trending rank: favourites (heart) + vaults (vault icon).
function NameStats({ watchers, pools }: { watchers: number; pools: number }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span
        className="inline-flex items-center gap-1 font-mono text-[11.5px] text-muted"
        title={`${watchers} favourite${watchers === 1 ? "" : "s"}`}
      >
        <HugeiconsIcon icon={FavouriteIcon} size={13} strokeWidth={1.9} aria-hidden />
        {watchers}
      </span>
      <span
        className="inline-flex items-center gap-1 font-mono text-[11.5px] text-muted"
        title={`${pools} vault${pools === 1 ? "" : "s"} created`}
      >
        <HugeiconsIcon icon={SafeBoxIcon} size={14} strokeWidth={1.7} aria-hidden />
        {pools}
      </span>
    </span>
  );
}

// Gradient monogram square (first letter of the label).
function Monogram({ label, size = "lg" }: { label: string; size?: "sm" | "lg" }) {
  return <NameAvatar className={size === "lg" ? "rounded-xl" : "rounded-[10px]"} label={label} size={size === "lg" ? 40 : 34} />;
}

function NameCard({ n }: { n: PremiumEntry }) {
  return (
    <Link className="group block h-full" href={`/name/${n.label}`}>
      {/* drop-shadow (not box-shadow) so the shadow follows the punched
          silhouette — the notches dent the outline and cast correctly. */}
      <Card className="h-full gap-0 bg-transparent p-0 shadow-none transition-all duration-200 [filter:drop-shadow(0_2px_6px_rgba(18,21,28,0.08))] hover:-translate-y-[3px] hover:[filter:drop-shadow(0_10px_14px_rgba(18,21,28,0.13))]">
        {/* Two masked zones — the notches are real holes cut where they meet
            (see .ticket-top / .ticket-stub). */}
        <div className="ticket-top flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2.5">
            <span className="inline-flex transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105">
              <Monogram label={n.label} />
            </span>
            <WatchButton label={n.label} />
          </div>

          <div className="mt-4 mb-5 text-[29px] leading-[1.05] font-semibold tracking-tight break-words [overflow-wrap:anywhere] text-foreground">
            {n.label}
            <span className="font-normal text-muted">.eth</span>
          </div>
        </div>

        <div className="ticket-stub px-4 pt-3.5 pb-4">
          <span className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted">Current price</span>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[22px] font-semibold tracking-tight text-foreground">{priceLabel(n)}</span>
            {n.priceUsd !== null && <span className="font-mono text-[12px] whitespace-nowrap text-muted">≈ {n.priceEth.toFixed(3)} ETH</span>}
          </div>
          <DecayMeter endsAt={n.premiumEndsAt} />
          <div className="mt-3.5 flex items-center justify-between">
            <TimerChip endsAt={n.premiumEndsAt} onSecondary />
            <NameStats watchers={n.watchers} pools={n.pools} />
          </div>
        </div>
      </Card>
    </Link>
  );
}

// 21-day Dutch-auction burn-down: the bar drains as the premium decays toward
// zero, so a glance tells you how deep into the auction a name is. The color
// walks a pale heat scale with the lifecycle — cool blue while fresh (price
// sky-high), through green/amber/orange as it cools, warm red as it burns out.
const PREMIUM_SECONDS = 21 * 86400;
function DecayMeter({ endsAt }: { endsAt: number }) {
  const left = Math.max(0, endsAt - Math.floor(Date.now() / 1000));
  const frac = Math.min(1, left / PREMIUM_SECONDS);
  const day = Math.min(21, 21 - Math.floor(left / 86400));
  // Hue 205 (pale blue, day 0) → 0 (pale red, day 21); low saturation keeps it soft.
  const hue = Math.round(205 * frac);
  const fill = `hsl(${hue} 42% 58%)`;
  return (
    <div aria-hidden className="mt-2.5">
      <div className="h-1 overflow-hidden rounded-full" style={{ background: `hsl(${hue} 42% 58% / 0.18)` }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, frac * 100)}%`, background: fill }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[9.5px] tracking-[0.08em] uppercase text-muted">
        <span>premium decay</span>
        <span style={{ color: `hsl(${hue} 45% 42%)` }}>day {day}/21</span>
      </div>
    </div>
  );
}

function NameRow({ n }: { n: PremiumEntry }) {
  return (
    <Link className="block" href={`/name/${n.label}`}>
      <Card className="grid grid-cols-[34px_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-4 border border-separator px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:shadow-md max-[560px]:grid-cols-[34px_minmax(0,1fr)_auto_auto] max-[560px]:gap-3">
        <Monogram label={n.label} size="sm" />
        <span className="min-w-0 truncate text-[19px] font-semibold tracking-tight text-foreground">
          {n.label}
          <span className="font-normal text-muted">.eth</span>
        </span>
        <span className="max-[560px]:hidden">
          <NameStats watchers={n.watchers} pools={n.pools} />
        </span>
        <span className="max-[560px]:hidden">
          <TimerChip endsAt={n.premiumEndsAt} />
        </span>
        <span className="flex min-w-[120px] flex-col items-end gap-px text-right">
          <span className="font-mono text-base font-semibold tracking-tight text-foreground">{priceLabel(n)}</span>
          {n.priceUsd !== null && <span className="font-mono text-[11.5px] text-muted">≈ {n.priceEth.toFixed(3)} ETH</span>}
        </span>
        <span className="inline-flex">
          <WatchButton label={n.label} />
        </span>
      </Card>
    </Link>
  );
}

// Shimmer placeholder rows shown while a fresh batch (tab switch / search)
// loads in list view. Card view reuses the shared SkeletonCard.
function SkeletonRow() {
  return (
    <Card aria-hidden className="grid grid-cols-[34px_minmax(0,1fr)_auto_auto_auto] items-center gap-4 px-4 py-3">
      <Skeleton className="size-[34px] rounded-[10px]" />
      <Skeleton className="h-4 w-[150px] rounded" />
      <Skeleton className="h-6 w-[108px] rounded-full" />
      <Skeleton className="h-[15px] w-[84px] justify-self-end rounded" />
      <Skeleton className="size-7 rounded-lg" />
    </Card>
  );
}

const SKELETON_COUNT = 8;

type Props = { initial: DiscoverPage; initialSort: Sort };

export default function DiscoverGrid({ initial, initialSort }: Props) {
  const [sort, setSort] = useState<Sort>(initialSort);
  const [entries, setEntries] = useState<PremiumEntry[]>(initial.entries);
  const [nextOffset, setNextOffset] = useState<number | null>(initial.nextOffset);
  const [total, setTotal] = useState<number | null>(initial.total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  // Debounced search term actually sent to the server (raw input debounced 300ms).
  const [debouncedQ, setDebouncedQ] = useState("");
  // Card vs list layout. Start "card" for a stable SSR/first paint, then adopt
  // the saved preference on mount (avoids a hydration mismatch).
  const [view, setView] = useState<"card" | "list">("card");
  useEffect(() => {
    if (localStorage.getItem("discover-view") === "list") setView("list");
  }, []);
  const setViewMode = useCallback((next: "card" | "list") => {
    localStorage.setItem("discover-view", next);
    setView(next);
  }, []);
  // Guards against out-of-order responses (fast tab switches / scroll bursts):
  // only the latest request is allowed to commit state.
  const reqId = useRef(0);

  // Fetch a batch. When `q` (≥2 chars) is set it searches the whole premium set;
  // otherwise it pages the active sort. Either way, `offset`/`replace` control
  // pagination vs. reset.
  const load = useCallback(async (s: Sort, q: string, offset: number, replace: boolean) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(false);
    try {
      const url =
        q.length >= 2
          ? `/api/discover?q=${encodeURIComponent(q)}&offset=${offset}`
          : `/api/discover?sort=${s}&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page = (await res.json()) as DiscoverPage;
      if (id !== reqId.current) return; // superseded
      // Dedupe on append: paginated batches can overlap by a name at a boundary
      // if the underlying window shifts between requests.
      setEntries((prev) => {
        if (replace) return page.entries;
        const seen = new Set(prev.map((e) => e.label));
        return [...prev, ...page.entries.filter((e) => !seen.has(e.label))];
      });
      setNextOffset(page.nextOffset);
      setTotal(page.total);
    } catch {
      if (id === reqId.current) setError(true);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // Debounce raw input → search term (strip a trailing .eth).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim().toLowerCase().replace(/\.eth$/, "")), 300);
    return () => clearTimeout(t);
  }, [query]);

  // (Re)load batch 0 whenever the sort tab or the search term changes. Skip the
  // first run — the SSR-provided initial page already covers it.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setEntries([]);
    setNextOffset(null);
    setTotal(null);
    void load(sort, debouncedQ, 0, true);
  }, [sort, debouncedQ, load]);

  // Clicking a sort tab clears any active search and browses that tab.
  const changeSort = useCallback((s: Sort) => {
    setSort(s);
    setQuery("");
    setDebouncedQ("");
  }, []);

  const searching = debouncedQ.length >= 2;

  // Infinite scroll: load the next batch when a sentinel near the page bottom
  // scrolls into view. rootMargin pre-fetches ~2 screens early for smoothness.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || nextOffset === null || loading) return;
    const io = new IntersectionObserver(
      (obs) => {
        if (obs[0].isIntersecting && nextOffset !== null) void load(sort, debouncedQ, nextOffset, false);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nextOffset, loading, sort, debouncedQ, load]);

  // The big empty state is only for a genuinely empty premium set, not a search
  // that returned nothing (that gets its own message under the grid).
  const showEmpty = !loading && !error && entries.length === 0 && !searching;

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-center gap-3">
        <Tabs className="min-w-0 max-w-full" selectedKey={sort} onSelectionChange={(k) => changeSort(k as Sort)}>
          {/* Scrolls horizontally on very narrow screens instead of clipping tabs. */}
          <Tabs.ListContainer className="max-w-full overflow-x-auto">
            <Tabs.List aria-label="Sort names">
              {SORTS.map((s) => (
                <Tabs.Tab className="whitespace-nowrap" key={s.key} id={s.key}>
                  {s.label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <div className="ml-auto flex min-w-0 grow items-center gap-2.5 sm:grow-0">
          <SearchBar value={query} onChange={setQuery} />
          <Segment
            className="flex-none"
            aria-label="Layout"
            selectedKey={view}
            disallowEmptySelection
            onSelectionChange={(k) => {
              if (k === "card" || k === "list") setViewMode(k);
            }}
          >
            <Segment.Item id="card" aria-label="Card view">
              <HugeiconsIcon icon={GridViewIcon} size={16} strokeWidth={2} aria-hidden />
            </Segment.Item>
            <Segment.Item id="list" aria-label="List view">
              <HugeiconsIcon icon={LeftToRightListBulletIcon} size={16} strokeWidth={2} aria-hidden />
            </Segment.Item>
          </Segment>
        </div>
      </div>

      {showEmpty ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <HugeiconsIcon icon={Diamond02Icon} aria-hidden />
            </EmptyState.Media>
            <EmptyState.Title>No names in premium right now</EmptyState.Title>
            <EmptyState.Description>
              When recently-expired .eth names enter their 21-day premium auction, they’ll show up here.
            </EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      ) : (
        <>
          {loading && entries.length === 0 ? (
            // Fresh load (tab switch / new search): shimmer placeholders.
            view === "card" ? (
              <div className="card-grid">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            )
          ) : view === "card" ? (
            <div className="card-grid">
              {entries.map((n) => (
                <NameCard key={n.label} n={n} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((n) => (
                <NameRow key={n.label} n={n} />
              ))}
            </div>
          )}

          {/* Sentinel + status line. Search results paginate the same way. */}
          <div ref={sentinelRef} className="mt-6 flex min-h-14 items-center justify-center py-2" aria-live="polite">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-[13px] tracking-[0.01em] text-muted">
                <Spinner size="sm" />
                {searching ? `Searching all premium names for “${debouncedQ}”…` : entries.length === 0 ? "Loading names…" : "Loading more names…"}
              </span>
            ) : error ? (
              <Button variant="outline" size="sm" onPress={() => void load(sort, debouncedQ, nextOffset ?? 0, entries.length === 0)}>
                Couldn’t load more. Retry
              </Button>
            ) : searching && entries.length === 0 ? (
              <span className="inline-flex items-center gap-2 text-[13px] tracking-[0.01em] text-muted">
                No premium names contain “{debouncedQ}”. Press Enter to open {debouncedQ}.eth →
              </span>
            ) : nextOffset === null && entries.length > 0 ? (
              <span className="inline-flex items-center gap-2 text-[13px] tracking-[0.01em] text-muted">
                {searching
                  ? `${(total ?? entries.length).toLocaleString()} premium name${total === 1 ? "" : "s"} match “${debouncedQ}”`
                  : total !== null
                    ? `That’s all ${total.toLocaleString()} names in premium.`
                    : "You’ve reached the end."}
              </span>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
