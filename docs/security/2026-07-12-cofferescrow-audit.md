# CofferEscrow — Internal Security Review (pre-mainnet)

**Date:** 2026-07-12
**Reviewer:** Claude (3 independent adversarial passes + controller synthesis)
**Scope:** `packages/contracts/src/CofferEscrow.sol` + interfaces. ENS-registration and Safe governance are downstream/out of the escrow's scope but assessed where the escrow chooses parameters.
**Status:** Internal review — **a professional third-party audit is still recommended before the contract holds real mainnet funds.** Claude is a strong reviewer, not a substitute for an audit firm when money is at stake.

## RESOLUTION (2026-07-12)
- **HIGH-1 FIXED** — `threshold` is no longer a `createPool` param; it's a strict **majority of actual contributors** (`N/2 + 1`), derived at finalize. A funded pool is therefore always finalizable (permanent-lock precondition gone), and a **same-block withdraw→re-deposit guard** (`SameBlock()`) closes the re-arm griefing. Also fixes **LOW-1** (no 1-of-N rug possible). New contract redeployed to Sepolia at **`0x4D47f73c2b04390cA2eF877c7DA00954399C27EB`**; verified live end-to-end (create→fund→finalize, real Safe `0x7204B2e2…` deployed, threshold correctly = majority).
- **HIGH-2 FIXED** — constructor now reverts `InvalidSafeConfig()` if any Safe address has no code; the CREATE2 prediction was verified against Safe v1.4.1 source AND **proven live** (the new escrow's finalize deployed a real Safe at the predicted address). Foundry suite: 41 pass. *Follow-up:* the mainnet fork test's ENS interface is still the stale positional shape (registration was validated separately in the buy-solo/pool-register work) — modernize to struct-based during the mainnet migration.
- **MEDIUM-1 FIXED** — `/pools` no longer iterates `poolCount`; it reads `PoolCreated` logs once (bounded from the escrow deploy block) and only fetches details for a paginated slice (30/page + "Load more"), so spam pools can't DoS the directory.
- **MEDIUM-2 FIXED** — `deposit` now accepts a partial fill and refunds any excess instead of reverting `Overshoot` (added `nonReentrant` for the refund), removing the deposit front-run race. Contract redeployed to Sepolia **`0xa356c3B14e183670E3d88F6F0e91F95598A29943`** (supersedes the HIGH-only deploy).
- **REMAINING before mainnet:** fork-test ENS struct modernization, invariant-fuzzer `finalize`/force-feed coverage, and a professional third-party audit.

## Verdict

The contract is **well-built and free of fund-theft vulnerabilities.** Accounting, reentrancy, cross-pool isolation, integer safety, the CREATE2 address prediction, and the squatter-adoption pattern are all **sound and verified** (the CREATE2 derivation was checked byte-for-byte against Safe v1.4.1 source; the adoption pattern is cryptographically safe). 38 unit tests pass; the invariant suite runs 2048 calls with no violation.

There is **one HIGH griefing/fund-lock issue** and **one HIGH readiness gap** that must be fixed before mainnet, plus medium/low hardening items. None are theft vectors; the worst case is funds locked or a pool that can't finalize.

## Findings

### HIGH-1 — Under-threshold pool can be permanently locked (griefing)
**`deposit` (:177) sets `Funded` without checking `contributors.length >= threshold`; `finalize` (:214) then reverts `BelowThreshold`.**
A pool can reach its target with fewer distinct depositors than `threshold` (e.g. one whale funds a `threshold=2` pool, or two fund a `threshold=3` pool). Then `finalize` is permanently impossible. During the 7-day window `withdraw` is locked; after it, `status` flips back to `Funding` — but a griefer who is one of the depositors can **atomically `withdraw()` then `deposit()` the exact gap** in one transaction (exact-gap bypasses `MIN_CONTRIBUTION`), resetting `fundedAt` and re-arming a fresh 7-day lock, front-running any honest withdraw. A co-depositor's funds can be locked **forever** (contract is immutable — no admin/pause/rescue). The griefer sacrifices their own principal to do it.
*Conditions:* pool has `contributors < threshold` at target **and** the funding deadline is still in the future after the window. When `contributors >= threshold`, the escape is that anyone can `finalize` — so the worst case degrades to "forced finalization" (funds go to the Safe the members co-own), not loss.
**Fix (small, closes both):** in `deposit`, when the deposit completes the target, require `contributors[poolId].length >= p.threshold` (reject the filling deposit otherwise). This guarantees every `Funded` pool is finalizable, eliminating the permanent lock. Optionally also make `fundedAt` non-re-armable (latch first-funded, or a same-block withdraw→deposit cooldown) to fully close the withdrawal-denial grief.

### HIGH-2 — The Safe/ENS integration has never run against real contracts (readiness)
**`test/CofferEscrow.fork.t.sol:18-24` has all canonical addresses stubbed to `address(0)` and `vm.skip`s; `constructor` (:94) does zero validation.**
`finalize` correctness depends entirely on `predicted == actual` and on the factory/singleton/handler being the real canonical Safe v1.4.1 contracts. The unit tests use mocks and prove nothing about the real derivation. A wrong/typo'd/wrong-version address at deploy → `SafeDeployFailed` on **every** funded pool (funds still refundable after 7 days, but no name ever bought — total product liveness failure, undetected until first mainnet finalize).
**Fix (before mainnet):**
- Fill the fork test with the verified canonical mainnet addresses and run it against a mainnet fork with `MAINNET_RPC_URL`:
  - SafeProxyFactory `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67`
  - Safe L1 singleton `0x41675C099F32341bf84BFc5382aF534df5C7461a`
  - CompatibilityFallbackHandler `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99`
  (Mainnet `Safe`, not `SafeL2`; confirmed it accepts plain-ETH funding via its `receive()`.)
- Add constructor guards: `require(factory.code.length > 0)` etc., or hard-code the canonical addresses as constants so a deploy script can't get them wrong.

### MEDIUM-1 — Directory DoS via free, unbounded `createPool`
`createPool` (:125) is permissionless and free; `poolCount` grows unboundedly; the frontend `/pools` iterates `0..poolCount` doing 2–3 reads per pool. A few thousand spam pools break the directory for everyone (spam pools default to public). Contract stays functional; this is a **frontend DoS enabled by the on-chain iteration pattern**.
**Fix (frontend, durable):** index `PoolCreated` events (subgraph/server log scan) + paginate + curate; stop iterating `poolCount` on-chain. (Optional contract-side anti-spam fee/rate-limit, but off-chain indexing is the real fix.)

### MEDIUM-2 — `Overshoot` makes deposits front-runnable
`deposit` (:163-164) reverts if `msg.value > remaining`, so a co-invited griefer can front-run a member's deposit with a tiny one, reverting the victim's tx and wasting their gas (repeatable). Member-vs-member only; griefer commits their own funds.
**Fix:** accept `min(msg.value, remaining)` and refund/credit the excess instead of reverting — removes the race and simplifies the exact-gap/`MIN_CONTRIBUTION` special case.

### LOW-1 — `threshold = 1` with multiple owners is a rug footgun
`createPool` permits `threshold >= 1` (:135). A 1-of-N Safe lets any single co-owner unilaterally move the registered name / drain residual Safe ETH post-finalize. Escrow advertises proportional `ownershipBps` but Safe control is flat per-owner.
**Fix:** consider disallowing `threshold = 1` when `owners > 1`, or require a majority; at minimum surface prominently in the UI.

### LOW-2 / INFO
- **Force-fed ETH** (selfdestruct) is unrecoverable (no `receive`/sweep) — not a theft vector; the security-relevant invariant `balance >= Σ pool totals` holds. Accepted trade-off of the no-admin design.
- **Contributor ordering** affects the predicted Safe address (swap-pop reordering) — frontend must read `getContributors` at finalize time, not reconstruct order.
- **Dead check** `if (safe == address(0))` (:241) is unreachable — harmless.
- **Global reentrancy guard** couples all pools within one call stack — safe, transient.

### Test coverage gaps to close before mainnet
- The invariant fuzzer's handler never calls `finalize` or force-feeds ETH — the balance invariant is never fuzzed across the funded→finalized boundary. Add both.
- Add tests for HIGH-1 (the re-arm lock) and its fix, and MEDIUM-2's partial-fill behavior.

## Recommended sequence before mainnet
1. **Fix HIGH-1** (require `contributors >= threshold` at funding; optionally de-arm `fundedAt`). Small, high-value.
2. **Fix HIGH-2** (real fork test + constructor guards + verified addresses).
3. MEDIUM-1 (frontend event-indexing) and MEDIUM-2 (partial-fill) — recommended.
4. LOW-1 threshold policy decision.
5. Close the test-coverage gaps.
6. **Then** commission a professional audit before the contract holds real funds, and only then do the mainnet migration.
