"use client";

import { useEffect, useState } from "react";

import { Chip, ProgressBar } from "@thenamespace/uikit";
import { Clock01Icon, HugeiconsIcon } from "@thenamespace/uikit/icons";

import type { PremiumName } from "@/lib/ens";

const DAY_SECONDS = 24 * 60 * 60;
const HOUR_SECONDS = 60 * 60;
const PREMIUM_DAYS = 21;

type PremiumDecayProps = Pick<PremiumName, "availableAt" | "premiumStartsAt">;

export const PremiumDecayMeter = (props: PremiumDecayProps) => {
  const decay = usePremiumDecay(props);

  return (
    <div className="mt-4">
      <ProgressBar
        aria-label="Premium decay"
        color={decay.color}
        maxValue={decay.totalSeconds}
        minValue={0}
        size="sm"
        value={decay.elapsedSeconds}
        valueLabel={
          decay.remainingSeconds > 0 ? `${decay.label} until premium ends` : "Premium ended"
        }
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] font-semibold tracking-[0.09em] uppercase text-muted">
        <span>Premium decay</span>
        <span>
          Day {decay.elapsedDay}/{PREMIUM_DAYS}
        </span>
      </div>

      <PremiumDecayChip label={decay.label} color={decay.color} className="mt-3" />
    </div>
  );
};

export const CompactPremiumDecay = (props: PremiumDecayProps) => {
  const decay = usePremiumDecay(props);
  return <PremiumDecayChip label={decay.label} color={decay.color} />;
};

const PremiumDecayChip = ({
  label,
  color,
  className,
}: {
  label: string;
  color: "accent" | "success" | "warning";
  className?: string;
}) => (
  <Chip color={color} size="sm" variant="soft" {...(className === undefined ? {} : { className })}>
    <HugeiconsIcon aria-hidden="true" icon={Clock01Icon} width={13} />
    <Chip.Label>{label}</Chip.Label>
  </Chip>
);

function usePremiumDecay({ availableAt, premiumStartsAt }: PremiumDecayProps) {
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

  return {
    totalSeconds,
    elapsedSeconds,
    remainingSeconds,
    elapsedDay: Math.min(Math.floor(elapsedSeconds / DAY_SECONDS) + 1, PREMIUM_DAYS),
    label: formatRemainingTime(remainingSeconds),
    color:
      remainingSeconds <= 3 * DAY_SECONDS
        ? ("success" as const)
        : remainingSeconds <= 14 * DAY_SECONDS
          ? ("warning" as const)
          : ("accent" as const),
  };
}

function formatRemainingTime(seconds: number) {
  if (seconds <= 0) return "Premium ended";

  const days = Math.floor(seconds / DAY_SECONDS);
  const hours = Math.floor((seconds % DAY_SECONDS) / HOUR_SECONDS);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return "<1h left";
}
