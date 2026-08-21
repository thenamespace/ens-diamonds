import "server-only";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";

import { unstable_cache } from "next/cache";

import {
  getPremiumNames,
  getPremiumRegistrationSet,
  getTrendingPremiumNames,
  type GetPremiumNamesProps,
  type PremiumRegistrationSet,
} from "./get-premium-names";

const getCachedCompressedPremiumRegistrationSet = unstable_cache(
  async () => {
    const source = await getPremiumRegistrationSet();

    return {
      payload: brotliCompressSync(Buffer.from(JSON.stringify(source.registrations)), {
        params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
      }).toString("base64"),
      snapshot: source.snapshot,
    };
  },
  ["premium-names-shortest-index-v4"],
  { revalidate: 300 },
);

const getCachedPremiumNamesPage = unstable_cache(
  async (properties: GetPremiumNamesProps) => getPremiumNames(properties),
  ["premium-names-page-v5"],
  { revalidate: 300 },
);

export async function getCachedPremiumNames(properties: GetPremiumNamesProps) {
  if (properties.sort === "trending") {
    const [rankedLabels, fallbackSource] = await Promise.all([
      getCachedTrendingLabels(),
      readCachedPremiumRegistrationSet(),
    ]);

    return getTrendingPremiumNames({
      rankedLabels,
      fallbackSource,
      limit: properties.limit ?? 24,
      ...(properties.filters ? { filters: properties.filters } : {}),
      ...(properties.after ? { after: properties.after } : {}),
    });
  }

  if (properties.sort === "shortest") {
    return getPremiumNames(properties, await readCachedPremiumRegistrationSet());
  }

  return getCachedPremiumNamesPage(properties);
}

async function readCachedPremiumRegistrationSet(): Promise<PremiumRegistrationSet> {
  const cached = await getCachedCompressedPremiumRegistrationSet();

  return {
    registrations: JSON.parse(
      brotliDecompressSync(Buffer.from(cached.payload, "base64")).toString("utf8"),
    ) as PremiumRegistrationSet["registrations"],
    snapshot: cached.snapshot,
  };
}

const getCachedTrendingLabels = unstable_cache(
  async () => {
    const { getTrendingLabels } = await import("@/db/actions");
    return (await getTrendingLabels()).map(({ label }) => label);
  },
  ["premium-names-trending-labels-v1"],
  { revalidate: 300 },
);
