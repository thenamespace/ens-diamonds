import Link from "next/link";

import { Card } from "@thenamespace/uikit";

import type { PremiumName } from "@/lib/ens";

import { NameAvatar } from "./name-avatar";
import { PremiumDecayMeter } from "./premium-decay";

export const NameCard = (name: PremiumName) => {
  return (
    <Link className="group block h-full" href={`/name/${name.label}.eth`}>
      <Card className="h-full gap-0 bg-transparent p-0 shadow-none transition-all duration-200 [filter:drop-shadow(0_2px_6px_rgba(18,21,28,0.08))] hover:-translate-y-[3px] hover:[filter:drop-shadow(0_10px_14px_rgba(18,21,28,0.13))]">
        <div className="ticket-top flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2.5">
            <span className="inline-flex transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105">
              <NameAvatar className="size-8 rounded-lg" label={name.label} />
            </span>
          </div>

          <div className="mt-4 mb-5 text-[29px] leading-[1.05] font-semibold tracking-tight wrap-break-word text-foreground">
            {name.label}
            <span className="font-normal text-muted">.eth</span>
          </div>
        </div>

        <div className="ticket-stub px-4 pt-3.5 pb-4">
          <span className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted">
            Available at
          </span>
          <time
            className="mt-1 block font-mono text-[18px] font-semibold tracking-tight text-foreground"
            dateTime={new Date(name.availableAt * 1000).toISOString()}
          >
            {formatAvailableAt(name.availableAt)}
          </time>
          <PremiumDecayMeter
            availableAt={name.availableAt}
            premiumStartsAt={name.premiumStartsAt}
          />
        </div>
      </Card>
    </Link>
  );
};

const formatAvailableAt = (timestamp: number) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(timestamp * 1000);
