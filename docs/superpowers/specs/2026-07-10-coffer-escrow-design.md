# CofferEscrow — Phase 1 Design Spec

**Status:** Approved for implementation planning
**Scope:** Phase 1 only — the `CofferEscrow` smart contract + Foundry test suite + deploy script. No indexer, web, or notifier in this phase.
**Parent spec:** `coffer-product-spec.md` (§5, §11 Phase 1)
**Date:** 2026-07-10

---

## 1. Purpose

`CofferEscrow` is the single custom on-chain component that holds user funds during a pool's funding phase and, at finalization, deploys a Safe multisig owned by all contributors and hands it the pooled ETH. Immutability is the security model: no proxy, no upgradability, no owner/admin, no pause. It is the audit bottleneck (§11) and defines the event shape every later phase indexes, so it is built first and frozen for audit before anything depends on it.

## 2. Locked decisions for this phase

These were decided during brainstorming and are final for the Phase-1 freeze:

| # | Decision | Choice |
|---|---|---|
| Lock duration (§12 Q1) | Fixed vs per-pool | **Fixed 7 days** as a compile-time constant `EXECUTION_WINDOW`. |
| Threshold shortfall (§12 Q2) | Block vs unanimous lower | **Hard-block:** `finalize()` reverts if `contributors.length < threshold`. Funds stay recoverable via `withdraw` once the lock lapses. No on-chain threshold-lowering mechanism. |
| Duplicate invitees (§12 Q3) | Dedupe vs revert | **Revert** the whole `createPool` tx on any duplicate invitee. |
| Final-gap fill (finding B) | Strict MIN vs exact-gap | **Allow exact-gap deposit:** `msg.value >= MIN_CONTRIBUTION` OR `msg.value == remaining-to-target` OR caller is topping up an existing deposit. |
| Safe fallback handler (addition) | Include or omit | **Include** the canonical `CompatibilityFallbackHandler` in Safe setup (matches the official Safe UI; required for EIP-1271 signature validation). Added as a third constructor immutable. |

### 2.1 Post-security-review hardening (added after implementation review)

A security review of the completed contract produced two MEDIUM findings and minor items. The following changes were made and re-tested before freeze:

| Change | Finding | Choice |
|---|---|---|
| Safe-address squat resistance | ① `finalize` griefing | **Adopt-existing Safe.** `finalize` computes the deterministic Safe address (`saltNonce = poolId`) and, if a contract already exists there, adopts and funds it instead of reverting. Safe because the CREATE2 salt binds `keccak256(initializer)`, so any code at that address must have the intended owner set. Neutralizes front-run/pre-deploy squatting while preserving deterministic addressing. Requires `proxyCreationCode()` on the factory interface and a `_computeSafeAddress` helper. The deploy path self-checks the prediction (`SafeDeployFailed` on mismatch). **Mainnet launch gate:** `_computeSafeAddress` is proven correct only against the mock; the fork tests must be populated with canonical v1.4.1 addresses + a `MAINNET_RPC_URL` and must pass — including the adopt-path fork test — before mainnet. Until then the derivation is unverified against the real factory. |
| Owner-count bound | ② `finalize` gas-DoS | **`MAX_OWNERS = 10`.** `createPool` reverts `TooManyOwners` if `invitees.length + 1 > MAX_OWNERS`, keeping the contributor set — and thus the Safe deployment and all loops — bounded. Matches the product's 2–10-people-per-pool cap. |
| `ownershipBps` guard | ④ div-by-zero | Returns `0` when `targetAmount == 0` (nonexistent pool) instead of panicking. |

**Auditor notes (accepted / by-design, no code change):**
- **Unreachable threshold (finding ③):** `threshold` may be set as high as `invitees.length + 1`; if the creator never deposits, `finalize` can be permanently `BelowThreshold`. Funds remain withdrawable after the lock lapses. This is the intended hard-block behavior (§2 threshold-shortfall decision) and is surfaced by the UI warnings in product spec §7.3.
- **`finalize` CEI ordering (finding ⑥):** `p.safe` is set after the external factory call. Assessed safe — the whole function is `nonReentrant`, `deposit` is status-gated (`Funded` blocks it) and moves no ETH out, and a failed fund transfer reverts atomically (no finalized-but-unfunded state).
- **Force-fed ETH (finding ⑦):** ETH sent via `selfdestruct` is unrecoverable (no sweep, no admin). Accepted under the immutable/no-admin design.

## 3. Contract shape

- Solidity `^0.8.24`, built/tested with Foundry.
- Singleton managing all pools by `poolId`. No proxy, no upgradability, no admin/owner functions, no pause.
- Checks-effects-interactions on all state changes; reentrancy guard on every ETH-moving function (`withdraw`, `finalize`).
- ETH sends via `call` with an explicit success check; revert on failure.

### 3.1 Immutables (constructor-set)

