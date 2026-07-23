> IMPORTANT DISCLAIMER: This report is an AI-generated security scan and does not constitute a comprehensive security audit. This report has been generated in part by artificial intelligence ("AI") systems. The findings, analyses, and conclusions presented herein are derived from automated processes and may contain inaccuracies, omissions, errors, or misinterpretations. While reasonable efforts have been made to ensure the quality and accuracy of the information, no representation or warranty, express or implied, is made regarding the completeness, reliability, or accuracy of the results. CertiK's standard security audits are comprehensive manual reviews conducted by expert auditors; this AI-generated scan is a separate development tool designed to identify vulnerabilities before the audit. All findings should be treated as advisory in nature and should not be relied upon as a substitute for a comprehensive manual security review. This report is provided for informational purposes only and does not constitute financial, legal, regulatory, tax, or investment advice. The recipient is solely responsible for any decisions made based on the contents of this report and is solely responsible for verifying the accuracy and applicability of any findings before taking action based on this report.
>
> This report is intended for internal development use only and must not be used (i) to represent that the protocol has been "audited by CertiK" or other similar representation, or (ii) to make security claims to users, investors, the public or anyone else. Protocols handling real user funds or preparing for mainnet deployment should require a comprehensive manual security audit. Neither CertiK nor its affiliates, officers, or employees shall be liable for any loss, damage, or consequence arising directly or indirectly from the use of, or reliance on, the information contained in this AI-generated report. To the maximum extent permitted by law, CertiK disclaims all liability for any loss, damage, or costs arising from reliance on or use of this report.

## Export Metadata

- Scan Mode: Ultra

# Report for Project [unknown_project]()

Report Date: 2026-07-22 01:39:05

Task ID: `34498231-abaa-5e0d-afe1-cd4f4f894e08`

## Commit: 

### File: [src/EnsDiamondsEscrow.sol]()

#### Finding 1

**Title:** [Discussion] Missing Validation on targetAmount Allows Bypass of MIN_CONTRIBUTION Limit

**Category:** incorrect-calculation

**Severity:** Info

**Location:**

*Start Line:* 138

*End Line:* 138

**Description:**

The supplied `createPool` implementation validates only that `targetAmount` is non-zero and does not require it to be at least `MIN_CONTRIBUTION` (0.01 ether). Consequently, it permits creation of pools with dust targets, such as 1 wei. If `deposit` exempts an exact remaining gap from its `BelowMinimum` check as described, a 1 wei deposit could exactly fund such a pool despite being below the minimum contribution threshold.

However, the available context does not establish whether this behavior is exploitable or violates an intended protocol invariant. The implementations of `deposit` and `finalize`, relevant constants and inherited code, access controls, finalization prerequisites, and documented scope or intended handling of dust pools were not available for confirmation. In particular, it remains unclear whether exact-gap deposits are intentionally permitted for sub-minimum targets, whether finalization can deploy a Safe and transfer the dust balance under these conditions, and whether other controls prevent or make this flow immaterial.

Further investigation should review the complete `createPool`, `deposit`, and `finalize` logic; the definition and intended use of `MIN_CONTRIBUTION`; README or audit-scope documentation; and tests covering sub-minimum targets and exact-gap deposits. If those checks confirm that a dust pool can be funded and finalized, the described sequence would bypass the minimum-contribution policy and allow Safe deployment with negligible ETH.

```
function createPool(
        string calldata label,
        uint96 targetAmount,
        uint40 fundingDeadline,
        address[] calldata invitees
    ) external returns (uint256 poolId) {
        if (targetAmount == 0) revert InvalidTarget();
        if (fundingDeadline <= block.timestamp) revert InvalidDeadline();
        if (bytes(label).length < 3) revert LabelTooShort();
        if (invitees.length + 1 > MAX_OWNERS) revert TooManyOwners();

        poolId = poolCount++;
        Pool storage p = pools[poolId];
        p.label = label;
        p.creator = msg.sender;
        p.targetAmount = targetAmount;
        p.fundingDeadline = fundingDeadline;
        // p.threshold is derived from the actual contributor count at finalize
        // (majority), so it is never set here and no misconfiguration is possible.

        invited[poolId][msg.sender] = true; // creator auto-invited

        for (uint256 i = 0; i < invitees.length; i++) {
            address invitee = invitees[i];
            if (invited[poolId][invitee]) revert DuplicateInvitee(); // also catches creator-in-invitees
            invited[poolId][invitee] = true;
        }

        emit PoolCreated(poolId, label, msg.sender, targetAmount, fundingDeadline, invitees);
    }
```

**Recommendation:**

**Scenario:**

A user creates a pool with `targetAmount` set to 1 wei, which passes `createPool` because only a non-zero target is required. If `deposit` permits a contribution equal to the remaining funding gap despite being below `MIN_CONTRIBUTION`, a 1 wei deposit exactly reaches the target and funds the dust pool.

