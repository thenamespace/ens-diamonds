"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

import { Chip, ProgressBar } from "@thenamespace/uikit";
import { Clock01Icon, HugeiconsIcon } from "@thenamespace/uikit/icons";
import { useInterval } from "usehooks-ts";

import {
  getPremiumDecay,
  PREMIUM_PERIOD_DAYS,
  type PremiumDecayTone,
  type PremiumName,
} from "@/lib/ens";
import { getUnixTime } from "@/lib/helpers";

type PremiumDecayProps = Pick<PremiumName, "availableAt" | "premiumStartsAt">;

const DECAY_TONES: Record<
  PremiumDecayTone,
  {
    fillStyle: CSSProperties;
    labelStyle: CSSProperties;
    chipStyle: CSSProperties;
  }
> = {
  critical: {
    fillStyle: { backgroundColor: "#c9363e" },
    labelStyle: { color: "#9f2830" },
    chipStyle: {
      backgroundColor: "#fbe9ea",
      borderColor: "#f3c8cb",
      color: "#9f2830",
    },
  },
  ember: {
    fillStyle: { backgroundColor: "#d85b3f" },
    labelStyle: { color: "#a8402c" },
    chipStyle: {
      backgroundColor: "#fcece7",
      borderColor: "#f4cfc4",
      color: "#a8402c",
    },
  },
  amber: {
    fillStyle: { backgroundColor: "#c28727" },
    labelStyle: { color: "#8f6017" },
    chipStyle: {
      backgroundColor: "#fbf1da",
      borderColor: "#eedba9",
      color: "#8f6017",
    },
  },
  olive: {
    fillStyle: { backgroundColor: "#718d3c" },
    labelStyle: { color: "#536c28" },
    chipStyle: {
      backgroundColor: "#eff4e3",
      borderColor: "#d8e4bd",
      color: "#536c28",
    },
  },
  teal: {
    fillStyle: { backgroundColor: "#278f87" },
    labelStyle: { color: "#176c67" },
    chipStyle: {
      backgroundColor: "#e2f3f1",
      borderColor: "#bce2de",
      color: "#176c67",
    },
  },
  indigo: {
    fillStyle: { backgroundColor: "#6572ce" },
    labelStyle: { color: "#4854a9" },
    chipStyle: {
      backgroundColor: "#e9ebfa",
      borderColor: "#cdd1f1",
      color: "#4854a9",
    },
  },
};

export const PremiumDecayMeter = (props: PremiumDecayProps) => {
  const decay = usePremiumDecay(props);
  const colors = DECAY_TONES[decay.tone];

  return (
    <div className="mt-4">
      <ProgressBar
        aria-label="Premium decay"
        color="default"
        maxValue={decay.totalSeconds}
        minValue={0}
        size="sm"
        value={decay.elapsedSeconds}
        valueLabel={
          decay.remainingSeconds > 0 ? `${decay.label} until premium ends` : "Premium ended"
        }
      >
        <ProgressBar.Track>
          <ProgressBar.Fill style={colors.fillStyle} />
        </ProgressBar.Track>
      </ProgressBar>

      <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] font-semibold tracking-[0.09em] uppercase text-muted">
        <span>Premium decay</span>
        <span style={colors.labelStyle}>
          Day {decay.elapsedDay}/{PREMIUM_PERIOD_DAYS}
        </span>
      </div>

      <PremiumDecayChip className="mt-3" label={decay.label} tone={decay.tone} />
    </div>
  );
};

export const CompactPremiumDecay = (props: PremiumDecayProps) => {
  const decay = usePremiumDecay(props);
  return <PremiumDecayChip label={decay.label} tone={decay.tone} />;
};

const PremiumDecayChip = ({
  label,
  tone,
  className,
}: {
  label: string;
  tone: PremiumDecayTone;
  className?: string;
}) => {
  const colors = DECAY_TONES[tone];

  return (
    <Chip
      color="default"
      size="sm"
      style={colors.chipStyle}
      variant="soft"
      {...(className === undefined ? {} : { className })}
    >
      <HugeiconsIcon aria-hidden="true" icon={Clock01Icon} width={13} />
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
};

function usePremiumDecay({ availableAt, premiumStartsAt }: PremiumDecayProps) {
  const [now, setNow] = useState<number>();
  const updateNow = useCallback(() => setNow(getUnixTime()), []);

  useEffect(() => {
    updateNow();
  }, [updateNow]);
  useInterval(updateNow, 60_000);

  return getPremiumDecay({
    availableAt,
    premiumStartsAt,
    now: now ?? premiumStartsAt,
  });
}
