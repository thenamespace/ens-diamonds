import { SECONDS_PER_DAY } from "@/lib/constants";
import { formatTimeRemaining } from "@/lib/helpers";

export const PREMIUM_PERIOD_DAYS = 21;

export type PremiumDecayTone = "critical" | "ember" | "amber" | "olive" | "teal" | "indigo";

export type PremiumDecay = {
  totalSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  elapsedDay: number;
  label: string;
  tone: PremiumDecayTone;
};

export const getPremiumDecay = ({
  availableAt,
  premiumStartsAt,
  now,
}: {
  availableAt: number;
  premiumStartsAt: number;
  now: number;
}): PremiumDecay => {
  const totalSeconds = Math.max(availableAt - premiumStartsAt, 1);
  const elapsedSeconds = Math.min(Math.max(now - premiumStartsAt, 0), totalSeconds);
  const remainingSeconds = Math.max(availableAt - now, 0);

  return {
    totalSeconds,
    elapsedSeconds,
    remainingSeconds,
    elapsedDay: Math.min(Math.floor(elapsedSeconds / SECONDS_PER_DAY) + 1, PREMIUM_PERIOD_DAYS),
    label: formatTimeRemaining(remainingSeconds, "Premium ended"),
    tone: getPremiumDecayTone(remainingSeconds),
  };
};

const getPremiumDecayTone = (remainingSeconds: number): PremiumDecayTone => {
  if (remainingSeconds <= SECONDS_PER_DAY) return "critical";
  if (remainingSeconds <= 3 * SECONDS_PER_DAY) return "ember";
  if (remainingSeconds <= 7 * SECONDS_PER_DAY) return "amber";
  if (remainingSeconds <= 12 * SECONDS_PER_DAY) return "olive";
  if (remainingSeconds <= 17 * SECONDS_PER_DAY) return "teal";
  return "indigo";
};