**Proof of Concept:**

---

#### Finding 2

**Title:** [Discussion] Silent Intent Subversion: Post-Clamping isExactGap Conflates Overpayment with Gap-Filling, Allowing Trivial-Stake Safe Owners Through BelowMinimum Bypass

**Category:** incorrect-calculation

**Severity:** Info

**Location:**

*Start Line:* 182

*End Line:* 182

**Description:**

The deposit logic clamps `amount` to `remaining` before evaluating `isExactGap`: `amount = msg.value > remaining ? remaining : uint96(msg.value)`, followed by `isExactGap = amount == remaining`. Consequently, any call with `msg.value >= remaining` evaluates as an exact gap after clamping, even when the caller originally overpaid. For a first-time depositor, this causes the `BelowMinimum` check to be skipped when `remaining < MIN_CONTRIBUTION`, and the caller is appended to `contributors[]` with only the clamped, potentially trivial stake. Any excess is refunded through an external `.call`, while reaching the target arms `fundedAt` in the same transaction, which may prevent an immediate withdrawal during Funded status. For example, with a 1 ether target, deposits of 0.5 ether and 0.495 ether leave a 0.005 ether gap. A first-time caller sending 5 ether is clamped to 0.005 ether, refunded 4.995 ether, bypasses the minimum-contribution guard, and funds the pool. This behavior applies to final gaps from 1 wei through `MIN_CONTRIBUTION - 1` wei.

It remains unresolved whether this behavior creates an exploitable governance or custody risk rather than an intended final-gap admission path. The supplied code establishes the post-clamping predicate and minimum-bypass behavior, but does not establish that a `contributors[]` entry becomes a Safe owner or signer, the applicable Safe threshold and proposal semantics, whether contributor admission or deposits are permissioned or deduplicated, or whether a dust participant can practically influence or control assets. The asserted example of a 0.005 ether participant receiving voting power equivalent to larger contributors, including the stated 2-of-3 threshold and relative bribery cost, depends on those unverified integrations. The pool creation, Safe deployment/configuration, contributor-handling, withdrawal, and governance code, together with tests and documented scope or severity criteria, should be examined to determine whether overpaying a sub-minimum final gap grants economically meaningful authority and whether the behavior is intended.

```
// L182: amount is clamped to remaining BEFORE isExactGap is computed
uint96 amount = msg.value > remaining ? remaining : uint96(msg.value);
uint256 refund = msg.value - amount;

bool isTopUp = deposits[poolId][msg.sender] > 0;
// L186: isExactGap computed on POST-clamping amount — conflates intentional
// gap-filling with mechanical overpayment
bool isExactGap = amount == remaining;
// L187: BelowMinimum bypassed for isExactGap=true — ANY deposit where
// msg.value >= remaining skips the MIN_CONTRIBUTION floor
if (!isTopUp && !isExactGap && amount < MIN_CONTRIBUTION) revert BelowMinimum();

if (!isTopUp) {
    // L190: first-time depositor pushed to contributors[] with clamped
    // (potentially sub-MIN_CONTRIBUTION) stake
    contributors[poolId].push(msg.sender);
}
deposits[poolId][msg.sender] += amount;
p.totalDeposited += amount;

// L195-198: fundedAt armed same-tx, blocking immediate withdrawal
if (p.totalDeposited == p.targetAmount) {
    p.fundedAt = uint40(block.timestamp);
    emit PoolFunded(poolId);
}
```

**Recommendation:**

**Scenario:**

When a pool has a remaining amount below `MIN_CONTRIBUTION`, a first-time depositor can send `msg.value` greater than or equal to that remaining amount. The contract clamps their credited deposit to the remaining amount, treats it as an exact gap, skips the minimum-contribution check, adds the depositor to `contributors[]`, refunds the excess, and marks the pool funded.

**Proof of Concept:**

---

#### Finding 3

**Title:** [Discussion] Permanent fund lock in stuck-Funding state when contributors are contracts that reject ETH — withdraw's push transfer hard-reverts with no alternative unwind path

**Category:** design-issue

**Severity:** Discussion

**Location:**

*Start Line:* 113

*End Line:* 118

**Description:**

The `withdraw()` function sends ETH to `msg.sender` through an unrestricted-gas `.call{value: amount}("")`. If the contributor is a smart contract whose `receive()` or `fallback()` function reverts, the transfer fails and `TransferFailed()` reverts the entire transaction atomically. Although the function follows checks-effects-interactions, the effects at L217-226 are rolled back when the transfer fails, leaving the contributor's deposit and the pool state unchanged.

