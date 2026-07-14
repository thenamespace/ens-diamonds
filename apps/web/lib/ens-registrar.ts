import { toHex } from "viem";
import { APP_CHAIN } from "./app-chain";

// ENS registration — chain-aware via lib/app-chain.ts. Two distinct on-chain
// flows share this module:
//
// Sepolia ("free-instant"): Sepolia migrated to the ENSv2 "premigration"
// setup (June 2026) — the old ETHRegistrarControllers were de-authorized on
// the BaseRegistrar, and registration now goes through
// TestnetV1PremigrationRegistrar: a single direct `register(Registration)`
// call, NO commit-reveal, and FREE (it refunds any ETH sent). The
// Registration tuple kept the v2 controller shape, so `secret` still exists
// in the struct but is ignored (we pass zero). Verified against the live
// contract + successful third-party registrations, 2026-07-14.
//
// Mainnet ("commit-reveal"): the real ETHRegistrarController v2 — paid,
// commit-reveal. Flow is commit(makeCommitment(reg)), wait at least
// MIN_COMMIT_WAIT (and no more than MAX_COMMIT_AGE), then
// register(reg) with `secret` matching what was committed and
// value >= rentPrice(label, duration). Addresses/mode come from
// lib/app-chain.ts; the error set below was verified against the live
// contract's Sourcify ABI, 2026-07-14 (the previously-hardcoded error names
// in an earlier version of this file were guessed and wrong).
export const ENS_CONTROLLER = APP_CHAIN.ensController;
export const ENS_BASE_REGISTRAR = APP_CHAIN.ensBaseRegistrar;
export const ENS_RESOLVER = APP_CHAIN.ensResolver;
export const REGISTRATION_MODE = APP_CHAIN.registrationMode;

export const ONE_YEAR = 31536000n; // seconds
export const MIN_COMMIT_WAIT = 60; // controller minCommitmentAge (seconds) — verified live on the mainnet controller, 2026-07-14
export const MAX_COMMIT_AGE = 86400; // controller maxCommitmentAge (24h) — verified live on the mainnet controller, 2026-07-14
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
// Shape of a valid commit-reveal secret (32 bytes, 0x-prefixed hex).
export const SECRET_RE = /^0x[0-9a-fA-F]{64}$/;

const registrationTupleInput = {
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
} as const;

// Sepolia's TestnetV1PremigrationRegistrar: one payable register() taking the
// Registration tuple, plus its custom errors so viem decodes reverts into
// readable names.
export const premigrationRegistrarAbi = [
  { type: "error", name: "NameNotAvailable", inputs: [{ name: "name", type: "string" }] },
  { type: "error", name: "DurationTooShort", inputs: [{ name: "duration", type: "uint256" }] },
  { type: "error", name: "ResolverRequiredWhenDataSupplied", inputs: [] },
  { type: "error", name: "ResolverRequiredForReverseRecord", inputs: [] },
  { type: "error", name: "ExpiryTooLarge", inputs: [{ name: "expiry", type: "uint256" }] },
  {
    type: "error",
    name: "RefundFailed",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "payable",
    inputs: [registrationTupleInput],
    outputs: [],
  },
] as const;

// Mainnet ETHRegistrarController v2: paid, commit-reveal. Error set verified
// against the live contract's Sourcify ABI, 2026-07-14.
export const v2ControllerAbi = [
  { type: "error", name: "CommitmentNotFound", inputs: [{ name: "commitment", type: "bytes32" }] },
  {
    type: "error",
    name: "CommitmentTooNew",
    inputs: [
      { name: "commitment", type: "bytes32" },
      { name: "validFrom", type: "uint256" },
      { name: "blockTimestamp", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "CommitmentTooOld",
    inputs: [
      { name: "commitment", type: "bytes32" },
      { name: "validTo", type: "uint256" },
      { name: "blockTimestamp", type: "uint256" },
    ],
  },
  { type: "error", name: "DurationTooShort", inputs: [{ name: "duration", type: "uint256" }] },
  { type: "error", name: "InsufficientValue", inputs: [] },
  { type: "error", name: "MaxCommitmentAgeTooHigh", inputs: [] },
  { type: "error", name: "MaxCommitmentAgeTooLow", inputs: [] },
  { type: "error", name: "NameNotAvailable", inputs: [{ name: "name", type: "string" }] },
  { type: "error", name: "ResolverRequiredForReverseRecord", inputs: [] },
  { type: "error", name: "ResolverRequiredWhenDataSupplied", inputs: [] },
  { type: "error", name: "UnexpiredCommitmentExists", inputs: [{ name: "commitment", type: "bytes32" }] },
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
    inputs: [registrationTupleInput],
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
    inputs: [registrationTupleInput],
    outputs: [],
  },
] as const;

// Which ABI actually applies to ENS_CONTROLLER on this deployment. Both ABIs
// share the same `register(Registration)` shape, so call sites that only use
// `functionName: "register"` (the common path across both modes) still get
// correct inference through this union. Call sites that need mode-specific
// functions (commit/makeCommitment/rentPrice/available) should import
// v2ControllerAbi directly instead.
export const controllerAbi: typeof v2ControllerAbi | typeof premigrationRegistrarAbi =
  REGISTRATION_MODE === "commit-reveal" ? v2ControllerAbi : premigrationRegistrarAbi;

// Availability comes from the BaseRegistrar (the registrar has no view for it):
// available(uint256(labelhash(label))). Use with viem's `labelhash`.
export const baseRegistrarAbi = [
  {
    type: "function",
    name: "available",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "nameExpires",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "uint256" }],
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

// 32 random bytes as the commit-reveal secret (mainnet only — the premigration
// registrar ignores `secret`, so Sepolia call sites simply omit it).
export function randomSecret(): `0x${string}` {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

// On Sepolia this is deterministic from (label, owner) — no secret needed (no
// commit-reveal on the premigration registrar), so any party can rebuild the
// identical struct. On mainnet, callers must pass the same `secret` used in
// commit() so the struct is byte-identical between commit and register
// (otherwise the commitment won't match).
export function buildRegistration(
  label: string,
  owner: `0x${string}`,
  secret: `0x${string}` = ZERO_BYTES32,
): Registration {
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
