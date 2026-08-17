import "server-only";
import { unstable_cache } from "next/cache";

import { ethRegistrarControllerRentPriceSnippet } from "@ensdomains/ensjs/contracts";
import { createPublicClient, http } from "viem";

import { SECONDS_PER_YEAR } from "@/lib/constants";
import { activeChain, appNetwork, Contracts, rpcUrl } from "@/lib/network";

const PRICE_CACHE_SECONDS = 300;

const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(rpcUrl),
});

export type NamePriceResult = {
  ethUsd: string | null;
  prices: Record<string, string>;
};

export const readNamePrices = unstable_cache(
  async (labels: string[]): Promise<NamePriceResult> => {
    const results = await publicClient.multicall({
      allowFailure: true,
      contracts: [
        ...labels.map((label) => ({
          abi: ethRegistrarControllerRentPriceSnippet,
          address: Contracts.ensEthRegistrarController.address,
          functionName: "rentPrice" as const,
          args: [label, BigInt(SECONDS_PER_YEAR)] as const,
        })),
        {
          abi: Contracts.ethPriceFeed.abi,
          address: Contracts.ethPriceFeed.address,
          functionName: "latestRoundData" as const,
        },
      ],
    });
    const prices: Record<string, string> = {};

    for (const [index, label] of labels.entries()) {
      const result = results[index];
      if (result?.status !== "success") continue;

      const price = result.result as { base: bigint; premium: bigint };
      prices[label] = (price.base + price.premium).toString();
    }

    const ethPriceResult = results.at(-1);
    const ethUsd =
      ethPriceResult?.status === "success"
        ? ((
            ethPriceResult.result as readonly [bigint, bigint, bigint, bigint, bigint]
          )[1]?.toString() ?? null)
        : null;

    return { ethUsd, prices };
  },
  ["ens-name-prices", appNetwork],
  { revalidate: PRICE_CACHE_SECONDS },
);