If `totalDeposited == targetAmount` and the execution window has elapsed, `status()` returns `Funding` rather than `Funded` or `Finalized`. In this state, further deposits are unavailable because `remaining == 0`; `finalize()` is unavailable after the execution window; and an ETH-rejecting contributor cannot withdraw through the current push-payment path. If every remaining contributor rejects ETH, their deposits cannot be redeemed through `withdraw()`. `createPool()` does not validate invitee code length or ETH-receive capability, and `targetAmount` has no stated upper bound, so the affected value may be significant.

However, it is unclear whether this constitutes an attacker-caused permanent asset freeze. A contributor that fills the target amount is expected to have an available `finalize()` route during the execution window. Therefore, a creator's refusal to deposit or finalize does not, by itself, prevent a target-filling victim contributor from finalizing during that window. The currently confirmed outcome requires affected contributors to use contracts that reject ETH and to not invoke the available finalization path before the window expires; it may consequently be an avoidable lifecycle and recipient-design failure rather than a protocol invariant that an external attacker can force.

Further investigation should confirm `finalize()` authorization and invocation requirements, whether a contract-wallet contributor can practically call it, and whether any actor can prevent or invalidate finalization during the execution window. If an externally enforceable path to the lapsed target-full state exists, the withdrawal design should provide a recovery mechanism that does not require ETH delivery to `msg.sender`, such as crediting a withdrawable balance claimable to a specified compatible recipient, or an authorized completion/settlement escape hatch.

```
// L209-231: withdraw() — CEI with push ETH transfer that hard-reverts for rejecting contracts
function withdraw(uint256 poolId) external nonReentrant {
    Pool storage p = pools[poolId];
    PoolStatus s = status(poolId);
    if (s != PoolStatus.Funding && s != PoolStatus.Expired) revert WithdrawLocked();

    uint96 amount = deposits[poolId][msg.sender];
    if (amount == 0) revert NoDeposit();

    // effects (L217-226) — committed before transfer, rolled back if transfer fails
    deposits[poolId][msg.sender] = 0;
    p.totalDeposited -= amount;
    withdrawBlock[poolId][msg.sender] = block.number;
    _removeContributor(poolId, msg.sender);
    if (p.totalDeposited < p.targetAmount && p.fundedAt != 0) {
        p.fundedAt = 0;
    }

    emit Withdrawn(poolId, msg.sender, amount, p.totalDeposited);

    // interaction (L229-230) — push transfer, no gas limit, hard-reverts on failure
    (bool ok,) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();
}

// L110-121: status() — stuck-Funding returns Funding (not Funded, not Finalized)
function status(uint256 poolId) public view returns (PoolStatus) {
    Pool storage p = pools[poolId];
    if (p.safe != address(0)) return PoolStatus.Finalized;
    if (p.totalDeposited == p.targetAmount) {
        if (block.timestamp <= uint256(p.fundedAt) + EXECUTION_WINDOW) {
            return PoolStatus.Funded;
        }
        return PoolStatus.Funding; // window lapsed — withdrawable, but withdraw may revert
    }
    if (block.timestamp > p.fundingDeadline) return PoolStatus.Expired;
    return PoolStatus.Funding;
}

// L132-161: createPool() — zero validation of invitee ETH-receive capability
function createPool(...) external returns (uint256 poolId) {
    // ...
    for (uint256 i = 0; i < invitees.length; i++) {
        address invitee = invitees[i];
        if (invited[poolId][invitee]) revert DuplicateInvitee();
        invited[poolId][invitee] = true;
        // NO check: invitee.code.length, invitee can receive ETH
    }
    // ...
}
```

**Recommendation:**

**Scenario:**

A pool reaches `targetAmount` entirely through contributions from contracts whose `receive()` or `fallback()` functions revert. If no contributor finalizes during the execution window, the window expires and `status()` returns `Funding`; each contributor’s subsequent `withdraw()` call reverts at the ETH push transfer, rolling back its deposit removal and leaving the pool permanently at its target with no available deposit, finalization, or withdrawal path.

**Proof of Concept:**

---

#### Finding 4

**Title:** Composed re-arming→finalize attack: attacker manufactures Funded status from PoolFull state then front-runs pending withdraw with finalize, permanently locking victim ETH in Safe with attacker-controlled threshold blocking power for small pools

**Category:** concurrency

**Severity:** Medium

**Location:**

*Start Line:* 195

*End Line:* 197

**Description:**

*Summary*

While the funding deadline remains open, invited contributors can re-arm `fundedAt` by withdrawing through one account and restoring the target amount through another. The second account can then call `finalize()` before a victim's pending `withdraw()`, transitioning the pool into its terminal Safe-backed state. This can durably freeze the victim's escrow withdrawal in small-owner configurations where attacker-controlled Safe owners have sufficient veto power.

*Root Cause*

