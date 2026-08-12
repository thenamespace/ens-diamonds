import { addresses } from "@ensdomains/ensjs/contracts";
import { mainnet, sepolia } from "viem/chains";

import { ensDiamondsAbi, ethPriceFeedAbi } from "./abi";

export type AppNetwork = "mainnet" | "testnet";

export const appNetwork: AppNetwork =
  process.env.NEXT_PUBLIC_NETWORK === "testnet" ? "testnet" : "mainnet";

export const NetworkChains = {
  mainnet,
  testnet: sepolia,
} as const;

export const ContractSets = {
  mainnet: {
    ensDiamonds: {
      abi: ensDiamondsAbi,
      address: "0xb1A022bD260e22e0A767fB7f6324D1C721AF44b9",
    },
    ensBaseRegistrar: {
      address: addresses[mainnet.id].ensBaseRegistrarImplementation.address,
    },
    ensEthRegistrarController: {
      address: addresses[mainnet.id].ensEthRegistrarController.address,
    },
    ethPriceFeed: {
      abi: ethPriceFeedAbi,
      address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    },
  },
  testnet: {
    ensDiamonds: {
      abi: ensDiamondsAbi,
      address: "0xc961d72795930ab03164aabc26887ab9c97e14c4",
    },
    ensBaseRegistrar: {
      address: addresses[sepolia.id].ensBaseRegistrarImplementation.address,
    },
    ensEthRegistrarController: {
      address: addresses[sepolia.id].ensEthRegistrarController.address,
    },
    ethPriceFeed: {
      abi: ethPriceFeedAbi,
      address: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    },
  },
} as const;

export const activeChain = NetworkChains[appNetwork];
export const Contracts = ContractSets[appNetwork];
export const mainnetContractUrl = `${mainnet.blockExplorers.default.url}/address/${ContractSets.mainnet.ensDiamonds.address}`;
export const networkDisplayName = appNetwork === "testnet" ? "Sepolia testnet" : "Ethereum mainnet";
