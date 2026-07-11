import { describe, it, expect } from "vitest";
import { getEnsNameData } from "./ens-name";

// Only runs when a mainnet RPC is configured, to keep default `test` runs
// offline and deterministic (mirrors the contracts' guarded fork tests).
const maybe = process.env.MAINNET_RPC_URL ? describe : describe.skip;

maybe("getEnsNameData against mainnet", () => {
  it("flags a 2-char label as tooShort without any reads", async () => {
    const d = await getEnsNameData("ab");
    expect(d.status).toBe("tooShort");
  });

  it(
    "resolves a long-registered name as active with a live ETH/USD",
    async () => {
      const d = await getEnsNameData("vitalik");
      expect(d.status).toBe("active");
      expect(d.expiry).toBeGreaterThan(0);
      expect(d.ethUsd).not.toBeNull();
      expect(d.ethUsd as number).toBeGreaterThan(0);
    },
    20000,
  );
});
