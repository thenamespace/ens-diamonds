import type { PremiumNameSort, PremiumNamesFilters, PremiumNamesPage } from "./get-premium-names";

export const PREMIUM_NAMES_PAGE_SIZE = 24;

export const premiumNamesQueryKey = (
  filters: PremiumNamesFilters,
  sort: PremiumNameSort,
  limit = PREMIUM_NAMES_PAGE_SIZE,
) => ["premium-names", filters, sort, limit] as const;

export const getNextPremiumNamesPage = (page: PremiumNamesPage) =>
  page.pageInfo.hasNextPage ? (page.pageInfo.endCursor ?? undefined) : undefined;
