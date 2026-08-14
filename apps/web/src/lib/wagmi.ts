import { addEnsContracts } from "@ensdomains/ensjs";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";

import { activeChain, rpcUrl } from "./network";

export const wagmiConfig = getDefaultConfig({
  appName: "ENS Diamonds",
  projectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "",
  chains: [addEnsContracts(activeChain)],
  transports: { [activeChain.id]: http(rpcUrl) },
  ssr: true,
});