In `/opt/aiflow/output/source/src/EnsDiamondsEscrow.sol`, `withdraw()` clears the withdrawing account's `deposits[poolId][msg.sender]`, reduces `p.totalDeposited`, removes that account from `contributors[poolId]`, and resets `p.fundedAt` when the total falls below `p.targetAmount`. A different invited account can then call `deposit()` to refill the gap; once `p.totalDeposited == p.targetAmount`, `deposit()` sets `p.fundedAt` again, causing `status(poolId)` to return `PoolStatus.Funded` during `EXECUTION_WINDOW`.

Because `finalize()` only requires `PoolStatus.Funded` and a nonzero deposit for `msg.sender`, the refilling account can finalize the pool. `finalize()` snapshots `contributors[poolId]`, creates a Safe with `owners.length / 2 + 1` threshold, sets `p.safe`, and transfers the escrowed ETH to that Safe. The withdrawn account cannot serve as the finalizer because its deposit was cleared, but the second account can. The attack is limited to pools whose funding deadline is still open; a path premised on re-arming a pool after the relevant funding period has lapsed is not supported.

*Impact*

After `p.safe` is set, `status(poolId)` permanently returns `PoolStatus.Finalized`, while `withdraw()` accepts only `PoolStatus.Funding` or `PoolStatus.Expired`. A victim whose withdrawal is ordered after finalization cannot recover from escrow, and the escrow ETH has already been transferred to the Safe.

The loss is a durable freeze when the attacker retains enough Safe-owner voting power to veto recovery. In the confirmed small-owner configurations, the victim cannot satisfy the Safe threshold without attacker cooperation. The issue requires multiple invited attacker accounts and transaction ordering that places `withdraw()`, re-filling `deposit()`, and `finalize()` ahead of the victim withdrawal.

*Scenario*

- Before `p.fundingDeadline`, account `A` and a victim are contributors in a fully funded pool. Account `A` calls `withdraw()`, reducing `p.totalDeposited` below `p.targetAmount`, resetting `p.fundedAt`, and removing `A` from `contributors[poolId]`.
- Attacker account `B` deposits the exact gap, re-establishing `PoolStatus.Funded`, then calls `finalize()` before the victim withdrawal is processed. The victim's `withdraw()` reverts with `WithdrawLocked`; the ETH is held by the newly created Safe, where the attacker can block recovery if its retained owner set has sufficient threshold veto power.

```
// L110-121: status() — L117 returns Funding when at target but window lapsed
function status(uint256 poolId) public view returns (PoolStatus) {
    Pool storage p = pools[poolId];
    if (p.safe != address(0)) return PoolStatus.Finalized;
    if (p.totalDeposited == p.targetAmount) {
        if (block.timestamp <= uint256(p.fundedAt) + EXECUTION_WINDOW) {
            return PoolStatus.Funded;
        }
        return PoolStatus.Funding; // L117 — withdrawable, but deposits blocked (PoolFull)
    }
    if (block.timestamp > p.fundingDeadline) return PoolStatus.Expired;
    return PoolStatus.Funding;
}

// L163-207: deposit() — re-arming path from PoolFull state
// L175: remaining = targetAmount - totalDeposited; L181: if (remaining == 0) revert PoolFull();
// After attacker A's withdraw creates gap: remaining > 0 → PoolFull bypassed
// L195-197: totalDeposited == targetAmount → fundedAt re-armed → Funded status

// L209-231: withdraw() — fundedAt reset creates the gap
// L218: deposits[poolId][msg.sender] = 0; // MUST be a different account than finalize caller
// L219: p.totalDeposited -= amount; // drops below target
// L221: _removeContributor(poolId, msg.sender); // removes A from Safe owner set
// L222-224: if (p.totalDeposited < p.targetAmount && p.fundedAt != 0) p.fundedAt = 0;

// L233-281: finalize() — terminal front-run
// L235: if (status(poolId) != PoolStatus.Funded) revert WrongStatus();
// L236: if (deposits[poolId][msg.sender] == 0) revert NotContributor(); // A cannot call, only B
// L238: address[] memory owners = contributors[poolId]; // snapshot includes victim, excludes A
// L242: uint8 threshold = uint8(owners.length / 2 + 1);
// L273: p.safe = safe; // status() permanently returns Finalized at L112
// L279: (bool ok,) = safe.call{value: amount}(""); // all ETH to Safe, escrow balance → 0

// L212: withdraw gate — Finalized is permanently blocked
if (s != PoolStatus.Funding && s != PoolStatus.Expired) revert WithdrawLocked();

// L169: withdrawBlock guard — only blocks same-address same-block re-deposit
if (withdrawBlock[poolId][msg.sender] == block.number) revert SameBlock();
```

**Recommendation:**

Prevent a pool from transitioning back to `Funded` after it has fallen below the target amount, or otherwise make the funding state irreversible once `fundedAt` has been set. In particular, do not reset and reassign `fundedAt` based solely on the current aggregate deposit amount.

