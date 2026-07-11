import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { addEnsContracts } from "@ensdomains/ensjs";

// Read-only mainnet ENS access via ensjs. NOT wired to the wallet — writes/pooling
// stay on Sepolia via wagmi. Server-side only (RPC endpoint + Graph key are server
// env, no NEXT_PUBLIC_). Public RPC fallback works without config.
const MAINNET_RPC = process.env.MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com";
const GRAPH_API_KEY = process.env.GRAPH_API_KEY;

export const ensClient = createPublicClient({
  chain: GRAPH_API_KEY
    ? addEnsContracts(mainnet, { subgraphApiKey: GRAPH_API_KEY })
    : addEnsContracts(mainnet),
  transport: http(MAINNET_RPC),
});

export const ONE_YEAR = 31_536_000n;

// Chainlink ETH/USD (mainnet) — ensjs has no USD conversion. Verified on-chain
// 2026-07-11: decimals() == 8, latestRoundData() returns a live answer.
const CHAINLINK_ETH_USD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as const;

const chainlinkAbi = [
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

// Live ETH/USD, or null if the oracle read fails (callers degrade to ETH-only).
export async function getEthUsd(): Promise<number | null> {
  try {
    const [decimals, round] = await ensClient.multicall({
      allowFailure: false,
      contracts: [
        { address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "decimals" },
        { address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "latestRoundData" },
      ],
    });
    return Number(round[1]) / 10 ** Number(decimals);
  } catch {
    return null;
  }
}
