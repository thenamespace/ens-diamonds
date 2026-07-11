"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NAMES, usd, type PremiumName } from "@/lib/data";
import SearchBar from "@/components/search-bar";

type Sort = "trending" | "ending" | "cheapest" | "shortest";

const SORTS: { key: Sort; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "ending", label: "Ending soon" },
  { key: "cheapest", label: "Cheapest" },
  { key: "shortest", label: "Shortest" },
];

function sortNames(names: PremiumName[], sort: Sort): PremiumName[] {
  const a = [...names];
  switch (sort) {
    case "trending":
      return a.sort((x, y) => y.watching - x.watching);
    case "ending":
      return a.sort((x, y) => x.daysLeft * 24 + x.hoursLeft - (y.daysLeft * 24 + y.hoursLeft));
    case "cheapest":
      return a.sort((x, y) => x.premiumUsd - y.premiumUsd);
    case "shortest":
      return a.sort((x, y) => x.letters - y.letters || x.premiumUsd - y.premiumUsd);
  }
}

// A small, on-brand set of cool gradients; each name gets a stable one so the
// grid reads as a colourful-but-cohesive set rather than a wall of white.
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

function NameCard({ n }: { n: PremiumName }) {
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
        <span className="ncard-timer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {n.daysLeft}d {n.hoursLeft}h left
        </span>
      </div>

      <div className="ncard-name">
        {n.label}
        <span className="eth">.eth</span>
      </div>

      <div className="ncard-price">
        <span className="ncard-price-label">Current price</span>
        <span className="p">{usd(n.premiumUsd)}</span>
      </div>

      <div className="ncard-foot">
        {n.poolsForming > 0 ? (
          <span className="pools-chip">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {n.poolsForming} pool{n.poolsForming > 1 ? "s" : ""} forming
          </span>
        ) : (
          <span className="no-pools">No pools yet</span>
        )}
        <span className="watchers">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {n.watching.toLocaleString()}
        </span>
      </div>
    </Link>
  );
}

export default function Discover() {
  const [sort, setSort] = useState<Sort>("trending");
  const names = useMemo(() => sortNames(NAMES, sort), [sort]);

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <span className="eyebrow">◆ Ethereum mainnet · live auction</span>
          <h1 style={{ marginTop: 16 }}>Names in temporary premium</h1>
          <p>
            Recently expired ENS names, decaying through their 21-day premium auction. The price falls roughly 50% a day
            — pool up to grab the ones worth having before someone else does.
          </p>
        </div>
      </div>

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

      <div className="grid">
        {names.map((n) => (
          <NameCard key={n.label} n={n} />
        ))}
      </div>
    </div>
  );
}
