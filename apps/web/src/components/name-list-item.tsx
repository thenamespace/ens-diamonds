import Link from "next/link";

import { Card } from "@thenamespace/uikit";

import type { PremiumName } from "@/lib/ens";

import { NameAvatar } from "./name-avatar";
import { CompactPremiumDecay } from "./premium-decay";

export const NameListItem = (name: PremiumName) => (
  <Link className="group block" href={`/name/${name.label}.eth`}>
    <Card className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-5">
      <NameAvatar
        className="size-11 rounded-xl transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
        label={name.label}
      />

      <div className="min-w-0">
        <div className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {name.label}
          <span className="font-normal text-muted">.eth</span>
        </div>
        <time
          className="mt-0.5 block truncate text-xs text-muted sm:hidden"
          dateTime={new Date(name.availableAt * 1000).toISOString()}
        >
          Available {formatAvailableAt(name.availableAt)}
        </time>
      </div>

      <div className="col-start-2 row-start-2 sm:col-auto sm:row-auto">
        <CompactPremiumDecay
          availableAt={name.availableAt}
          premiumStartsAt={name.premiumStartsAt}
        />
      </div>

      <div className="hidden min-w-44 text-right sm:block">
        <span className="block text-[10px] font-semibold tracking-[0.09em] uppercase text-muted">
          Available at
        </span>
        <time
          className="mt-1 block font-mono text-sm font-semibold text-foreground"
          dateTime={new Date(name.availableAt * 1000).toISOString()}
        >
          {formatAvailableAt(name.availableAt)}
        </time>
      </div>
    </Card>
  </Link>
);

const formatAvailableAt = (timestamp: number) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(timestamp * 1000);
