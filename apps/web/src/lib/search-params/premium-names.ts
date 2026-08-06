import {
  createLoader,
  parseAsIsoDate,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { SECONDS_PER_DAY } from "@/lib/constants";
import type { PremiumNamesFilters } from "@/lib/ens";

export const NAME_MATCH_VALUES = ["contains", "startsWith", "exact"] as const;
export const SORT_VALUES = ["ending", "newest", "shortest"] as const;
export const VIEW_VALUES = ["grid", "list"] as const;
export const PREMIUM_DATE_RANGE_DAYS = 21;

export const premiumNameFilterParsers = {
  name: parseAsString.withDefault(""),
  match: parseAsStringLiteral(NAME_MATCH_VALUES).withDefault("contains"),
  availableFrom: parseAsIsoDate,
  availableTo: parseAsIsoDate,
  sort: parseAsStringLiteral(SORT_VALUES).withDefault("ending"),
};

export const premiumNameViewParser = parseAsStringLiteral(VIEW_VALUES).withDefault("grid");

export const premiumNameSearchParsers = {
  ...premiumNameFilterParsers,
  view: premiumNameViewParser,
};

export const loadPremiumNameSearchParams = createLoader(premiumNameSearchParsers);

export type PremiumNameSearchParams = inferParserType<typeof premiumNameSearchParsers>;
export type PremiumNameSort = PremiumNameSearchParams["sort"];
export type PremiumNameView = PremiumNameSearchParams["view"];
export type PremiumNameDateRange = {
  start: Date;
  end: Date;
};

export const toPremiumNamesFilters = (
  search: Pick<PremiumNameSearchParams, "name" | "match" | "availableFrom" | "availableTo">,
  asOf: number,
): PremiumNamesFilters => {
  const name = search.name.trim();
  const dateRange = getPremiumNameDateRange(search, asOf);

  return {
    ...(name
      ? {
          name: {
            match: search.match,
            value: name,
          },
        }
      : {}),
    availableAt: {
      from: Math.floor(dateRange.start.getTime() / 1000),
      to: Math.floor(dateRange.end.getTime() / 1000) + SECONDS_PER_DAY - 1,
    },
  };
};

export const getPremiumNameDateRange = (
  search: Pick<PremiumNameSearchParams, "availableFrom" | "availableTo">,
  asOf: number,
): PremiumNameDateRange => {
  const bounds = getPremiumNameDateBounds(asOf);
  const start = clampDate(search.availableFrom ?? bounds.start, bounds.start, bounds.end);
  const end = clampDate(search.availableTo ?? bounds.end, bounds.start, bounds.end);

  return start <= end ? { start, end } : bounds;
};

export const getPremiumNameDateBounds = (asOf: number): PremiumNameDateRange => {
  const start = new Date(asOf * 1000);
  start.setUTCHours(0, 0, 0, 0);

  return {
    start,
    end: new Date(start.getTime() + PREMIUM_DATE_RANGE_DAYS * SECONDS_PER_DAY * 1000),
  };
};

const clampDate = (value: Date, minimum: Date, maximum: Date) =>
  new Date(Math.min(Math.max(value.getTime(), minimum.getTime()), maximum.getTime()));
