"use client";

import { useQuery } from "@tanstack/react-query";
import { usd } from "@/lib/data";
import { fmtCountdown } from "@/lib/format";

type PriceInfo = {
  baseUsd: number | null;
  premiumUsd: number | null;
  totalUsd: number | null;
  totalEth: number;
  premiumEndsAt: number | null;
};

async function fetchPrice(label: string): Promise<{ status: string; price: PriceInfo | null }> {
  const res = await fetch(`/api/name-status?label=${encodeURIComponent(label)}`);
  if (!res.ok) throw new Error("price fetch failed");
  return res.json();
}

// Live mainnet price of a name (the premium decays ~50%/day, so it refreshes
// every 30s). Renders nothing until a price is known.
export default function LivePrice({ label }: { label: string }) {
  const { data } = useQuery({
    queryKey: ["live-price", label],
    queryFn: () => fetchPrice(label),
    enabled: label.length >= 3,
    refetchInterval: 30000,
  });

  const p = data?.price;
  if (!p) return null;

  const fmt = (v: number | null) => (v === null ? "—" : usd(v));

  return (
    <div className="live-price">
      <div style={{ marginBottom: 12 }}>
        <span className="live-price-title">Live price · Ethereum mainnet</span>
      </div>
      <div className="kv">
        <span className="k">Registration (1 yr)</span>
        <span className="v">{fmt(p.baseUsd)}</span>
      </div>
      <div className="kv">
        <span className="k">Temporary premium</span>
        <span className="v">{fmt(p.premiumUsd)}</span>
      </div>
      <div className="kv">
        <span className="k">Total to buy now</span>
        <span className="v big accent">{fmt(p.totalUsd)}</span>
      </div>
      <div className="progress-label" style={{ marginTop: 6 }}>
        <span>≈ {p.totalEth.toFixed(3)} ETH</span>
        {p.premiumEndsAt && <span>premium gone in {fmtCountdown(p.premiumEndsAt)}</span>}
      </div>
    </div>
  );
}
