import "server-only";
import { unstable_cache } from "next/cache";

import {
  baseRegistrarAvailableSnippet,
  baseRegistrarNameExpiresSnippet,
} from "@ensdomains/ensjs/contracts";
import { createPublicClient, http, keccak256, toBytes } from "viem";

import { activeChain, appNetwork, Contracts, rpcUrl } from "@/lib/network";

const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(rpcUrl),
});

export const readNameStatuses = unstable_cache(
  async (labels: string[]) => {
    const results = await publicClient.multicall({
      allowFailure: true,
      contracts: labels.flatMap((label) => {
        const tokenId = BigInt(keccak256(toBytes(label)));

        return [
          {
            abi: baseRegistrarAvailableSnippet,
            address: Contracts.ensBaseRegistrar.address,
            args: [tokenId],
            functionName: "available" as const,
          },
          {
            abi: baseRegistrarNameExpiresSnippet,
            address: Contracts.ensBaseRegistrar.address,
            args: [tokenId],
            functionName: "nameExpires" as const,
          },
        ];
      }),
    });

    return Object.fromEntries(
      labels.map((label, index) => {
        const availability = results[index * 2];
        const expiry = results[index * 2 + 1];

        return [
          label,
          {
            isAvailable:
              availability?.status === "success" && typeof availability.result === "boolean"
                ? availability.result
                : null,
            registrationExpiresAt:
              expiry?.status === "success" && typeof expiry.result === "bigint"
                ? expiry.result.toString()
                : null,
          },
        ];
      }),
    );
  },
  ["ens-name-statuses", appNetwork],
  { revalidate: 300 },
);
