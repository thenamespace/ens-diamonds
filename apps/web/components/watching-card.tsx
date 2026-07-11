"use client";

import Link from "next/link";
import { useWatching } from "@/hooks/use-watching";
import WatchButton from "@/components/watch-button";

export type WatchingCardData = {
  label: string;
  statusText: string;
  priceText: string;
};

export default function WatchingCard({ data }: { data: WatchingCardData }) {
  const { isWatching, isLoaded } = useWatching();
  // Drop the card the moment it's unwatched — but ONLY once the client list has
  // actually loaded. Before that (e.g. wallet not yet reconnected) keep showing
  // the server-rendered card instead of blanking the whole page.
  if (isLoaded && !isWatching(data.label)) return null;

  return (
    <Link href={`/name/${data.label}`} className="ncard reveal">
      <div className="ncard-top">
        <span className="ncard-mono" aria-hidden>
          {data.label.slice(0, 1).toUpperCase()}
        </span>
        <WatchButton label={data.label} />
      </div>
      <div className="ncard-name">
        {data.label}
        <span className="eth">.eth</span>
      </div>
      <div className="ncard-price">
        <span className="ncard-price-label">Status</span>
        <span className="p">{data.statusText}</span>
      </div>
      <div className="ncard-foot">
        <span className="watchers">{data.priceText}</span>
      </div>
    </Link>
  );
}
