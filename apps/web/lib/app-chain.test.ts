import { describe, it, expect } from "vitest";
import { isAddress } from "viem";
import { resolveAppChain } from "./app-chain";

describe("resolveAppChain", () => {
  it("defaults to sepolia", () => {
    const c = resolveAppChain(undefined);
    expect(c.key).toBe("sepolia");
    expect(c.registrationMode).toBe("free-instant");
    expect(c.ensController).toBe("0xdf60C561Ca35AD3C89D24BbA854654b1c3477078");
    expect(c.ensAppUrl).toBe("https://sepolia.app.ens.domains");
    expect(c.explorerUrl).toBe("https://sepolia.etherscan.io");
  });
  it("blank or whitespace env var defaults to sepolia", () => {
    expect(resolveAppChain("").key).toBe("sepolia");
    expect(resolveAppChain("  ").key).toBe("sepolia");
  });
  it("mainnet flips every knob", () => {
    const c = resolveAppChain("mainnet");
    expect(c.key).toBe("mainnet");
    expect(c.registrationMode).toBe("commit-reveal");
    expect(c.ensController).toBe("0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547");
    expect(c.ensResolver).toBe("0xF29100983E058B709F3D539b0c765937B804AC15");
    expect(c.ensAppUrl).toBe("https://app.ens.domains");
    expect(c.chainId).toBe(1);
  });
  it("BaseRegistrar address is chain-invariant", () => {
    expect(resolveAppChain("sepolia").ensBaseRegistrar).toBe(resolveAppChain("mainnet").ensBaseRegistrar);
  });
  it("carries chain-labelled UI fields", () => {
    const s = resolveAppChain("sepolia");
    expect(s.label).toBe("Sepolia");
    expect(s.isTestnet).toBe(true);
    expect(s.safePrefix).toBe("sep");
    const m = resolveAppChain("mainnet");
    expect(m.label).toBe("Ethereum");
    expect(m.isTestnet).toBe(false);
    expect(m.safePrefix).toBe("eth");
  });
  it("throws on garbage", () => {
    expect(() => resolveAppChain("goerli")).toThrow();
  });
  it("every address field is a valid checksummed address", () => {
    for (const key of ["sepolia", "mainnet"] as const) {
      const c = resolveAppChain(key);
      for (const field of ["ensController", "ensBaseRegistrar", "ensResolver"] as const) {
        expect(isAddress(c[field]), `${key}.${field}`).toBe(true);
      }
    }
  });
});
