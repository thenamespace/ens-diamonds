import { describe, it, expect } from "vitest";
import { isPoolVisible } from "./pool-filter";

const C = "0xAAaAAAAaaAAAAaAAAAaaAAaaaAaAaaAAAAaaAAaa";
const V = "0xBBbBBBBbbBBBbbBBBBbbBBbbbBbBbbBBBBbbBBbb";

describe("isPoolVisible", () => {
  it("public pool is visible to everyone (even not connected)", () =>
    expect(isPoolVisible({ isPrivate: false, viewer: null, creator: C, invited: false })).toBe(true));
  it("private pool hidden when not connected", () =>
    expect(isPoolVisible({ isPrivate: true, viewer: null, creator: C, invited: false })).toBe(false));
  it("private pool hidden from a non-member", () =>
    expect(isPoolVisible({ isPrivate: true, viewer: V, creator: C, invited: false })).toBe(false));
  it("private pool visible to its creator (case-insensitive)", () =>
    expect(isPoolVisible({ isPrivate: true, viewer: C.toLowerCase(), creator: C, invited: false })).toBe(true));
  it("private pool visible to an invited viewer", () =>
    expect(isPoolVisible({ isPrivate: true, viewer: V, creator: C, invited: true })).toBe(true));
});
