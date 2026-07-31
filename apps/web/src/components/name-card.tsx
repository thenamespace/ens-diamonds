"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { Card, Chip, ProgressBar } from "@thenamespace/uikit";
import { Clock01Icon, HugeiconsIcon } from "@thenamespace/uikit/icons";

import type { PremiumName } from "@/lib/ens";

const DAY_SECONDS = 24 * 60 * 60;
const HOUR_SECONDS = 60 * 60;
const PREMIUM_DAYS = 21;

export const NameCard = (name: PremiumName) => {
  return (
    <Link className="group block h-full" href={`/name/${name.label}.eth`}>
      <Card className="h-full gap-0 bg-transparent p-0 shadow-none transition-all duration-200 [filter:drop-shadow(0_2px_6px_rgba(18,21,28,0.08))] hover:-translate-y-[3px] hover:[filter:drop-shadow(0_10px_14px_rgba(18,21,28,0.13))]">
        <div className="ticket-top flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2.5">
            <span className="inline-flex transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105">
              {/* <Monogram label={n.label} /> */}
              <div className="size-8 border"></div>
            </span>
          </div>

          <div className="mt-4 mb-5 text-[29px] leading-[1.05] font-semibold tracking-tight wrap-break-word text-foreground">
            {name.label}
            <span className="font-normal text-muted">.eth</span>
          </div>
        </div>

        <div className="ticket-stub px-4 pt-3.5 pb-4">
          <span className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted">
            Current price
          </span>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[22px] font-semibold tracking-tight text-foreground">
              $254.67
            </span>
            <span className="font-mono text-[12px] whitespace-nowrap text-muted">≈ 0.03 ETH</span>
          </div>
          <DecayMeter availableAt={name.availableAt} premiumStartsAt={name.premiumStartsAt} />
        </div>
      </Card>
    </Link>
  );
};

const DecayMeter = ({
  availableAt,
  premiumStartsAt,
}: Pick<PremiumName, "availableAt" | "premiumStartsAt">) => {
  const [now, setNow] = useState<number>();

  useEffect(() => {
    const updateNow = () => setNow(Math.floor(Date.now() / 1000));
    updateNow();

    const interval = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const totalSeconds = Math.max(availableAt - premiumStartsAt, 1);
  const elapsedSeconds = Math.min(
    Math.max((now ?? premiumStartsAt) - premiumStartsAt, 0),
    totalSeconds,
  );
  const remainingSeconds = Math.max(availableAt - (now ?? premiumStartsAt), 0);
  const elapsedDay = Math.min(Math.floor(elapsedSeconds / DAY_SECONDS) + 1, PREMIUM_DAYS);
  const color =
    remainingSeconds <= 3 * DAY_SECONDS
      ? "success"
      : remainingSeconds <= 14 * DAY_SECONDS
        ? "warning"
        : "accent";

  return (
    <div className="mt-4">
      <ProgressBar
        aria-label="Premium decay"
        color={color}
        maxValue={totalSeconds}
        minValue={0}
        size="sm"
        value={elapsedSeconds}
        valueLabel={
          remainingSeconds > 0
            ? `${formatRemainingTime(remainingSeconds)} until premium ends`
            : "Premium ended"
        }
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] font-semibold tracking-[0.09em] uppercase text-muted">
        <span>Premium decay</span>
        <span>
          Day {elapsedDay}/{PREMIUM_DAYS}
        </span>
      </div>

      <Chip className="mt-3 w-fit" color={color} size="sm" variant="soft">
        <HugeiconsIcon aria-hidden="true" icon={Clock01Icon} width={13} />
        <Chip.Label>{formatRemainingTime(remainingSeconds)}</Chip.Label>
      </Chip>
    </div>
  );
};

const formatRemainingTime = (seconds: number) => {
  if (seconds <= 0) return "Premium ended";

  const days = Math.floor(seconds / DAY_SECONDS);
  const hours = Math.floor((seconds % DAY_SECONDS) / HOUR_SECONDS);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return "<1h left";
};
