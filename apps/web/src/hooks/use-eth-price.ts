import { useReadContract } from "wagmi";
import { mainnet } from "wagmi/chains";

import { Contracts } from "@/lib/wagmi";

export const useEthPrice = () =>
  useReadContract({
    abi: Contracts.ethPriceFeedAbi.abi,
    address: Contracts.ethPriceFeedAbi.address,
    chainId: mainnet.id,
    functionName: "latestRoundData",
    query: {
      refetchInterval: 60_000,
      select: (result) => result[1],
      staleTime: 30_000,
    },
  });
