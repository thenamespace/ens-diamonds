import { describe, it, expect } from "vitest";
import { resolveRpc } from "./chain";

const SEPOLIA_DEFAULT = "https://ethereum-sepolia-rpc.publicnode.com";
const MAINNET_DEFAULT = "https://ethereum-rpc.publicnode.com";

describe("resolveRpc", () => {
  it("mainnet ignores the legacy sepolia RPC var — a leftover Sepolia RPC must never wire a mainnet build", () => {
    expect(resolveRpc("mainnet", undefined, "https://my-sepolia.example")).toBe(MAINNET_DEFAULT);
  });
  it("sepolia honors the legacy sepolia RPC var", () => {
    expect(resolveRpc("sepolia", undefined, "https://my-sepolia.example")).toBe("https://my-sepolia.example");
  });
  it("the generic RPC var wins on both chains", () => {
    expect(resolveRpc("sepolia", "https://generic.example", "https://my-sepolia.example")).toBe(
      "https://generic.example",
    );
    expect(resolveRpc("mainnet", "https://generic.example", "https://my-sepolia.example")).toBe(
      "https://generic.example",
    );
  });
  it("falls back to the per-chain public default when nothing is set", () => {
    expect(resolveRpc("sepolia", undefined, undefined)).toBe(SEPOLIA_DEFAULT);
    expect(resolveRpc("mainnet", undefined, undefined)).toBe(MAINNET_DEFAULT);
  });
});
