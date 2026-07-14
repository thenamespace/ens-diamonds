import { describe, it, expect } from "vitest";
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

// Canary: fails loudly if ENS ever rotates/de-authorizes the mainnet controller
// we register through (this exact failure mode broke Sepolia registration once —
// the controller in every address book was no longer authorized on-chain).
const RPC = process.env.MAINNET_RPC_URL;
const maybe = RPC ? describe : describe.skip;
const CONTROLLER = "0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547";
const BASE = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";

maybe("mainnet controller canary", () => {
  const client = createPublicClient({ chain: mainnet, transport: http(RPC) });
  it("controller is still authorized + parameters intact", async () => {
    const authorized = await client.readContract({
      address: BASE,
      abi: parseAbi(["function controllers(address) view returns (bool)"]),
      functionName: "controllers",
      args: [CONTROLLER],
    });
    expect(authorized).toBe(true);
    const minAge = await client.readContract({
      address: CONTROLLER,
      abi: parseAbi(["function minCommitmentAge() view returns (uint256)"]),
      functionName: "minCommitmentAge",
    });
    expect(Number(minAge)).toBe(60);
  }, 30_000);
});
