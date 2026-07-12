import { describe, it, expect } from "vitest";
import { safeTxHash, buildCallSafeTx, packSignatures } from "./safe";

describe("safeTxHash", () => {
  it("matches the real Safe v1.4.1 getTransactionHash vector (Sepolia, verified on-chain)", () => {
    const tx = buildCallSafeTx({
      to: "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968",
      value: 3125000000000000n,
      data: "0xabcdef",
      nonce: 1n,
    });
    const h = safeTxHash("0xA2583373C52c7E8FcCEc0B860D59a9cF1ca608a9", 11155111, tx);
    expect(h).toBe("0x2553b70433facd7530fdfad5b7e01637cb68d1bcf63d819d82378a6741d3c597");
  });
});

describe("packSignatures", () => {
  it("sorts by signer ascending and concatenates the 65-byte signatures", () => {
    const hi = { signer: "0xBBBb000000000000000000000000000000000000" as `0x${string}`, signature: ("0x" + "11".repeat(65)) as `0x${string}` };
    const lo = { signer: "0xAAaa000000000000000000000000000000000000" as `0x${string}`, signature: ("0x" + "22".repeat(65)) as `0x${string}` };
    expect(packSignatures([hi, lo])).toBe(("0x" + "22".repeat(65) + "11".repeat(65)));
  });
});
