import { describe, it, expect } from "vitest";
import { saveCommit, getCommit, saveSignature, getSignatures, clearSignatures, pinRegisterParams } from "./pool-registration";

const hasKv = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
const maybe = hasKv ? describe : describe.skip;

maybe("pool-registration against Upstash", () => {
  const id = 999998; // throwaway pool id

  it("stores a commit, pins params, collects and clears signatures", async () => {
    await saveCommit(id, { secret: "0x" + "ab".repeat(32), committedAt: 1000, safe: "0xsafe", label: "coffertest" });
    expect((await getCommit(id))?.label).toBe("coffertest");

    await pinRegisterParams(id, "123", "5");
    const pinned = await getCommit(id);
    expect(pinned?.regValue).toBe("123");
    expect(pinned?.regNonce).toBe("5");

    await saveSignature(id, "0xAbC0000000000000000000000000000000000001", "0xdead");
    expect((await getSignatures(id)).length).toBe(1);

    await clearSignatures(id);
    expect((await getSignatures(id)).length).toBe(0);
    expect((await getCommit(id))?.regValue).toBeUndefined();

    // cleanup: a fresh saveCommit wipes then we leave a harmless throwaway record
    await saveCommit(id, { secret: "0x" + "00".repeat(32), committedAt: 0, safe: "0x0", label: "x" });
  }, 25000);
});