Additionally, ensure that contributors retain a withdrawal or recovery path after finalization. This can be achieved by restricting `finalize()` until the withdrawal period has conclusively closed, or by requiring explicit consent from all contributors before transferring escrowed funds to the Safe. Review the Safe owner set and threshold construction to ensure a minority of attacker-controlled contributors cannot prevent a legitimate contributor from recovering funds.

**Scenario:**

After a fully funded pool’s execution window has lapsed but its funding deadline remains open, attacker-controlled contributor A withdraws, reducing the total below the target and resetting `fundedAt`. Invited attacker-controlled contributor B then deposits the missing amount, which re-arms `fundedAt` and returns the pool to `Funded` status. B finalizes before a victim’s pending withdrawal executes, transferring all escrowed ETH to the Safe; the victim’s withdrawal is thereafter blocked because the pool is permanently `Finalized`, and recovery can be vetoed where the attacker-controlled Safe owners retain sufficient threshold power.

**Proof of Concept:**

---

#### Finding 5

**Title:** isExactGap bypass of BelowMinimum guard allows sub-MIN_CONTRIBUTION depositors to gain equal Safe governance power

**Category:** access-control

**Severity:** Medium

**Location:**

*Start Line:* 185

*End Line:* 191

**Description:**

*Summary*

`deposit()` in `src/EnsDiamondsEscrow.sol` exempts a new contributor from `MIN_CONTRIBUTION` when their deposit exactly equals `remaining`. A sub-minimum final deposit is still added to `contributors[poolId]` and therefore receives one Safe owner key, identical to owners that made full minimum deposits. In a constrained pool configuration, this discounted final owner can provide the decisive signature needed to meet the Safe threshold.

*Root Cause*

The condition `if (!isTopUp && !isExactGap && amount < MIN_CONTRIBUTION) revert BelowMinimum()` does not enforce `MIN_CONTRIBUTION` for new contributors when `amount == remaining`. The contributor is subsequently appended to `contributors[poolId]` and `finalize()` uses that array as the Safe owner set, while deriving the threshold solely from `owners.length`.

`MAX_OWNERS` bounds the number of owners, and invitation checks restrict participation to invited addresses; neither mechanism prevents an invited address making the exact-gap deposit from obtaining an equal Safe signing key.

*Impact*

An attacker controlling six normally invited addresses can make five regular minimum deposits and use a sixth, sub-minimum exact-gap deposit to reach a six-owner threshold. The sixth signature changes the attacker-controlled set from five signatures, which cannot satisfy a six-owner threshold, to six signatures, which can authorize Safe transactions and place honest pool funds at risk.

This is a constrained authorization and fund-loss path: it requires six attacker-controlled, invited addresses and carefully timed pool funding. Repeated exact-gap deposits, withdraw-and-redeposit cycling, and permissionless identity creation are not required to realize the supported impact.

*Scenario*

A pool is funded such that its remaining amount is below `0.01 ether`. Five attacker-controlled addresses that have received normal invitations deposit at least `MIN_CONTRIBUTION`. A sixth attacker-controlled invited address deposits exactly `remaining`, bypasses `BelowMinimum`, and is added as a sixth Safe owner. The resulting six attacker signatures satisfy the Safe threshold and can authorize a transaction affecting the pooled funds.

The supported scenario uses one decisive final exact-gap deposit. A repeated `withdraw` to `isExactGap` deposit cycle is not necessary to create the threshold-reaching owner set.

```
// L185-187: isExactGap bypass of BelowMinimum guard
bool isTopUp = deposits[poolId][msg.sender] > 0;
bool isExactGap = amount == remaining;
if (!isTopUp && !isExactGap && amount < MIN_CONTRIBUTION) revert BelowMinimum();
// When amount == remaining (isExactGap == true):
//   !isExactGap == false → entire guard evaluates false
//   → BelowMinimum is skipped for new contributors
//   → sub-MIN_CONTRIBUTION deposit is credited

// L189-190: new contributor pushed to contributors[]
if (!isTopUp) {
    contributors[poolId].push(msg.sender);
}

// L192-193: deposit credited with sub-minimum amount
deposits[poolId][msg.sender] += amount;
p.totalDeposited += amount;

// L32-33: constants
uint96 public constant MIN_CONTRIBUTION = 0.01 ether;  // intended barrier bypassed
uint256 public constant MAX_OWNERS = 10;                // bounds max dilution

// L233-242: finalize consumes contributors[] as Safe owners
// Each contributor gets 1 signing key regardless of deposit size
address[] memory owners = contributors[poolId];
uint8 threshold = uint8(owners.length / 2 + 1);
```

**Recommendation:**

Enforce `MIN_CONTRIBUTION` for every new contributor, including deposits that exactly fill the remaining pool capacity. Restrict the exact-gap exception to existing contributors performing a top-up, if such behavior is required.

