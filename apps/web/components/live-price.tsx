"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card } from "@thenamespace/uikit";
import { usd } from "@/lib/data";
import { fmtCountdown } from "@/lib/format";

type PriceInfo = {
  baseUsd: number | null;
  premiumUsd: number | null;
  totalUsd: number | null;
  totalEth: number;
  premiumEndsAt: number | null;
};

type PriceResponse = { status: string; price: PriceInfo | null; available: boolean | null };

async function fetchPrice(label: string): Promise<PriceResponse> {
  const res = await fetch(`/api/name-status?label=${encodeURIComponent(label)}`);
  if (!res.ok) throw new Error("price fetch failed");
  return res.json();
}

// Sub-hour-precision countdown for the live ticker between polls. Kept local
// (rather than folded into lib/format.ts's fmtCountdown) because that helper
// is deliberately coarse (h/m granularity) and other call sites depend on
// that format.
function fmtLiveCountdown(deadlineSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  const d = deadlineSec - now;
  if (d <= 0) return "ended";
  if (d < 3600) {
    const mins = Math.floor(d / 60);
    const secs = d % 60;
    return `${mins}m ${secs}s`;
  }
  if (d < 86400) {
    const hrs = Math.floor(d / 3600);
    const mins = Math.floor((d % 3600) / 60);
    const secs = d % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return fmtCountdown(deadlineSec);
}

// Live mainnet price of a name, polled every 10s with a 1s local ticker so
// the premium countdown moves in real time between fetches. If the name gets
// bought out from under the vault, the price rows swap for a "just bought"
// banner: pool-register's sniped panel passes `boughtByOther` explicitly,
// while self-detection (a live true→false `available` transition from the
// API) covers standalone/normal mounts.
export default function LivePrice({ label, boughtByOther }: { label: string; boughtByOther?: boolean }) {
  const { data } = useQuery({
    queryKey: ["live-price", label],
    queryFn: () => fetchPrice(label),
    enabled: label.length >= 3,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });

  // Self-detection fallback: remember the previous `available` value and
  // flip on only when it transitions true -> false during this component's
  // lifetime. A name that was already unavailable on the very first fetch
  // (e.g. long-registered on Sepolia) must NOT trigger the banner.
  const [justBought, setJustBought] = useState(false);
  const prevAvailable = useRef<boolean | null | undefined>(undefined);

  useEffect(() => {
    if (!data) return;
    if (prevAvailable.current === true && data.available === false) {
      setJustBought(true);
    }
    prevAvailable.current = data.available;
  }, [data]);

  // 1s ticker so the premium countdown moves live; only runs while there's
  // a premium deadline to count down.
  const [, setTick] = useState(0);
  const premiumEndsAt = data?.price?.premiumEndsAt ?? null;
  useEffect(() => {
    if (!premiumEndsAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [premiumEndsAt]);

  const p = data?.price;
  const banner = boughtByOther === true || justBought;
  if (!p && !banner) return null;

  const fmt = (v: number | null) => (v === null ? "-" : usd(v));

  return (
    <Card variant="secondary">
      <Card.Header>
        <Card.Title className="mono text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">
          Live price · Ethereum mainnet
        </Card.Title>
      </Card.Header>
      <Card.Content>
        {banner ? (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>This name has just been bought.</Alert.Title>
              <Alert.Description>
                Someone registered it before the vault could. The pooled ETH is untouched in the Safe.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : p ? (
          <>
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
            <div className="mono mt-1.5 flex justify-between text-[13px] text-muted">
              <span>≈ {p.totalEth.toFixed(3)} ETH</span>
              {p.premiumEndsAt && <span>premium gone in {fmtLiveCountdown(p.premiumEndsAt)}</span>}
            </div>
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}
