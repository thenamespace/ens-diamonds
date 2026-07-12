import { hashTypedData, type Address, type Hex } from "viem";

// Minimal Safe v1.4.1 ABI — just what we need to build + execute one transaction.
export const safeAbi = [
  { type: "function", name: "nonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getThreshold", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getOwners", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
  {
    type: "function",
    name: "isOwner",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "execTransaction",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "signatures", type: "bytes" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// SafeTx EIP-712 struct. Domain is { chainId, verifyingContract: safe } (no name/
// version for Safe v1.4.1). Verified against on-chain getTransactionHash 2026-07-12.
export const SAFE_TX_TYPES = {
  SafeTx: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "operation", type: "uint8" },
    { name: "safeTxGas", type: "uint256" },
    { name: "baseGas", type: "uint256" },
    { name: "gasPrice", type: "uint256" },
    { name: "gasToken", type: "address" },
    { name: "refundReceiver", type: "address" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export type SafeTx = {
  to: Address;
  value: bigint;
  data: Hex;
  operation: number;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
  nonce: bigint;
};

// A plain Call SafeTx with every gas/refund field zeroed (gas is paid by the EOA
// that submits execTransaction, not the Safe).
export function buildCallSafeTx({ to, value, data, nonce }: { to: Address; value: bigint; data: Hex; nonce: bigint }): SafeTx {
  return {
    to,
    value,
    data,
    operation: 0,
    safeTxGas: 0n,
    baseGas: 0n,
    gasPrice: 0n,
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    nonce,
  };
}

// EIP-712 domain for signTypedData / recoverTypedDataAddress with SAFE_TX_TYPES.
export function safeTxDomain(safe: Address, chainId: number) {
  return { chainId, verifyingContract: safe } as const;
}

// The safeTxHash owners sign. Matches Safe v1.4.1 getTransactionHash exactly.
export function safeTxHash(safe: Address, chainId: number, tx: SafeTx): Hex {
  return hashTypedData({ domain: safeTxDomain(safe, chainId), types: SAFE_TX_TYPES, primaryType: "SafeTx", message: tx });
}

// Concatenate 65-byte ECDSA signatures sorted ascending by signer address — the
// order Safe's execTransaction requires when validating multiple signatures.
export function packSignatures(sigs: { signer: Address; signature: Hex }[]): Hex {
  const sorted = [...sigs].sort((a, b) => (a.signer.toLowerCase() < b.signer.toLowerCase() ? -1 : 1));
  return ("0x" + sorted.map((s) => s.signature.slice(2)).join("")) as Hex;
}
