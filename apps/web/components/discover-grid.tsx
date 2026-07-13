"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PremiumEntry } from "@/lib/ens-premium";
import type { DiscoverPage } from "@/lib/discover-feed";
import { fmtUsd, fmtCountdown } from "@/lib/format";
import SearchBar from "@/components/search-bar";
import { SORTS, type Sort } from "@/lib/discover-sort";
import WatchButton from "@/components/watch-button";

// Stable, on-brand gradient per name so the grid reads as cohesive.
const CARD_GRADIENTS: [string, string][] = [
  ["#2f6bff", "#1f54e6"],
  ["#6366f1", "#8b5cf6"],
  ["#0ea5e9", "#06b6d4"],
  ["#3b82f6", "#2f6bff"],
  ["#7c3aed", "#4f46e5"],
  ["#0891b2", "#22c1c3"],
];

function gradientFor(label: string): [string, string] {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length];
}

function ClockIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function priceLabel(n: PremiumEntry): string {
  return n.priceUsd !== null ? fmtUsd(n.priceUsd) : `${n.priceEth.toFixed(3)} ETH`;
}

// Engagement counts that drive the Trending rank: watchers (eye) + pools (users).
function NameStats({ watchers, pools }: { watchers: number; pools: number }) {
  return (
    <span className="name-stats">
      <span className="name-stat" title={`${watchers} watching`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {watchers}
      </span>
      <span className="name-stat" title={`${pools} pool${pools === 1 ? "" : "s"} created`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
          <path d="M2 9q2.5 -3 5 0t5 0t5 0t5 0" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 15q2.5 -3 5 0t5 0t5 0t5 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {pools}
      </span>
    </span>
  );
}

function NameCard({ n }: { n: PremiumEntry }) {
  const [c1, c2] = gradientFor(n.label);
  return (
    <Link
      className="ncard reveal"
      href={`/name/${n.label}`}
      style={{ ["--c1"]: c1, ["--c2"]: c2 } as React.CSSProperties}
    >
      <div className="ncard-top">
        <span className="ncard-mono" aria-hidden>
          {n.label.slice(0, 1).toUpperCase()}
        </span>
        <WatchButton label={n.label} />
      </div>

      <div className="ncard-name">
        {n.label}
        <span className="eth">.eth</span>
      </div>

      <div className="ncard-price">
        <span className="ncard-price-label">Current price</span>
        <span className="p">{priceLabel(n)}</span>
        {n.priceUsd !== null && <span className="ncard-price-eth">≈ {n.priceEth.toFixed(3)} ETH</span>}
      </div>

      <div className="ncard-foot">
        <span className="ncard-timer">
          <ClockIcon />
          {fmtCountdown(n.premiumEndsAt)} left
        </span>
        <NameStats watchers={n.watchers} pools={n.pools} />
      </div>
    </Link>
  );
}

function NameRow({ n }: { n: PremiumEntry }) {
  const [c1, c2] = gradientFor(n.label);
  return (
    <Link className="nrow reveal" href={`/name/${n.label}`} style={{ ["--c1"]: c1, ["--c2"]: c2 } as React.CSSProperties}>
      <span className="nrow-mono" aria-hidden>
        {n.label.slice(0, 1).toUpperCase()}
      </span>
      <span className="nrow-name">
        {n.label}
        <span className="eth">.eth</span>
      </span>
      <span className="nrow-stats">
        <NameStats watchers={n.watchers} pools={n.pools} />
      </span>
      <span className="nrow-timer">
        <ClockIcon size={12} />
        {fmtCountdown(n.premiumEndsAt)} left
      </span>
      <span className="nrow-price">
        <span className="p">{priceLabel(n)}</span>
        {n.priceUsd !== null && <span className="nrow-eth">≈ {n.priceEth.toFixed(3)} ETH</span>}
      </span>
      <span className="nrow-watch">
        <WatchButton label={n.label} />
      </span>
    </Link>
  );
}

// Shimmer placeholders shown while a fresh batch (tab switch / search) loads, so
// the grid fills with pulsing cards instead of going blank.
function SkeletonCard() {
  return (
    <div className="ncard sk" aria-hidden>
      <div className="ncard-top">
        <span className="skeleton sk-mono" />
        <span className="skeleton sk-star" />
      </div>
      <span className="skeleton sk-line" style={{ width: "62%", height: 24, marginTop: 4 }} />
      <div className="ncard-price">
        <span className="skeleton sk-line" style={{ width: 74, height: 9 }} />
        <span className="skeleton sk-line" style={{ width: "56%", height: 24, marginTop: 6 }} />
        <span className="skeleton sk-line" style={{ width: 96, height: 11, marginTop: 6 }} />
      </div>
      <div className="ncard-foot">
        <span className="skeleton sk-chip" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="nrow sk" aria-hidden>
      <span className="skeleton sk-mono-sm" />
      <span className="skeleton sk-line" style={{ width: 150, height: 16 }} />
      <span className="skeleton sk-chip" />
      <span className="skeleton sk-line" style={{ width: 84, height: 15, justifySelf: "end" }} />
      <span className="skeleton sk-star" />
    </div>
  );
}

// Three-dot pulse used in the "loading more" / "searching" status line.
function LoadingDots() {
  return (
    <span className="dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
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
  const toggleView = useCallback(() => {
    setView((v) => {
      const next = v === "card" ? "list" : "card";
      localStorage.setItem("discover-view", next);
      return next;
    });
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
      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Sort names">
          {SORTS.map((s) => (
            <button key={s.key} className={sort === s.key ? "on" : ""} onClick={() => changeSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="toolbar-search">
          <SearchBar value={query} onChange={setQuery} />
          <button
            className="view-toggle"
            onClick={toggleView}
            aria-label={view === "card" ? "Switch to list view" : "Switch to card view"}
            title={view === "card" ? "List view" : "Card view"}
          >
            {view === "card" ? (
              // list icon → click to go to list
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <line x1="8" y1="6" x2="20" y2="6" strokeLinecap="round" />
                <line x1="8" y1="12" x2="20" y2="12" strokeLinecap="round" />
                <line x1="8" y1="18" x2="20" y2="18" strokeLinecap="round" />
                <circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none" />
                <circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" />
                <circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none" />
              </svg>
            ) : (
              // grid icon → click to go to cards
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {showEmpty ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>No names in premium right now</h3>
          <p>When recently-expired .eth names enter their 21-day premium auction, they’ll show up here.</p>
        </div>
      ) : (
        <>
          {loading && entries.length === 0 ? (
            // Fresh load (tab switch / new search): shimmer placeholders.
            view === "card" ? (
              <div className="grid">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <div className="list">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            )
          ) : view === "card" ? (
            <div className="grid">
              {entries.map((n) => (
                <NameCard key={n.label} n={n} />
              ))}
            </div>
          ) : (
            <div className="list">
              {entries.map((n) => (
                <NameRow key={n.label} n={n} />
              ))}
            </div>
          )}

          {/* Sentinel + status line. Search results paginate the same way. */}
          <div ref={sentinelRef} className="feed-foot" aria-live="polite">
            {loading ? (
              <span className="feed-status">
                <LoadingDots />
                {searching ? `Searching all premium names for “${debouncedQ}”…` : entries.length === 0 ? "Loading names…" : "Loading more names…"}
              </span>
            ) : error ? (
              <button className="feed-retry" onClick={() => void load(sort, debouncedQ, nextOffset ?? 0, entries.length === 0)}>
                Couldn’t load more — retry
              </button>
            ) : searching && entries.length === 0 ? (
              <span className="feed-status">
                No premium names contain “{debouncedQ}”. Press Enter to open {debouncedQ}.eth →
              </span>
            ) : nextOffset === null && entries.length > 0 ? (
              <span className="feed-status">
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
