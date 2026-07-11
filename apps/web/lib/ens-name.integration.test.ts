import { describe, it, expect } from "vitest";
import { getEnsNameData } from "./ens-name";
import { getPremiumNames } from "./ens-premium";

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

// getPremiumNames needs the Graph key; the RPC falls back to a public endpoint.
const maybeSubgraph = process.env.GRAPH_API_KEY ? describe : describe.skip;

maybeSubgraph("getPremiumNames against mainnet", () => {
  it(
    "returns real premium names with sane fields",
    async () => {
      const names = await getPremiumNames(5);
      expect(Array.isArray(names)).toBe(true);
      for (const n of names) {
        expect(n.label.length).toBeGreaterThanOrEqual(3);
        expect(n.priceEth).toBeGreaterThanOrEqual(0);
        expect(n.dayIntoPremium).toBeGreaterThanOrEqual(0);
        expect(n.dayIntoPremium).toBeLessThanOrEqual(21);
      }
    },
    30000,
  );
});
