import { describe, it, expect } from "vitest";
import { normalizeLabel } from "./watchlist";

describe("normalizeLabel", () => {
  it("strips .eth and lowercases/normalizes", () => {
    expect(normalizeLabel("Vitalik.eth")).toBe("vitalik");
    expect(normalizeLabel("defi")).toBe("defi");
  });
  it("rejects labels under 3 chars", () => {
    expect(normalizeLabel("ab")).toBeNull();
    expect(normalizeLabel("a.eth")).toBeNull();
  });
  it("rejects unnormalizable input", () => {
    expect(normalizeLabel("bad name with spaces!!")).toBeNull();
  });
});
