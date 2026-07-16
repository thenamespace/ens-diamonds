"use client";

import Link from "next/link";
import { Card } from "@thenamespace/uikit";
import { useWatching } from "@/hooks/use-watching";
import NameAvatar from "@/components/name-avatar";
import WatchButton from "@/components/watch-button";

export type WatchingCardData = {
  label: string;
  statusText: string;
  priceText: string;
};

// Status → text color, matching the app's status palette (premium purple,
// available green, grace amber; registered stays ink).
const STATUS_COLOR: Record<string, string> = {
  "In premium": "text-[#7141c9]",
  Available: "text-[#2e6b35]",
  "In grace period": "text-[#85701f]",
};

export default function WatchingCard({ data }: { data: WatchingCardData }) {
  const { isWatching, isLoaded } = useWatching();
  // Drop the card the moment it's unwatched — but ONLY once the client list has
  // actually loaded. Before that (e.g. wallet not yet reconnected) keep showing
  // the server-rendered card instead of blanking the whole page.
  if (isLoaded && !isWatching(data.label)) return null;

  return (
    <Link href={`/name/${data.label}`} className="reveal group block h-full">
      <Card className="h-full gap-0 bg-transparent p-0 shadow-none transition-all duration-200 [filter:drop-shadow(0_2px_6px_rgba(18,21,28,0.08))] hover:-translate-y-[3px] hover:[filter:drop-shadow(0_10px_14px_rgba(18,21,28,0.13))]">
        {/* Same claim-ticket anatomy as the discover cards: identity on the
            white top, market state on the perforated stub. */}
        <div className="ticket-top flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2.5">
            <span className="inline-flex transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105">
              <NameAvatar className="rounded-xl" label={data.label} size={40} />
            </span>
            <WatchButton label={data.label} />
          </div>
          <div className="mt-4 mb-5 text-[29px] leading-[1.05] font-semibold tracking-tight break-words [overflow-wrap:anywhere] text-foreground">
            {data.label}
            <span className="font-normal text-muted">.eth</span>
          </div>
        </div>

        <div className="ticket-stub px-4 pt-3.5 pb-4">
          <span className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted">Status</span>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span className={`font-mono text-[22px] font-semibold tracking-tight ${STATUS_COLOR[data.statusText] ?? "text-foreground"}`}>
              {data.statusText}
            </span>
            <span className="font-mono text-[12px] whitespace-nowrap text-muted">{data.priceText}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