```
address public immutable safeProxyFactory;      // canonical SafeProxyFactory v1.4.1
address public immutable safeSingleton;          // canonical Safe singleton v1.4.1
address public immutable safeFallbackHandler;    // canonical CompatibilityFallbackHandler
```

If any canonical Safe address must change, that is a new escrow deployment — never an upgrade. All three verified against canonical deployment lists at deploy time; never trusted from model memory.

### 3.2 Storage

```solidity
enum PoolStatus { Funding, Funded, Finalized, Expired }

struct Pool {
    string  label;           // plaintext .eth label, e.g. "defi" (no ".eth")
    address creator;
    uint96  targetAmount;    // wei
    uint96  totalDeposited;  // wei
    uint40  fundingDeadline; // unix ts
    uint40  fundedAt;        // set when totalDeposited first reaches target; reset to 0 if it later drops below
    uint8   threshold;       // Safe threshold, set at creation
    address safe;            // zero until finalized
}

mapping(uint256 => Pool) public pools;
mapping(uint256 => mapping(address => uint96)) public deposits;
mapping(uint256 => mapping(address => bool)) public invited;
mapping(uint256 => address[]) internal contributors;   // enumerable, deduped by first-deposit append
uint256 public poolCount;

uint256 public constant EXECUTION_WINDOW = 7 days;
uint96  public constant MIN_CONTRIBUTION = 0.01 ether;
uint256 public constant MAX_OWNERS = 10;   // §2.1 hardening: bounds contributor set / Safe owners (2–10 per pool)
```

Errors (custom): `InvalidTarget`, `InvalidDeadline`, `LabelTooShort`, `InvalidThreshold`, `TooManyOwners`, `DuplicateInvitee`, `NotInvited`, `WrongStatus`, `ZeroValue`, `BelowMinimum`, `Overshoot`, `NoDeposit`, `WithdrawLocked`, `NotContributor`, `BelowThreshold`, `SafeDeployFailed`, `TransferFailed`, `Reentrancy`.

## 4. State machine

`status(poolId)` is derived (no explicit stored status enum), in this order:

1. `safe != address(0)` → **Finalized**
2. else if `totalDeposited == targetAmount`:
   - `block.timestamp <= fundedAt + EXECUTION_WINDOW` → **Funded** (execution lock active)
   - else → **Funding** (lock lapsed while fully funded but never finalized; funds withdrawable again)
3. else if `block.timestamp > fundingDeadline` → **Expired**
4. else → **Funding**

Consequences:
- `finalize` is only reachable in **Funded**, so it is inherently within-window and at-target.
- `deposit` is only reachable in **Funding**. In the lapsed-lock case `remaining == 0`, so any nonzero deposit overshoots and reverts — no new deposits until a withdrawal reopens room.
- `withdraw` is allowed in **Funding** or **Expired**; the lapsed-lock case is **Funding**, so it is covered without a special branch.

## 5. Functions

### 5.1 `createPool(string label, uint96 targetAmount, uint40 fundingDeadline, uint8 threshold, address[] invitees) → uint256 poolId`
- Requires: `targetAmount > 0`; `fundingDeadline > block.timestamp`; `bytes(label).length >= 3`; `1 <= threshold <= invitees.length + 1`.
- **Reverts on any duplicate invitee** (locked decision). Creator is auto-invited (set `invited[poolId][creator] = true`); if the creator also appears in `invitees`, that is treated as a duplicate and reverts.
- Sets `invited[poolId][invitee] = true` for each invitee. Does not deposit.
- Emits `PoolCreated(poolId, label, creator, targetAmount, fundingDeadline, threshold, invitees)`.

### 5.2 `deposit(uint256 poolId) payable`
- Requires: `invited[poolId][msg.sender]`; `status == Funding`; `msg.value > 0`; `totalDeposited + msg.value <= targetAmount` (overshoot reverts).
- Amount rule: `msg.value >= MIN_CONTRIBUTION` **OR** `msg.value == targetAmount - totalDeposited` (exact gap close) **OR** `deposits[poolId][msg.sender] > 0` (top-up).
- First-time depositor appended to `contributors[poolId]`.
- If `totalDeposited` reaches `targetAmount` exactly: set `fundedAt = block.timestamp`, emit `PoolFunded(poolId)`.
- Emits `Deposited(poolId, member, amount, totalDeposited)`.

### 5.3 `withdraw(uint256 poolId)`
- Requires: `status == Funding || status == Expired`; caller has a nonzero deposit.
- Withdraws the caller's **entire** deposit (no partial). Zero `deposits[poolId][caller]`, swap-and-pop from `contributors`, decrement `totalDeposited`.
- If this drops `totalDeposited` below `targetAmount` and `fundedAt != 0`, reset `fundedAt = 0`.
- CEI + reentrancy guard; ETH via `call` with success check.
- Emits `Withdrawn(poolId, member, amount, totalDeposited)`.

