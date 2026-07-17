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
  transport: http(MAINNET_RPC, { batch: true }),
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

// Reject oracle answers older than this — Chainlink's ETH/USD heartbeat is 1h,
// so anything beyond it means the feed has stalled.
const MAX_ORACLE_AGE = 3600;

async function readEthUsd(): Promise<number | null> {
  try {
    const [decimals, round] = await ensClient.multicall({
      allowFailure: false,
      contracts: [
        { address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "decimals" },
        { address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "latestRoundData" },
      ],
    });
    const answer = round[1];
    const updatedAt = Number(round[3]);
    if (answer <= 0n) return null;
    if (Math.floor(Date.now() / 1000) - updatedAt > MAX_ORACLE_AGE) return null;
    return Number(answer) / 10 ** Number(decimals);
  } catch {
    return null;
  }
}

// Serve a cached rate for this long before re-reading the oracle. Chainlink's
// ETH/USD feed only updates on a 0.5% deviation or 1h heartbeat, so 60s of
// staleness is well inside the feed's own noise.
const ETH_USD_TTL_MS = 60_000;
// On oracle hiccups, keep serving the last good value up to this long rather
// than dropping the USD column to "-".
const ETH_USD_STALE_MS = 10 * 60_000;

let ethUsdCache: { value: number; at: number } | null = null;
let ethUsdInflight: Promise<number | null> | null = null;

// Live ETH/USD, or null if the oracle read fails, returns a non-positive
// answer, or is stale (callers degrade to ETH-only display; nothing is ever
// charged off this number — charging is enforced by the ENS contract itself).
// Cached in-process and deduped across concurrent requests so the price API
// doesn't pay a mainnet round trip on every poll.
export async function getEthUsd(): Promise<number | null> {
  if (ethUsdCache && Date.now() - ethUsdCache.at < ETH_USD_TTL_MS) return ethUsdCache.value;
  if (!ethUsdInflight) {
    ethUsdInflight = readEthUsd().finally(() => {
      ethUsdInflight = null;
    });
  }
  const fresh = await ethUsdInflight;
  if (fresh !== null) {
    ethUsdCache = { value: fresh, at: Date.now() };
    return fresh;
  }
  if (ethUsdCache && Date.now() - ethUsdCache.at < ETH_USD_STALE_MS) return ethUsdCache.value;
  return null;
}
