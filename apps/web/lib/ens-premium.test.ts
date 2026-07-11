import { describe, it, expect } from "vitest";
import { premiumProgress } from "./ens-premium";

const DAY = 86400;
const GRACE = 90 * DAY;
const PREMIUM = 21 * DAY;
const now = 1_000_000_000;

describe("premiumProgress", () => {
  it("day 0 the moment the name is released (expiry + grace = now)", () => {
    const r = premiumProgress(now - GRACE, now);
    expect(r.dayIntoPremium).toBe(0);
    expect(r.premiumEndsAt).toBe(now - GRACE + GRACE + PREMIUM);
  });
  it("counts whole days into the premium window", () => {
    expect(premiumProgress(now - GRACE - 5 * DAY, now).dayIntoPremium).toBe(5);
  });
  it("clamps to 21 past the end of the window", () => {
    expect(premiumProgress(now - GRACE - 30 * DAY, now).dayIntoPremium).toBe(21);
  });
  it("clamps to 0 before release (still in grace)", () => {
    expect(premiumProgress(now - GRACE + 5 * DAY, now).dayIntoPremium).toBe(0);
  });
});
