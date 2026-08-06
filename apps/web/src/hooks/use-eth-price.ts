import { useReadContract } from "wagmi";

import { activeChain, Contracts } from "@/lib/network";

export const useEthPrice = () =>
  useReadContract({
    abi: Contracts.ethPriceFeed.abi,
    address: Contracts.ethPriceFeed.address,
    chainId: activeChain.id,
    functionName: "latestRoundData",
    query: {
      refetchInterval: 60_000,
      select: (result) => result[1],
      staleTime: 30_000,
    },
  });
