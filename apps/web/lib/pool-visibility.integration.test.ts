import { describe, it, expect } from "vitest";
import { getPrivatePoolIds, setPoolPrivate } from "./pool-visibility";

const hasKv = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
const maybe = hasKv ? describe : describe.skip;

maybe("pool-visibility against Upstash", () => {
  const id = 999999;
  it("marks private, lists, and clears", async () => {
    await setPoolPrivate(id, false);
    await setPoolPrivate(id, true);
    expect(await getPrivatePoolIds()).toContain(id);
    await setPoolPrivate(id, false);
    expect(await getPrivatePoolIds()).not.toContain(id);
  }, 20000);
});