### 5.4 `finalize(uint256 poolId) → address safe`
- Requires: `status == Funded`; caller is a contributor (`deposits[poolId][caller] > 0`, else `NotContributor`); `contributors[poolId].length >= threshold` (hard-block).
- Builds `initializer = Safe.setup(owners = contributors[poolId], threshold = pool.threshold, to = 0, data = 0x, fallbackHandler = safeFallbackHandler, paymentToken = 0, payment = 0, paymentReceiver = 0)` — no modules — and the deterministic address via `_computeSafeAddress(initializer, poolId)`.
- **Adopt-existing (§2.1 hardening):** if no contract exists at the predicted address, deploy via `SafeProxyFactory.createProxyWithNonce(safeSingleton, initializer, poolId)` and assert the returned address equals the prediction (`SafeDeployFailed` otherwise). If a contract already exists there, adopt it (it is provably the intended Safe — the salt binds the initializer).
- Sets `pool.safe = safe` (status becomes Finalized), then transfers exactly `targetAmount` to the Safe (revert on failure). Guarded.
- Emits `PoolFinalized(poolId, safe, contributors, threshold, amount)`.

### 5.5 Views
- `status(uint256 poolId) → PoolStatus` — per §4.
- `ownershipBps(uint256 poolId, address member) → uint256` = `deposits[poolId][member] * 10_000 / targetAmount`; returns `0` when `targetAmount == 0` (nonexistent pool). Sums to 10_000 once fully funded.
- `getContributors(uint256 poolId) → (address[], uint96[])`.

## 6. Events

```
PoolCreated(uint256 indexed poolId, string label, address indexed creator, uint96 targetAmount, uint40 fundingDeadline, uint8 threshold, address[] invitees)
Deposited(uint256 indexed poolId, address indexed member, uint96 amount, uint96 totalDeposited)
Withdrawn(uint256 indexed poolId, address indexed member, uint96 amount, uint96 totalDeposited)
PoolFunded(uint256 indexed poolId)
PoolFinalized(uint256 indexed poolId, address indexed safe, address[] contributors, uint8 threshold, uint96 amount)
```

These are the ownership source of truth for the indexer; the DB caches but never defines ownership.

## 7. What the contract deliberately does NOT do

- Never calls ENS. Registration is the Safe's job, post-finalization.
- Holds no funds after finalization; has no claim on the Safe.
- Has no admin, no pause, no upgrade path.

## 8. Test plan (P0, audit-gating)

- **Unit:** every function × every revert path, including: not-invited deposit; overshoot; sub-MIN non-gap deposit; exact-gap deposit success; top-up below MIN success; withdraw during lock reverts; withdraw after lapse succeeds; finalize below threshold reverts; finalize outside window reverts; duplicate-invitee createPool reverts; threshold bound violations; label length < 3.
- **Invariants (§5.4):** (a) `address(escrow).balance == Σ totalDeposited` over all non-finalized pools; (b) `Σ deposits[poolId][*] == totalDeposited`; (c) a contributor can always withdraw outside the lock window; (d) `finalize` sweeps exactly `targetAmount`.
- **Fuzz:** randomized deposit/withdraw sequences across multiple pools and actors.
- **Fork (mainnet):** real `SafeProxyFactory` — `finalize` deploys a valid Safe with the expected owners/threshold/fallback handler and receives exactly `targetAmount`; then a full `commit → wait → register` of a test name executed through the deployed Safe on an Anvil mainnet fork, asserting `BaseRegistrar.ownerOf(labelId) == safe`.
- **Reentrancy:** `withdraw` and `finalize` guarded; malicious-receiver test.

## 9. Repo shape (this phase)

```
/ (pnpm workspace root: pnpm-workspace.yaml, package.json, .gitignore)
└── packages/contracts/
    ├── foundry.toml
    ├── remappings.txt
    ├── .env.example          # MAINNET_RPC_URL, deployer key var, Safe/ENS addresses
    ├── src/
    │   ├── CofferEscrow.sol
    │   └── interfaces/        # ISafeProxyFactory, ISafe (setup), IETHRegistrarController, IBaseRegistrar
    ├── test/
    │   ├── CofferEscrow.t.sol         # unit + revert paths
    │   ├── CofferEscrow.invariant.t.sol
    │   └── CofferEscrow.fork.t.sol    # mainnet-fork Safe + ENS register
    └── script/Deploy.s.sol
```

The workspace root is created so later phases (indexer, web, notifier) slot in, but only `packages/contracts` is built in Phase 1.

## 10. Out of scope (later phases)

Indexer (ponder), web (Next.js/wagmi/Safe Kit), notifier, the Execute/commit-reveal UI flow, and the pre-signed-Safe-value resolution (finding A) all belong to later phases and are not addressed here. The contract does not participate in ENS registration; it only deploys the Safe and funds it.
