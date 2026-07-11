import { describe, it, expect } from "vitest";
import { addWatch, removeWatch, getWatched } from "./watchlist";

// Runs only when an Upstash/KV REST URL is present (mirrors the other guarded
// integration tests). Uses a throwaway address so it can't collide with real data.
const hasKv = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
const maybe = hasKv ? describe : describe.skip;

maybe("watchlist against Upstash", () => {
  const addr = "0x000000000000000000000000000000000000dEaD";

  it(
    "adds, lists, and removes a label",
    async () => {
      await removeWatch(addr, "coffertest"); // clean slate
      await addWatch(addr, "coffertest");
      const after = await getWatched(addr);
      expect(after).toContain("coffertest");
      await removeWatch(addr, "coffertest");
      const gone = await getWatched(addr);
      expect(gone).not.toContain("coffertest");
    },
    20000,
  );
});
