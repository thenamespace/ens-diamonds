import { describe, it, expect } from "vitest";
import { registerValue, commitFreshness, chainCommitFreshness, validateSignedValue, valueWithinBand, isUintString } from "./registrar-flow";

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

describe("chainCommitFreshness (on-chain timestamp is authoritative)", () => {
  const t = 1_000_000;
  it("unmined commit (onchain 0) is waiting even when the KV committedAt looks ready", () => {
    expect(chainCommitFreshness(0n, t, t + 100)).toBe("waiting");
  });
  it("unmined commit expires once the KV record ages out (never-mined cleanup)", () => {
    expect(chainCommitFreshness(0n, t, t + 86400)).toBe("expired");
  });
  it("mined commit inside minAge is waiting", () => expect(chainCommitFreshness(BigInt(t), t, t + 30)).toBe("waiting"));
  it("mined commit is ready at exactly minAge", () => expect(chainCommitFreshness(BigInt(t), t, t + 60)).toBe("ready"));
  it("mined commit expires at exactly maxAge", () => expect(chainCommitFreshness(BigInt(t), t, t + 86400)).toBe("expired"));
  it("chain wins over a fake-ready KV committedAt (client pre-dated the commit)", () => {
    // KV claims the commit is 100s old ("ready"), chain says it was mined 30s ago.
    expect(chainCommitFreshness(BigInt(t + 70), t, t + 100)).toBe("waiting");
  });
  it("chain wins over a fake-expired KV committedAt", () => {
    // KV claims the commit is ancient, chain says it's 70s old — still usable.
    expect(chainCommitFreshness(BigInt(t + 89_930), t, t + 90_000)).toBe("ready");
  });
});

describe("isUintString (client-sent wei/nonce strings)", () => {
  it("accepts plain base-10 unsigned integers", () => {
    expect(isUintString("0")).toBe(true);
    expect(isUintString("123456789")).toBe(true);
    expect(isUintString("9".repeat(78))).toBe(true); // max uint256 is 78 digits
  });
  it("rejects everything BigInt() would coerce or throw on", () => {
    expect(isUintString("")).toBe(false); // BigInt("") === 0n
    expect(isUintString(" 1")).toBe(false); // BigInt trims whitespace
    expect(isUintString("0x1f")).toBe(false); // BigInt accepts hex
    expect(isUintString("-1")).toBe(false);
    expect(isUintString("1.5")).toBe(false);
    expect(isUintString("1e3")).toBe(false);
    expect(isUintString("abc")).toBe(false);
    expect(isUintString("9".repeat(79))).toBe(false); // wider than uint256
  });
});

describe("valueWithinBand (price band predicate)", () => {
  const price = 1000n;
  it("accepts the exact fresh price", () => expect(valueWithinBand(1000n, price)).toBe(true));
  it("accepts exactly 130% of price (ceiling inclusive)", () => expect(valueWithinBand(1300n, price)).toBe(true));
  it("rejects below the fresh price", () => expect(valueWithinBand(999n, price)).toBe(false));
  it("rejects above the 130% ceiling", () => expect(valueWithinBand(1301n, price)).toBe(false));
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
