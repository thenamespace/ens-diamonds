import { useReadContract } from "wagmi";

import { Contracts } from "@/lib/wagmi";

export const useEthPrice = () => {
  return useReadContract({
    abi: Contracts.ethPriceFeedAbi.abi,
    functionName: "latestRoundData",
    address: Contracts.ethPriceFeedAbi.address,
    chainId: 1,
    query: {
      select: (v) => v[1],
    },
  });
};