Additionally, ensure that any address added to `contributors[poolId]` has satisfied the intended minimum economic contribution requirement before it can become a Safe owner. If smaller final deposits must be supported, avoid granting them an equivalent Safe owner key or derive governance rights and thresholds from contribution-weighted rules rather than contributor count alone.

**Scenario:**

A pool has less than `MIN_CONTRIBUTION` remaining after several invited contributors have made qualifying deposits. A newly invited address deposits exactly that remaining amount, causing `isExactGap` to bypass the minimum-deposit check. Because it is a new contributor, it is added to `contributors[poolId]` and receives the same Safe owner status as contributors that deposited at least `MIN_CONTRIBUTION`, potentially increasing the owner set enough to satisfy the finalized Safe threshold.

**Proof of Concept:**

Exact-gap deposit can supply the decisive discounted Safe-owner signature

Strongest supported impact: A set of explicitly invited attacker accounts can use the one permitted sub-minimum exact-gap seat to cross the Safe's majority threshold and execute arbitrary Safe transactions. This is a concrete corruption of the finalized pool's authorization boundary; any ETH or assets under the resulting Safe's control can then be transferred by the attacker quorum.

PoC feasibility: Feasible under a constrained but concrete configuration: the attacker must control six separately invited addresses and must arrange for five attacker seats plus four honest seats to exist before the final one-wei gap is filled. The issue is not permissionless, nor can it create multiple discounted seats, so Medium is the appropriate calibration.

PoC steps:
1. Create or use a pool with a 1 ETH target and capacity for 10 contributors. Ensure attacker addresses A1-A6 are each explicitly invited through the protocol's normal invitation flow; this invitation prerequisite is required and cannot be bypassed by this finding.
2. Have A1-A5 each call `deposit(poolId)` with exactly `MIN_CONTRIBUTION` (0.01 ETH), giving the attacker five ordinary contributor/Safe-owner seats and a combined 0.05 ETH deposit.
3. Have four honest invited contributors deposit a combined 0.949999999999999999 ETH. The pool then has nine contributors, `totalDeposited == 0.999999999999999999 ETH`, and `remaining == 1 wei`.
4. Have A6 call `deposit(poolId)` with `amount == 1 wei`. A6 is a new contributor, but `isExactGap` is true, so `!isTopUp && !isExactGap && amount < MIN_CONTRIBUTION` is false. A6 is appended to `contributors[poolId]` despite contributing far below `MIN_CONTRIBUTION`.
5. Call `finalize(poolId)`. It consumes the 10-address `contributors[poolId]` array as Safe owners and sets the threshold to `owners.length / 2 + 1`, i.e. 6. A1-A6 therefore satisfy the Safe threshold.
6. A1-A6 sign and submit the Safe transaction through the Safe's normal execution entrypoint (for example, `execTransaction`) to perform any action authorized to the finalized Safe, including transferring assets held by it. The concrete downstream privileged action is the Safe transaction execution that consumes the corrupted owner set and six-of-ten threshold.

---

#### Finding 6

**Title:** [Discussion] Insufficient withdrawBlock guard enables indefinite finalization griefing via fundedAt re-arm cycling

**Category:** design-issue

**Severity:** Discussion

**Location:**

*Start Line:* 113

*End Line:* 117

**Description:**

Root cause and observed behavior

The pool's EXECUTION_WINDOW can be re-armed when a withdrawal takes totalDeposited below targetAmount, clearing fundedAt, and a later deposit restores totalDeposited to exactly targetAmount. In deposit(uint256), withdrawBlock[poolId][msg.sender] == block.number is the only relevant guard, and it is limited to the depositing address and the withdrawing address's current block. When totalDeposited equals targetAmount, deposit() sets fundedAt to block.timestamp and emits PoolFunded.

Accordingly, the guard does not prevent two observed transition paths: (1) a contributor may withdraw in block N and refill the gap from the same address in block N+1, because the block-number predicate no longer matches; and (2) an attacker controlling two invited addresses may have address B withdraw and address A refill the exact gap in the same block, because withdrawBlock is recorded only for B. The latter path does not require the withdrawing address's capital to remain locked.

This behavior is reachable after a fully funded pool's execution window lapses. status(uint256) returns Funded while block.timestamp <= fundedAt + EXECUTION_WINDOW, including the exact boundary, but returns Funding once the window has elapsed even if totalDeposited still equals targetAmount. withdraw() is then permitted (subject to its Funding or Expired status requirement), decrements totalDeposited, records withdrawBlock for the withdrawing address, removes that contributor, and clears nonzero fundedAt when deposits fall below target. A refill of the exact missing amount then sets fundedAt again, returning the pool to Funded and creating another full execution window. The reset itself appears consistent with the invariant that a nonzero fundedAt belongs only to a fully funded pool.

