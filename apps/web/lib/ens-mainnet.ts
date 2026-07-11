import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

// Read-only mainnet ENS access. NOT wired to the wallet — writes/pooling stay on
// Sepolia via wagmi. Used server-side only, so the RPC endpoint is a server env
// (no NEXT_PUBLIC_). Public fallback works without config.
const MAINNET_RPC = process.env.MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com";

export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(MAINNET_RPC),
});

// Verified on mainnet 2026-07-11 via eth_getCode + live reads:
//   controller.rentPrice("vitalik",1y) -> {base,premium}; registrar.nameExpires -> expiry;
//   feed.decimals() == 8. Source: docs.ens.domains/learn/deployments + on-chain checks.
export const ETH_REGISTRAR_CONTROLLER = "0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547" as const;
export const BASE_REGISTRAR = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85" as const;
export const CHAINLINK_ETH_USD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as const;

export const controllerAbi = [
  {
    name: "rentPrice",
    stateMutability: "view",
    type: "function",
    inputs: [
      { name: "name", type: "string" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [
      {
        name: "price",
        type: "tuple",
        components: [
          { name: "base", type: "uint256" },
          { name: "premium", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export const registrarAbi = [
  {
    name: "nameExpires",
    stateMutability: "view",
    type: "function",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const chainlinkAbi = [
  { name: "decimals", stateMutability: "view", type: "function", inputs: [], outputs: [{ type: "uint8" }] },
  {
    name: "latestRoundData",
    stateMutability: "view",
    type: "function",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export const ONE_YEAR = 31_536_000n;
