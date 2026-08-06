import { addEnsContracts } from "@ensdomains/ensjs";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

import { activeChain } from "./network";

export const wagmiConfig = getDefaultConfig({
  appName: "ENS Diamonds",
  projectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "",
  chains: [addEnsContracts(activeChain)],
  ssr: true,
});