The transition requires a pool that previously reached targetAmount, a contributor permitted to withdraw, and an invited address able to supply the exact gap. Same-block cycling additionally requires two attacker-controlled invited addresses; next-block cycling requires only one contributor/invited address that waits for the next block. A withdrawal before finalization can also reduce totalDeposited below targetAmount, such that a finalization attempt reverts with WrongStatus; this may occur in a preceding block or in an environment where transaction ordering is controllable. withdraw() may additionally revert with NoDeposit for a zero deposit or TransferFailed if its ETH transfer fails.

Discussion point and missing context

The stale/re-arm transition and the limitations of withdrawBlock are established. It remains unclear whether this transition creates an attacker-enforceable denial of service or durable loss of withdrawal availability. In each re-armed Funded window, finalization is permissionless, so any participant may finalize rather than wait for the renewed window to lapse. The available code therefore does not by itself establish fund theft, a forced finalization outcome, a durable withdrawal lock, or an indefinite ability to prevent finalization; a temporary additional execution window is contingent on eligible parties not exercising finalization.

Further assessment should confirm the complete finalization flow and its access control, prerequisites, transaction-ordering assumptions, and any off-chain or protocol constraints that could prevent an honest party from finalizing during a re-armed window. It should also establish whether a finalized pool can be unwound or otherwise fails to deliver the intended ENS purchase, and whether invitation policy permits a malicious participant to persist across replacement pools. If finalization is reliably permissionless and executable throughout every renewed window, the demonstrated behavior may be a design-level timing/griefing concern rather than a Medium-or-higher security vulnerability. If external conditions can make finalization unavailable while the attacker can continue cycling, the impact and remediation requirements should be reassessed.

Relevant locations: EnsDiamondsEscrow.sol deposit(uint256 poolId) around L163-L207, including the same-address same-block guard at L169 and fundedAt re-arm/PoolFunded emission at L195-L197; withdraw(uint256 poolId) around L209-L231, including the totalDeposited decrement, withdrawBlock write, contributor removal, and fundedAt reset at L219-L224; and status(uint256 poolId) around L110-L121, including the inclusive execution-window boundary and Funding status after the window lapses. Any remediation, if warranted by the missing finalization context, should address both next-block self-refills and same-block refills by distinct invited addresses.

```
// L163-L207: deposit() — withdrawBlock guard and fundedAt re-arm
function deposit(uint256 poolId) external payable nonReentrant {
    // ...
    // L169: The only re-arm guard — blocks same-address, same-block only
    if (withdrawBlock[poolId][msg.sender] == block.number) revert SameBlock();
    // ...
    // L195-197: fundedAt re-arm when total reaches target
    if (p.totalDeposited == p.targetAmount) {
        p.fundedAt = uint40(block.timestamp);
        emit PoolFunded(poolId);
    }
    // ...
}

// L209-L231: withdraw() — fundedAt reset and withdrawBlock write
function withdraw(uint256 poolId) external nonReentrant {
    // ...
    // L219-224: totalDeposited decremented, then fundedAt reset
    p.totalDeposited -= amount;
    withdrawBlock[poolId][msg.sender] = block.number; // guards re-arm (see deposit)
    _removeContributor(poolId, msg.sender);
    if (p.totalDeposited < p.targetAmount && p.fundedAt != 0) {
        p.fundedAt = 0;
    }
    // ...
}

// L110-121: status() — EXECUTION_WINDOW check
function status(uint256 poolId) public view returns (PoolStatus) {
    Pool storage p = pools[poolId];
    if (p.safe != address(0)) return PoolStatus.Finalized;
    if (p.totalDeposited == p.targetAmount) {
        // L114: inclusive <= — Funded at exact boundary second
        if (block.timestamp <= uint256(p.fundedAt) + EXECUTION_WINDOW) {
            return PoolStatus.Funded;
        }
        return PoolStatus.Funding; // window lapsed, withdrawable again
    }
    if (block.timestamp > p.fundingDeadline) return PoolStatus.Expired;
    return PoolStatus.Funding;
}
```

**Recommendation:**

**Scenario:**

After a pool has been fully funded and its execution window has elapsed, a contributor withdraws, reducing `totalDeposited` below `targetAmount` and clearing `fundedAt`. An invited address then deposits exactly the withdrawn amount—either from the same address in a later block or from a different invited address in the same block—causing `totalDeposited` to reach `targetAmount` again and resetting `fundedAt` to start a new execution window.

**Proof of Concept:**

---

#### Finding 7

**Title:** [Discussion] A contributor can repeatedly re-arm an expired funding lock

**Category:** denial-of-service

**Severity:** Info

**Location:**

*Start Line:* 113

*End Line:* 120

**Description:**

