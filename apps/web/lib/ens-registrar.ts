// ENS registration on SEPOLIA. Sepolia migrated to the ENSv2 "premigration"
// setup (June 2026): the old ETHRegistrarControllers were de-authorized on the
// BaseRegistrar, and registration now goes through TestnetV1PremigrationRegistrar
// — a single direct `register(Registration)` call, NO commit-reveal, and FREE
// (it refunds any ETH sent). The Registration tuple kept the v2 controller
// shape, so `secret` still exists in the struct but is ignored (we pass zero).
// Verified against the live contract + successful third-party registrations,
// 2026-07-14. A mainnet deployment swaps these for the mainnet controller flow.
export const ENS_CONTROLLER = "0xdf60C561Ca35AD3C89D24BbA854654b1c3477078" as const; // TestnetV1PremigrationRegistrar
export const ENS_BASE_REGISTRAR = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85" as const;
export const ENS_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" as const; // PublicResolver
export const ONE_YEAR = 31536000n; // seconds
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

// Registrar ABI: one payable register() taking the Registration tuple, plus its
// custom errors so viem decodes reverts into readable names.
export const controllerAbi = [
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

// Deterministic from (label, owner) — no secret needed (no commit-reveal on the
// premigration registrar), so any party can rebuild the identical struct.
export function buildRegistration(label: string, owner: `0x${string}`): Registration {
  return {
    label,
    owner,
    duration: ONE_YEAR,
    secret: ZERO_BYTES32,
    resolver: ENS_RESOLVER,
    data: [],
    reverseRecord: 0,
    referrer: ZERO_BYTES32,
  };
}
