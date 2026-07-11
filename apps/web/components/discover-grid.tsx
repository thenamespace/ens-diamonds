"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PremiumEntry } from "@/lib/ens-premium";
import { fmtUsd, fmtCountdown } from "@/lib/format";
import SearchBar from "@/components/search-bar";
import { sortEntries, SORTS, type Sort } from "@/lib/discover-sort";

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

function NameCard({ n }: { n: PremiumEntry }) {
  const [c1, c2] = gradientFor(n.label);
  const price = n.priceUsd !== null ? fmtUsd(n.priceUsd) : `${n.priceEth.toFixed(3)} ETH`;
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
        <span className="ncard-timer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {fmtCountdown(n.premiumEndsAt)} left
        </span>
      </div>

      <div className="ncard-name">
        {n.label}
        <span className="eth">.eth</span>
      </div>

      <div className="ncard-price">
        <span className="ncard-price-label">Current price</span>
        <span className="p">{price}</span>
      </div>

      <div className="ncard-foot">
        <span className="pools-chip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          day {n.dayIntoPremium}/21 of premium
        </span>
        <span className="watchers">≈ {n.priceEth.toFixed(3)} ETH</span>
      </div>
    </Link>
  );
}

export default function DiscoverGrid({ names }: { names: PremiumEntry[] }) {
  // Default to "ending" (deepest into the 21-day decay = lowest premium =
  // actually poolable) — day-0 names carry ENS's ~$100M starting premium.
  const [sort, setSort] = useState<Sort>("ending");
  const sorted = useMemo(() => sortEntries(names, sort), [names, sort]);

  return (
    <>
      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Sort names">
          {SORTS.map((s) => (
            <button key={s.key} className={sort === s.key ? "on" : ""} onClick={() => setSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="toolbar-search">
          <SearchBar />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>No names in premium right now</h3>
          <p>When recently-expired .eth names enter their 21-day premium auction, they’ll show up here.</p>
        </div>
      ) : (
        <div className="grid">
          {sorted.map((n) => (
            <NameCard key={n.label} n={n} />
          ))}
        </div>
      )}
    </>
  );
}