Funding-window re-arming allows repeated withdrawal locks and lifecycle resets (discussion required)

The supplied `status(uint256)` implementation establishes that a non-finalized pool with `totalDeposited == targetAmount` is `Funded` only while `block.timestamp <= uint256(fundedAt) + EXECUTION_WINDOW`. Once that execution window has elapsed, the same fully funded pool is instead reported as `Funding`; `Expired` is returned only when the pool is underfunded and `block.timestamp > fundingDeadline`. This behavior suggests that expiry of the funded execution window is not terminal at the status-layer level and that a lapsed fully funded pool may again become withdrawable and, potentially, depositable.

The reported re-arming sequence depends on the unverified behavior of the surrounding functions. The allegation is that `withdraw()` permits a contributor to withdraw in this lapsed `Funding` state, clears that contributor's deposit, reduces `totalDeposited`, records `withdrawBlock[poolId][msg.sender]`, and resets `fundedAt` to zero if the withdrawal makes the pool underfunded. It further depends on `deposit()` accepting a later replacement contribution while the pool is underfunded and, upon restoring `totalDeposited` to `targetAmount`, assigning a fresh `fundedAt` and emitting `PoolFunded`. If those behaviors are present, the pool can be returned to `Funded` with a new execution window after each lapsed window.

The stated `SameBlock` control, `withdrawBlock[poolId][msg.sender] == block.number`, would only prevent the same withdrawing address from redepositing in that block. It would not, by itself, prevent the same contributor from refilling in a later block, or a distinct invited contributor from filling the gap in the same block. A coordinating contract could make sequential calls after `withdraw()` returns; `nonReentrant` would not ordinarily prevent such independent sequential calls because its lock is released at the end of `withdraw()`. Likewise, a full-pool check based solely on `remaining == 0` would not prevent a replacement deposit after a withdrawal creates a gap. The proposed CREATE2 variant additionally depends on `createPool()` allowing arbitrary pre-invited addresses, including an undeployed CREATE2-predicted child address, and on the child being able to deposit after a factory withdraws in the same transaction.

Under the alleged implementation, the practical effect is a repeatable delay or griefing condition rather than a guaranteed permanent prevention of execution. Each successful refill creates a `Funded` interval during which any contributor with a nonzero deposit may be able to call `finalize()` unilaterally. The withdrawing attacker could not use a new withdrawal while that status remains `Funded`. Thus, any claim that finalization can be prevented indefinitely depends on honest contributors not finalizing during each renewed window. If `fundingDeadline` can be set far in the future and the full-pool branch takes precedence over the deadline branch, a rearm shortly before the deadline could also retain `Funded` status for up to another `EXECUTION_WINDOW` after that deadline. The attacker principal would be recycled through withdrawal and refill, leaving gas as the recurring direct cost; the cited cost estimates and economic viability remain contextual assertions that require environment-specific confirmation.

A definitive verdict cannot be reached from the supplied `status()` function alone. The repository and its lifecycle documentation could not be inspected during prior validation. The development team should provide or confirm the exact implementations of `deposit()`, `withdraw()`, `finalize()`, `createPool()`, and the reentrancy modifier, together with tests or documentation defining the intended post-window lifecycle. In particular, further investigation must establish: (1) whether `withdraw()` is allowed when a fully funded execution window has lapsed; (2) whether deposits are allowed after a withdrawal in that state and before or after `fundingDeadline`; (3) whether reaching target always refreshes `fundedAt`; (4) whether invitation and `withdrawBlock` checks match the alleged cross-address and CREATE2 paths; and (5) whether finalization can be front-run or otherwise interrupted during a newly re-armed `Funded` window. Confirmation of these points is necessary to determine whether this is a lifecycle flaw requiring a terminal-expiry or pool-wide anti-rearming invariant, or whether additional controls outside the supplied function preclude exploitation.

```
    function status(uint256 poolId) public view returns (PoolStatus) {
        Pool storage p = pools[poolId];
        if (p.safe != address(0)) return PoolStatus.Finalized;
        if (p.totalDeposited == p.targetAmount) {
            if (block.timestamp <= uint256(p.fundedAt) + EXECUTION_WINDOW) {
                return PoolStatus.Funded;
            }
            return PoolStatus.Funding; // execution lock lapsed → withdrawable again
        }
        if (block.timestamp > p.fundingDeadline) return PoolStatus.Expired;
        return PoolStatus.Funding;
    }
```

**Recommendation:**

**Scenario:**

A pool reaches its target amount and remains unfinalized until `block.timestamp` exceeds `fundedAt + EXECUTION_WINDOW`. At that point, `status()` returns `Funding` rather than a terminal expired state despite the pool still being fully funded, causing the lapsed pool to be treated as funding-phase again by any lifecycle logic that relies on this status.

**Proof of Concept:**

---
