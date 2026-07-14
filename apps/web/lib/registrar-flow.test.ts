import { describe, it, expect } from "vitest";
import { registerValue, commitFreshness, validateSignedValue } from "./registrar-flow";

describe("registerValue", () => {
  it("adds a 10% buffer on commit-reveal", () => {
    expect(registerValue(1000n, "commit-reveal")).toBe(1100n);
  });
  it("is zero on free-instant regardless of price", () => {
    expect(registerValue(1000n, "free-instant")).toBe(0n);
  });
});

describe("commitFreshness", () => {
  const t = 1_000_000;
  it("too-new inside minAge", () => expect(commitFreshness(t, t + 30)).toBe("waiting"));
  it("ready after minAge", () => expect(commitFreshness(t, t + 61)).toBe("ready"));
  it("expired after maxAge", () => expect(commitFreshness(t, t + 86401)).toBe("expired"));
  it("ready at exactly minAge (on-chain allows age == 60)", () => expect(commitFreshness(t, t + 60)).toBe("ready"));
  it("expired at exactly maxAge (on-chain reverts at age == 86400)", () => expect(commitFreshness(t, t + 86400)).toBe("expired"));
});

describe("validateSignedValue (server-side sign gate)", () => {
  const price = 1000n, balance = 5000n;
  it("accepts price..130% within balance", () => {
    expect(validateSignedValue(1100n, price, balance, "commit-reveal")).toBe(true);
  });
  it("rejects under price", () => expect(validateSignedValue(999n, price, balance, "commit-reveal")).toBe(false));
  it("rejects over 130%", () => expect(validateSignedValue(1301n, price, balance, "commit-reveal")).toBe(false));
  it("rejects over Safe balance", () => expect(validateSignedValue(1100n, price, 1000n, "commit-reveal")).toBe(false));
  it("free-instant only accepts exactly 0", () => {
    expect(validateSignedValue(0n, 0n, balance, "free-instant")).toBe(true);
    expect(validateSignedValue(1n, 0n, balance, "free-instant")).toBe(false);
  });
});
