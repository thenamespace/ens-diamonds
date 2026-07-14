import { describe, it, expect } from "vitest";
import { makeLimiter } from "./rate-limit";

// Fake of the atomic INCR+EXPIRE-on-first-hit script the limiter evals: the
// count and the TTL are set in one step, mirroring Redis's single-threaded
// script execution.
function fakeKv() {
  const m = new Map<string, { n: number; exp: number }>();
  const kv = {
    eval: async (_script: string, keys: string[], args: unknown[]) => {
      const e = m.get(keys[0]) ?? { n: 0, exp: 0 };
      e.n += 1;
      if (e.n === 1) e.exp = Number(args[0]);
      m.set(keys[0], e);
      return e.n;
    },
  };
  return { kv, m };
}

describe("rate limiter", () => {
  it("allows up to the cap then blocks", async () => {
    const limit = makeLimiter(fakeKv().kv as never, { max: 3, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "sign")).toBe(false);
  });
  it("keys are isolated per id", async () => {
    const limit = makeLimiter(fakeKv().kv as never, { max: 1, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:2", "sign")).toBe(true);
  });
  it("buckets are isolated per route", async () => {
    const limit = makeLimiter(fakeKv().kv as never, { max: 1, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "record")).toBe(true);
  });
  it("sets the TTL atomically with the first increment (no expiry-less key)", async () => {
    const { kv, m } = fakeKv();
    const limit = makeLimiter(kv as never, { max: 3, windowSec: 60 });
    await limit("ip:1", "sign");
    expect(m.get("rl:sign:ip:1")?.exp).toBe(60);
    // Later hits don't extend the window (fixed window, not sliding).
    await limit("ip:1", "sign");
    expect(m.get("rl:sign:ip:1")).toEqual({ n: 2, exp: 60 });
  });
  it("fails open on KV errors", async () => {
    const broken = { eval: async () => { throw new Error("down"); } };
    const limit = makeLimiter(broken as never, { max: 1, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
  });
  it("fails open on an unexpected script reply", async () => {
    const weird = { eval: async () => "not-a-number" };
    const limit = makeLimiter(weird as never, { max: 1, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
  });
});
