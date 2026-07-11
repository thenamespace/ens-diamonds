import { describe, it, expect } from "vitest";
import { deriveStatus, weiToUsd, DAY, GRACE, PREMIUM } from "./ens-name";

const now = 1_000_000_000;

describe("deriveStatus", () => {
  it("active when expiry is in the future", () => {
    expect(deriveStatus(now + DAY, now)).toBe("active");
  });
  it("grace just after expiry", () => {
    expect(deriveStatus(now - DAY, now)).toBe("grace");
  });
  it("grace at the last second of the grace window", () => {
    expect(deriveStatus(now - GRACE + 1, now)).toBe("grace");
  });
  it("premium exactly when grace ends", () => {
    expect(deriveStatus(now - GRACE, now)).toBe("premium");
  });
  it("premium near the end of the premium window", () => {
    expect(deriveStatus(now - GRACE - PREMIUM + 1, now)).toBe("premium");
  });
  it("available once the premium window passes", () => {
    expect(deriveStatus(now - GRACE - PREMIUM, now)).toBe("available");
  });
  it("available for a never-registered name (expiry 0)", () => {
    expect(deriveStatus(0, now)).toBe("available");
  });
  it("uses a custom gracePeriod when provided (shorter grace)", () => {
    // With a 10-day grace, a name expired 15 days ago is already in premium.
    expect(deriveStatus(now - 15 * DAY, now, 10 * DAY)).toBe("premium");
  });
  it("defaults gracePeriod to 90 days when omitted", () => {
    // Same 15-days-expired name is still in grace under the 90-day default.
    expect(deriveStatus(now - 15 * DAY, now)).toBe("grace");
  });
});

describe("weiToUsd", () => {
  it("converts 1 ETH at $2000", () => {
    expect(weiToUsd(10n ** 18n, 2000)).toBe(2000);
  });
  it("returns null when ethUsd is null", () => {
    expect(weiToUsd(10n ** 18n, null)).toBeNull();
  });
});
