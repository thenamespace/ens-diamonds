"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NAMES, usd, type PremiumName } from "@/lib/data";

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

function NameCard({ n }: { n: PremiumName }) {
  return (
    <Link className="ncard reveal" href={`/name/${n.label}`}>
      <div className="ncard-top">
        <span className={`tag ${n.cheap ? "tag-cheap" : "tag-premium"}`}>{n.cheap ? "Cheap" : "Premium"}</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
          {n.daysLeft}d {n.hoursLeft}h left
        </span>
      </div>
      <div className="ncard-name">
        {n.label}
        <span className="eth">.eth</span>
      </div>
      <div className="ncard-sub">
        {n.letters} letters · expired {n.expiredDaysAgo}d ago
      </div>
      <div className="ncard-price">
        <div>
          <div style={{ fontSize: 12, color: "var(--faint)", marginBottom: 2 }}>Current premium</div>
          <div className="p">{usd(n.premiumUsd)}</div>
        </div>
        <span className="drop">↓ 50% / day</span>
      </div>
      <div className="ncard-foot">
        {n.poolsForming > 0 ? (
          <span className="pools-chip">
            <span className="d" /> {n.poolsForming} pool{n.poolsForming > 1 ? "s" : ""} forming
          </span>
        ) : (
          <span style={{ color: "var(--faint)" }}>No pools yet</span>
        )}
        <span className="mono">{n.watching.toLocaleString()} watching</span>
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
        <span className="count">{names.length} in premium now</span>
      </div>

      <div className="grid">
        {names.map((n) => (
          <NameCard key={n.label} n={n} />
        ))}
      </div>
    </div>
  );
}
