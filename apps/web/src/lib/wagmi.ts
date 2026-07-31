import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import type { Address } from "viem";
import { mainnet, sepolia } from "wagmi/chains";

import { ensDiamondsAbi, ethPriceFeedAbi } from "./abi";

export const wagmiConfig = getDefaultConfig({
  appName: "ENS Diamonds",
  projectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "",
  chains: [mainnet, sepolia],
  ssr: true,
});

export const Contracts = {
  ensDiamonds: {
    address: "0x0" as Address,
    abi: ensDiamondsAbi,
  },
  ethPriceFeedAbi: {
    address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as Address,
    abi: ethPriceFeedAbi,
  },
};
