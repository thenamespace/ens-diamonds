import { describe, it, expect } from "vitest";
import { makeLimiter } from "./rate-limit";

function fakeKv() {
  const m = new Map<string, { n: number; exp: number }>();
  return {
    incr: async (k: string) => {
      const e = m.get(k) ?? { n: 0, exp: 0 };
      e.n += 1;
      m.set(k, e);
      return e.n;
    },
    expire: async (k: string, s: number) => {
      const e = m.get(k);
      if (e) e.exp = s;
      return 1;
    },
  };
}

describe("rate limiter", () => {
  it("allows up to the cap then blocks", async () => {
    const limit = makeLimiter(fakeKv() as never, { max: 3, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "sign")).toBe(false);
  });
  it("keys are isolated per id", async () => {
    const limit = makeLimiter(fakeKv() as never, { max: 1, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:2", "sign")).toBe(true);
  });
  it("buckets are isolated per route", async () => {
    const limit = makeLimiter(fakeKv() as never, { max: 1, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "record")).toBe(true);
  });
  it("fails open on KV errors", async () => {
    const broken = { incr: async () => { throw new Error("down"); }, expire: async () => 1 };
    const limit = makeLimiter(broken as never, { max: 1, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
  });
});
