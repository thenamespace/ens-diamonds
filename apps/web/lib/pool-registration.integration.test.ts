import { describe, it, expect } from "vitest";
import { getRegParams, pinRegisterParams, saveSignature, getSignatures, clearSignatures, saveCommit, getCommit, clearCommit } from "./pool-registration";

const hasKv = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
const maybe = hasKv ? describe : describe.skip;

maybe("pool-registration against Upstash", () => {
  const id = 999998; // throwaway pool id

  it("pins params, collects and clears signatures", async () => {
    await pinRegisterParams(id, "0", "5");
    const pinned = await getRegParams(id);
    expect(pinned?.regValue).toBe("0");
    expect(pinned?.regNonce).toBe("5");

    await saveSignature(id, "0xAbC0000000000000000000000000000000000001", "0xdead");
    expect((await getSignatures(id)).length).toBe(1);

    await clearSignatures(id);
    expect((await getSignatures(id)).length).toBe(0);
    expect(await getRegParams(id)).toBeNull();
  }, 25000);

  it("stores and clears a commit record", async () => {
    await saveCommit(id, { secret: ("0x" + "ab".repeat(32)) as `0x${string}`, committedAt: 1000, safe: "0xsafe", label: "coffertest" });
    const rec = await getCommit(id);
    expect(rec?.label).toBe("coffertest");
    expect(rec?.committedAt).toBe(1000);
    expect(rec?.secret).toBe("0x" + "ab".repeat(32));
    await clearCommit(id);
    expect(await getCommit(id)).toBeNull();
  }, 25000);
});
