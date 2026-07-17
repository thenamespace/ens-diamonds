# Coffer — Product & Technical Specification (v1)

**Status:** Approved for implementation
**Target:** Production, Ethereum mainnet
**Audience:** This document is written to be handed directly to an AI coding agent. It contains product requirements, the full smart-contract interface, page-by-page frontend requirements, data architecture, and build phasing. Where a decision has been deliberately made, it is stated as final; genuinely open items are collected in §12.

---

## 1. Problem Statement

Premium ENS names (expired names in ENS's 21-day Dutch-auction premium phase) cost thousands to tens of thousands of dollars — out of reach for most individuals. Coffer lets groups pool ETH to buy a name together: contributions are held in a purpose-built escrow contract with unilateral refund rights, and on success the pool deploys a Safe multisig owned by all contributors, which registers and holds the name. No single member can drain the funds or abscond with the domain, and no member's funds can ever be held hostage before the purchase.

## 2. Locked Decisions (do not revisit during implementation)

| Decision | Choice |
|---|---|
| Network | Ethereum mainnet (develop/test on Sepolia + mainnet forks) |
| Name scope | **Expired .eth names in the Dutch-auction premium phase only.** No secondary market, no never-registered names. |
| Custody | Custom `CofferEscrow` contract (Foundry) for the funding phase → Safe multisig deployed at finalization holds funds and the name |
| Safe signers | **Every contributor becomes a Safe owner.** Safe is deployed at finalization (not at pool creation) so the owner set is exactly the people who actually paid. |
| Auto-buy | **None.** Registration is executed manually via threshold signatures. The app may *alert* members about price, but never transacts autonomously. |
| Fees | None in v1. No fee logic anywhere in the contract. |
| Ownership shares | App-level ledger, **derived exclusively from on-chain escrow events** (deposit amounts / total). No share tokens. The database caches but never defines ownership. |
| Deposit asset | ETH only |
| Pool access | Invite-only. The creator defines the invitee list at creation. |

## 3. Goals & Non-Goals

### Goals
1. A group of 2–10 people can go from "we want defi.eth" to "the Safe owns defi.eth" entirely through the app, with no CLI or Etherscan usage.
2. Any contributor can exit with a full refund, without anyone else's permission, at any point before the execution lock (see §5.4).
3. Ownership percentages shown in the app are always exactly reconstructable from chain events alone.
4. Zero unaudited code holds user funds at launch: the only custom contract is `CofferEscrow`, and it ships audited. Safe and ENS contracts are used as-deployed.
5. Members can track and renew owned names before expiry from the Portfolio page.

### Non-Goals (v1)
- **No auto-buy / keeper execution** — removed from scope by decision; do not build pre-signed-tx or Safe-module infrastructure.
- **No tokenized (ERC-20/1155) shares** — shares are informational; transfers/resale of shares is v2+.
- **No secondary-market purchases** (Seaport/marketplace integrations) — different trust model, v2+.
- **No public/open pools** — strangers pooling funds raises the stakes considerably; invite-only keeps v1 social-trust-based.
- **No ERC-20 deposits** — registration is paid in ETH; accepting USDC adds a swap problem.
- **No protocol fees** — keeps the contract surface minimal for audit.

## 4. System Architecture

```
┌─────────────────────────── Monorepo (pnpm workspaces) ───────────────────────────┐
│                                                                                   │
│  packages/contracts        apps/indexer              apps/web                     │
│  ─────────────────         ─────────────             ────────                     │
│  CofferEscrow.sol          ponder.sh app             Next.js (App Router)         │
│  Foundry tests             - CofferEscrow events     wagmi v2 + viem              │
│  Deploy scripts            - ENS expiry tracking     RainbowKit                   │
│                            → Postgres                Safe Protocol Kit            │
│                                                      Safe Transaction Service     │
│                                                                                   │
│  apps/notifier: invite + alert delivery (Resend email, Telegram Bot API)          │
└───────────────────────────────────────────────────────────────────────────────────┘

External dependencies (mainnet, used as-deployed — never modified):
- Safe: SafeProxyFactory + Safe singleton (current canonical v1.4.1 deployments)
- ENS: ETHRegistrarController, BaseRegistrarImplementation, ENS Public Resolver
- ENS Subgraph (The Graph) for expiry/registration data
- Safe Transaction Service (hosted, mainnet) for off-chain signature collection
```

**Source-of-truth rules:**
- Who contributed what → `CofferEscrow` events, indexed by ponder.
- Current premium price → live `rentPrice()` call on ETHRegistrarController. Never compute the premium locally for display of the authoritative number (a local decay curve may be drawn for charts, but the "Buy now" figure is always a contract read).
- Name ownership/expiry → ENS registry/BaseRegistrar + subgraph.
- Postgres holds only: pool display metadata, invites and their delivery status, notification preferences, curation lists. It must be fully rebuildable (except invites/prefs) from chain + subgraph.

## 5. Smart Contract: `CofferEscrow`

A single (singleton) contract managing all pools by ID. Written in Solidity ≥0.8.24, built and tested with Foundry. No proxy, no upgradability, no owner/admin functions, no pause switch — immutability is the security model. Uses checks-effects-interactions and a reentrancy guard on all ETH-moving functions.

### 5.1 Storage

```solidity
enum PoolStatus { Funding, Funded, Finalized, Expired }
// Status is partially derived: see status() view below. Stored fields:

struct Pool {
    string  label;            // plaintext .eth label, e.g. "defi" (no ".eth")
    address creator;
    uint96  targetAmount;     // in wei
    uint96  totalDeposited;
    uint40  fundingDeadline;  // unix ts; pool expires if target not met by then
    uint40  fundedAt;         // set when totalDeposited first reaches targetAmount
    uint8   threshold;        // Safe threshold, set at creation
    address safe;             // zero until finalized
}

mapping(uint256 => Pool) public pools;                       // poolId => Pool
mapping(uint256 => mapping(address => uint96)) public deposits;
mapping(uint256 => mapping(address => bool)) public invited;
mapping(uint256 => address[]) internal contributors;         // enumerable, deduped
uint256 public poolCount;
uint256 public constant EXECUTION_WINDOW = 7 days;           // see §12 open questions
uint96  public constant MIN_CONTRIBUTION = 0.01 ether;       // anti-dust / anti-grief
```

### 5.2 Functions

```solidity
function createPool(
    string calldata label,
    uint96 targetAmount,
    uint40 fundingDeadline,
    uint8 threshold,
    address[] calldata invitees
) external returns (uint256 poolId);
```
- Requirements: `targetAmount > 0`; `fundingDeadline > block.timestamp`; `1 <= threshold <= invitees.length + 1`; label non-empty, length ≥ 3 (ENS minimum). The creator is automatically invited. Duplicate invitees are deduped (or reverted — implementer's choice, but behavior must be tested).
- Emits `PoolCreated(poolId, label, creator, targetAmount, fundingDeadline, threshold, invitees)`.

```solidity
function deposit(uint256 poolId) external payable;
```
- Requirements: caller is invited; pool status is `Funding`; `msg.value >= MIN_CONTRIBUTION` (unless topping up an existing deposit); `totalDeposited + msg.value <= targetAmount` — **deposits that would overshoot the target revert** (deterministic ownership math; the UI caps the input at the remaining amount).
- First-time depositors are appended to `contributors[poolId]`.
- If this deposit reaches the target exactly, set `fundedAt = block.timestamp` and emit `PoolFunded(poolId)`.
- Emits `Deposited(poolId, member, amount, totalDeposited)`.

```solidity
function withdraw(uint256 poolId) external;
```
- Withdraws the caller's **entire** deposit (no partial withdrawals — keeps accounting simple).
- Allowed when: status is `Funding`; OR status is `Expired`; OR the pool reached target but `block.timestamp > fundedAt + EXECUTION_WINDOW` and it was never finalized (the lock lapsed — pool drops back to `Funding` semantics, since totalDeposited falls below target).
- **Blocked** during `[fundedAt, fundedAt + EXECUTION_WINDOW]` while fully funded — this is the execution lock that prevents a member from yanking funds seconds before the buy. Members see and accept this window at deposit time (UI requirement).
- Removes caller from `contributors` (swap-and-pop). Resets `fundedAt = 0` if the withdrawal takes the pool below target after a lapsed lock.
- Emits `Withdrawn(poolId, member, amount, totalDeposited)`.

```solidity
function finalize(uint256 poolId) external returns (address safe);
```
- Callable by **any contributor** when status is `Funded` and within the execution window.
- Requires `contributors.length >= threshold` (see §12 — the UI must surface this risk during funding).
- Deploys a Safe via the canonical `SafeProxyFactory.createProxyWithNonce`, initialized with `setup(owners = contributors[poolId], threshold = pool.threshold, ...)` and no modules, no fallback-handler surprises — exactly the standard Safe setup used by the official UI. Use `poolId` in the salt for deterministic addressing.
- Transfers the full pool balance to the Safe in the same transaction (revert on failure).
- Sets `pool.safe`, status becomes `Finalized`. Emits `PoolFinalized(poolId, safe, contributors, threshold, amount)`.

```solidity
function status(uint256 poolId) public view returns (PoolStatus);
function ownershipBps(uint256 poolId, address member) external view returns (uint256);
function getContributors(uint256 poolId) external view returns (address[] memory, uint96[] memory);
```
- `status()` derives: `Finalized` if safe set; `Expired` if deadline passed and not funded; `Funded` if at target and within window; else `Funding`.
- `ownershipBps` = `deposits[poolId][member] * 10_000 / targetAmount` — this is the canonical share formula the app displays.

### 5.3 What the escrow deliberately does NOT do
- It never calls ENS. Registration is the Safe's job, post-finalization.
- It holds no funds after finalization and has no claim on the Safe.
- It has no admin. If the Safe factory address needs to change, that is a new escrow deployment (factory + singleton addresses are constructor-set immutables).

### 5.4 Security & testing requirements (P0, blocking)
- Foundry unit tests for every function, every revert path.
- Invariant tests: (a) `address(escrow).balance == Σ totalDeposited` over all non-finalized pools; (b) `Σ deposits[poolId][*] == totalDeposited`; (c) a contributor can always withdraw outside the lock window; (d) finalize sweeps exactly `targetAmount`.
- Fuzz deposit/withdraw sequences across multiple pools and actors.
- Fork tests against mainnet: real SafeProxyFactory deployment, then a full commit→register of a test name through the deployed Safe on an Anvil mainnet fork.
- Reentrancy: withdraw and finalize guarded; ETH sends via `call` with success check.
- External audit of `CofferEscrow` is a launch gate. Contract must be frozen before audit; findings addressed; deployed bytecode verified on Etherscan.

## 6. ENS Integration (registration mechanics)

All against ENS's current mainnet `ETHRegistrarController` (resolve the canonical address via ENS docs/registry at implementation time — do not hardcode from memory without verification) and the public resolver.

**Premium phase primer (drives Discover/Name pages):** a .eth name expires, sits in a 90-day grace period (owner can still renew), then enters a 21-day Dutch auction where `rentPrice()` returns base rent + a premium that starts at $100,000,000 (USD, oracle-priced in ETH) and decays exponentially, halving every day, reaching $0 after day 21. A name is "in premium" when `now > expiry + 90d` and `now < expiry + 111d`.

**Registration flow (the Execute page implements this exactly):**
1. **Collect signatures first.** Build the Safe transaction: `to = ETHRegistrarController`, `value = price + buffer`, `data = register(label, owner = safeAddress, duration, secret, resolver = publicResolver, data = [], reverseRecord = false, ownerControlledFuses = 0)`. Propose it to the Safe Transaction Service; members sign off-chain via the app. Safe signatures do not expire, so this can happen over days while the premium decays.
2. **Commit.** Once threshold signatures exist and members decide the price is right, any member's EOA sends `commit(makeCommitment(...))` — the commitment is a salted hash, leaks nothing, and does not need to come from the Safe. The `secret` is generated client-side, stored in the pool's DB record AND shown to members for safekeeping.
3. **Wait ≥ 60 seconds** (min commitment age). Mainnet commitments expire after 24 hours — the UI must drive commit→register within one session/day, and re-commit if expired.
4. **Register via the Safe.** Any member executes the pre-signed Safe transaction. `value` should be current `rentPrice` + ~10% buffer for decay/ETH-price drift between signing and execution — **the controller refunds overpayment automatically**, so the buffer costs nothing.
5. Confirm ownership: BaseRegistrar `ownerOf(labelId) == safe`. Update pool status to "Name acquired" in the app.

**Renewals (Portfolio page):** `renew(label, duration)` is permissionlessly payable — any member may renew from their own wallet without a multisig round, OR the pool can renew from Safe funds via a threshold transaction. Offer both paths in the UI.

**Failure case — name sniped:** if someone else registers the name while a pool is funding or mid-signature, the indexer detects the `NameRegistered` event, marks the pool "Sniped", notifies all members, and the dashboard surfaces one-click withdrawal (escrow is still `Funding`, so withdrawals are unilateral). If sniped *after* finalization (funds already in the Safe), the dashboard offers the **Refund flow**: a proposed Safe transaction batching pro-rata sends back to all contributors (MultiSend), needing threshold signatures.

## 7. Frontend — Page-by-Page Requirements

Next.js App Router. Wallet: RainbowKit + wagmi v2 + viem. Safe interactions: Safe Protocol Kit (`@safe-global/protocol-kit`) + Safe Transaction Service API (`@safe-global/api-kit`). All monetary displays show ETH with USD equivalent (Chainlink ETH/USD or the same oracle path ENS uses). Routes given below are canonical.

### 7.1 `/` — Discover
Browse names currently in the premium auction, curated (see §8.2).
- **P0:** grid/list of curated in-premium names: label, current total price (live `rentPrice`, refreshed ≤60s), days/hours left in premium, count of active Coffer pools on that name. Sort by price and by time-remaining; filter by label length and price range. Clicking → Name page.
- **P0:** clear empty state when curation yields nothing.
- **P1:** search any label to check its status (active / grace / premium / available), even if not curated.
- Acceptance: given a name whose premium is decaying, when the user refreshes within a minute, then the displayed price is within one refresh interval of the on-chain `rentPrice`.

### 7.2 `/name/[label]` — Name Page
- **P0:** current price breakdown (base rent + premium), time left in premium, and a decay chart: the premium curve from auction start to zero with a "you are here" marker (chart may be locally computed; the headline number is a contract read).
- **P0:** list of active pools for this name (progress, target, members count) with Join links for invitees; "Start a pool" CTA prefilling the label.
- **P0:** if the name is not in premium: show its actual state (active until X / in grace until Y / fully released — then base price only) rather than an error.
- Acceptance: given a name registered by someone else five minutes ago, when the page loads, then it shows "registered" state and pool creation is disabled.

### 7.3 `/pools/new` — Start a Pool
Form → one `createPool` transaction.
- **P0 fields:** name (prefilled or searched, validated in-premium), target amount (defaulting to current price + configurable % buffer, editable, with a warning that decay means overshoot is refunded at registration), funding deadline, creator's own contribution (deposited in a second tx immediately after creation), threshold, invitee list.
- **P0 invitees:** each row accepts an ENS name or raw address. ENS names resolve to an address; the app also reads their `email` and `org.telegram` text records and shows which delivery channels are available (delivery handled by notifier, §9). Raw addresses get a copyable invite link only.
- **P0 threshold UX:** show the resulting scheme ("3 of up to 6 signers"). **Hard-warn on N-of-N** ("one unresponsive member freezes the Safe forever") and warn when threshold is close to invitee count that "if fewer than {threshold} people actually contribute, the pool cannot finalize."
- **P0 disclosure step (must be acknowledged before tx):** funds lock for the execution window (7 days) once target is hit; every contributor becomes a Safe signer with equal signing power regardless of contribution size; shares are proportional to deposits.
- Acceptance: given an invitee list of 4 and threshold 5, when the creator submits, then the form blocks with a validation error (threshold ≤ invitees + creator).

### 7.4 `/pools/[id]` — Pool Dashboard
The hub for a pool through its whole life. Tabs/sections: Funding, Members, Multisig, Execute (§7.5), Activity.
- **P0 Funding:** progress bar (totalDeposited/target), deadline countdown, the caller's own deposit/withdraw controls (deposit input capped at remaining amount; withdraw disabled with explanation during the execution lock, showing lock expiry time).
- **P0 Members:** every invitee with status (invited / contributed X ETH / withdrew), ownership % (from `ownershipBps`), and deposit timestamps. Percentages must sum to 100% of the funded amount.
- **P0 Multisig:** before finalization, "Safe not yet deployed — deploys at finalization with all contributors as owners." After: Safe address (link to app.safe.global), threshold, owner list, live balance, network.
- **P0 state banners:** Funded (execution window countdown + Finalize button), Expired (withdraw prompt), Sniped (withdraw / refund flow), Name acquired (link to Portfolio).
- **P0 Finalize action:** any contributor triggers `finalize()`; blocked with explanation if contributors < threshold.
- **P1 Activity:** chronological event feed from indexer (created, deposits, withdrawals, funded, finalized, committed, registered).
- Acceptance: given a pool funded 2 days ago, when a contributor opens Funding, then withdraw is disabled and shows "locked until {fundedAt + 7d}".

### 7.5 Execute (within pool dashboard)
Implements §6 flow. Only visible post-finalization while the name is still unregistered.
- **P0 signature tracker:** the proposed Safe registration transaction with live price readout ("registering now costs ~X ETH; pool holds Y"), each owner's signed/pending state, one-click sign (EIP-712 via Safe Protocol Kit → Safe Transaction Service).
- **P0 price context:** decay chart with projected dates for prices the pool balance can cover; a "your balance covers the price on ~{date}" marker. Pure information — no automation.
- **P0 commit step:** enabled at threshold signatures. Generates + stores the secret, sends `commit()` from the clicking member's EOA, then shows the 60-second timer and the 24-hour expiry deadline; auto-advances to Register. Handle expired commitments by offering re-commit.
- **P0 register step:** executes the signed Safe tx with `value = current rentPrice × 1.10`; on success show ownership confirmation (BaseRegistrar `ownerOf` == Safe) and celebrate.
- **P0 insufficient-balance guard:** if current price > Safe balance, disable register and show the projected date the decayed price crosses the balance.
- Acceptance: given threshold signatures collected and a valid ≥60s-old commitment, when a member clicks Register and the tx confirms, then the pool state becomes "Name acquired" and the Portfolio lists the name.

### 7.6 `/portfolio` — Portfolio
Everything the connected wallet co-owns across pools.
- **P0 per name:** label, owning Safe, acquisition cost, your %, your cost basis, expiry date with urgency states (>90d / <90d / in grace), renew action (choose: pay personally, or propose Safe tx).
- **P1:** estimated current value (comparable premium sales are unreliable — if no sane source, show acquisition cost and label it as such; do not invent valuations).
- **P0 empty state** with pointer to Discover.

### 7.7 Refund flow (dashboard action, post-finalization)
- **P0:** one click builds a MultiSend Safe transaction returning the Safe's ETH pro-rata to contributors (from escrow-event shares), proposes it to the Safe Transaction Service, and notifies all owners to sign. Available any time the Safe holds ETH and members want out (sniped, changed minds, wind-down after a sale).

## 8. Indexer & Data (apps/indexer)

### 8.1 ponder.sh app indexing
- `CofferEscrow` events (all of §5.2) → tables: `pools`, `deposits_ledger`, `pool_members` — the ownership source of truth.
- ENS `NameRegistered` / `NameRenewed` for (a) names with active pools — snipe detection must trigger notifications within minutes; (b) names owned by Coffer Safes — expiry tracking for Portfolio.

### 8.2 Premium-name curation (Discover feed)
- Nightly job queries the ENS subgraph for domains with `expiry + 90d < now < expiry + 111d`.
- Curation filter (config-driven, tunable without deploy): label length ≤ 6, OR label in bundled English dictionary/top-crypto-terms wordlist; exclude labels with hyphens or non-ASCII (v1 simplicity; revisit for emoji/IDN later).
- Live prices are still fetched client-side from `rentPrice`; the DB stores only the candidate list.

### 8.3 Postgres (app DB, non-authoritative)
Tables: `pool_meta` (poolId, description, chat link), `invites` (poolId, address, ens_name, channel, delivery status, invite token), `users` (address, notification prefs, verified email/telegram), `notifications_log`, `curated_names`. Rebuild rule from §4 applies.

## 9. Notifier (apps/notifier)

- **Invites:** on pool creation, for each ENS-named invitee read `email` / `org.telegram` text records via viem. Email → Resend; Telegram → Bot API (deep-link the bot; message the handle after the user starts the bot — Telegram bots cannot DM cold). Every invite also gets a copyable link with a signed token.
- **Alerts (P0):** pool funded (sign-up call to action), signatures complete (ready to commit), name sniped, execution lock expiring in 24h, owned name entering 90-day-to-expiry and grace period.
- **Price alerts (P1):** member-set "notify me when {label} premium ≤ X ETH" — this is the human-in-the-loop replacement for auto-buy.
- All messages contain deep links back to the relevant pool page. Unsubscribe honored per channel.

## 10. Configuration & Environments

- Env vars: `MAINNET_RPC_URL`, `WALLETCONNECT_PROJECT_ID`, `SAFE_TX_SERVICE_URL`, `ENS_SUBGRAPH_URL`, `DATABASE_URL`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ESCROW_ADDRESS`, plus Sepolia equivalents.
- Contract addresses (Safe factory/singleton, ENS controller/registrar/resolver) live in a single `addresses.ts` per chain, each verified against canonical deployment lists at implementation time — **never trusted from model memory.**
- Environments: local (Anvil mainnet fork — full E2E incl. real ENS/Safe bytecode), Sepolia staging (ENS + Safe both live there), mainnet.

## 11. Build Phases

Phase 1 is on the critical path (audit lead time); 2–3 proceed in parallel with it.
1. **Contracts:** `CofferEscrow` + full Foundry suite (§5.4) + deploy scripts → freeze → audit. *Exit: audit passed, Sepolia deployment verified.*
2. **Read-only web:** Discover + Name pages + indexer curation + live pricing. No wallet writes. *Exit: prices match on-chain within refresh interval; decay chart correct against contract reads.*
3. **Pool lifecycle:** create / invite links / deposit / withdraw / dashboard, on Sepolia against the pre-audit contract. *Exit: full fund→expire→withdraw and fund→lock cycles pass E2E.*
4. **Finalize + Execute:** Safe deployment, signature collection, commit-reveal registration. *Exit: a Sepolia pool registers a real test name end-to-end through the UI.*
5. **Portfolio + renewals + refund flow.**
6. **Notifier:** invites and alert triggers.
7. **Mainnet launch gate:** audit complete, mainnet fork E2E green, addresses re-verified, runbook for the sniped/expired/lock-lapse paths written.

## 12. Open Questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| 1 | Execution lock duration: fixed 7 days, or per-pool (bounded 1–14d) set at creation? Spec assumes fixed 7d. | Product | Blocks Phase 1 freeze |
| 2 | If contributors < threshold at target (few people covered the whole amount): hard-block finalize (current spec) vs. allow contributors to unanimously lower the threshold? | Product | Blocks Phase 1 freeze |
| 3 | Duplicate invitees in `createPool`: dedupe silently or revert? (Behavioral, must be decided + tested.) | Eng | Blocks Phase 1 freeze |
| 4 | Legal review: does pooling funds for a joint asset purchase trigger money-transmission/securities considerations in target jurisdictions? | Legal | Blocks mainnet launch, not development |
| 5 | Portfolio "estimated current value" data source, or ship without (P1)? | Product | No |
| 6 | Curation wordlist contents and whether Discover shows an unfiltered "everything in premium" toggle. | Product | No |

## 13. Success Metrics (post-launch, 60-day review)

- ≥ 5 pools created and ≥ 2 names successfully registered through the full flow (activation).
- Zero funds-loss incidents; zero pools where a withdrawal-eligible member was unable to withdraw (the core promise).
- Median time from "pool funded" to "name registered" < 7 days (execution flow is not the bottleneck).
- ≥ 80% of invitees with resolvable contact records receive a delivered invite (notifier effectiveness).
