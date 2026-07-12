import { toHex } from "viem";

// ENS ETHRegistrarController + PublicResolver on SEPOLIA (verified live against the
// deployed contract, 2026-07-12). Solo registration runs on Sepolia per the
// Sepolia-first rule; a mainnet deployment swaps these for the mainnet addresses.
export const ENS_CONTROLLER = "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968" as const;
export const ENS_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" as const;
export const ONE_YEAR = 31536000n; // seconds
export const MIN_COMMIT_WAIT = 60; // controller minCommitmentAge (seconds)
export const MAX_COMMIT_AGE = 86400; // controller maxCommitmentAge (24h)
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

// Current (2024+) struct-based controller ABI. `register`/`makeCommitment` take the
// full Registration tuple; the commitment binds every field, so commit + register
// MUST pass an identical struct.
export const controllerAbi = [
  {
    type: "function",
    name: "available",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "rentPrice",
    stateMutability: "view",
    inputs: [
      { name: "label", type: "string" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "base", type: "uint256" },
          { name: "premium", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "makeCommitment",
    stateMutability: "pure",
    inputs: [
      {
        name: "registration",
        type: "tuple",
        components: [
          { name: "label", type: "string" },
          { name: "owner", type: "address" },
          { name: "duration", type: "uint256" },
          { name: "secret", type: "bytes32" },
          { name: "resolver", type: "address" },
          { name: "data", type: "bytes[]" },
          { name: "reverseRecord", type: "uint8" },
          { name: "referrer", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "commit",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "payable",
    inputs: [
      {
        name: "registration",
        type: "tuple",
        components: [
          { name: "label", type: "string" },
          { name: "owner", type: "address" },
          { name: "duration", type: "uint256" },
          { name: "secret", type: "bytes32" },
          { name: "resolver", type: "address" },
          { name: "data", type: "bytes[]" },
          { name: "reverseRecord", type: "uint8" },
          { name: "referrer", type: "bytes32" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

export type Registration = {
  label: string;
  owner: `0x${string}`;
  duration: bigint;
  secret: `0x${string}`;
  resolver: `0x${string}`;
  data: readonly `0x${string}`[];
  reverseRecord: number;
  referrer: `0x${string}`;
};

// 32 random bytes as the commit-reveal secret.
export function randomSecret(): `0x${string}` {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

// Derived deterministically from (label, owner, secret) so the struct is
// byte-identical between commit and register (otherwise the commitment won't match).
export function buildRegistration(label: string, owner: `0x${string}`, secret: `0x${string}`): Registration {
  return {
    label,
    owner,
    duration: ONE_YEAR,
    secret,
    resolver: ENS_RESOLVER,
    data: [],
    reverseRecord: 0,
    referrer: ZERO_BYTES32,
  };
}
