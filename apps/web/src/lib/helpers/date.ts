import { SECONDS_PER_DAY, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "@/lib/constants";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const CHART_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

export const getUnixTime = () => Math.floor(Date.now() / 1000);

export const formatUnixDate = (timestamp: number) =>
  DATE_FORMATTER.format(new Date(timestamp * 1000));

export const formatChartDate = (timestamp: number) =>
  CHART_DATE_FORMATTER.format(new Date(timestamp * 1000));

export const formatTimeRemaining = (seconds: number, endedLabel = "Ended") => {
  if (seconds <= 0) return endedLabel;

  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  if (minutes > 0) return `${minutes}m left`;
  return "<1m left";
};
