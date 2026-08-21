import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import type { SearchParams } from "nuqs/server";

import { PremiumNameBrowser } from "@/components";
import { getNextPremiumNamesPage, PREMIUM_NAMES_PAGE_SIZE, premiumNamesQueryKey } from "@/lib/ens";
import { getCachedPremiumNames } from "@/lib/ens/get-cached-premium-names";
import { getUnixTime } from "@/lib/helpers";
import { loadPremiumNameSearchParams, toPremiumNamesFilters } from "@/lib/search-params";

type HomeProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Home({ searchParams }: HomeProps) {
  const search = await loadPremiumNameSearchParams(searchParams);
  const asOf = getUnixTime();
  const filters = toPremiumNamesFilters(search, asOf);
  const queryClient = new QueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: premiumNamesQueryKey(filters, search.sort),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getCachedPremiumNames({
        filters,
        sort: search.sort,
        limit: PREMIUM_NAMES_PAGE_SIZE,
        after: pageParam,
      }),
    getNextPageParam: getNextPremiumNamesPage,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PremiumNameBrowser asOf={asOf} />
    </HydrationBoundary>
  );
}
