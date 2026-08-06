> IMPORTANT DISCLAIMER: This report is an AI-generated security scan and does not constitute a comprehensive security audit. This report has been generated in part by artificial intelligence ("AI") systems. The findings, analyses, and conclusions presented herein are derived from automated processes and may contain inaccuracies, omissions, errors, or misinterpretations. While reasonable efforts have been made to ensure the quality and accuracy of the information, no representation or warranty, express or implied, is made regarding the completeness, reliability, or accuracy of the results. CertiK's standard security audits are comprehensive manual reviews conducted by expert auditors; this AI-generated scan is a separate development tool designed to identify vulnerabilities before the audit. All findings should be treated as advisory in nature and should not be relied upon as a substitute for a comprehensive manual security review. This report is provided for informational purposes only and does not constitute financial, legal, regulatory, tax, or investment advice. The recipient is solely responsible for any decisions made based on the contents of this report and is solely responsible for verifying the accuracy and applicability of any findings before taking action based on this report.
>
> This report is intended for internal development use only and must not be used (i) to represent that the protocol has been "audited by CertiK" or other similar representation, or (ii) to make security claims to users, investors, the public or anyone else. Protocols handling real user funds or preparing for mainnet deployment should require a comprehensive manual security audit. Neither CertiK nor its affiliates, officers, or employees shall be liable for any loss, damage, or consequence arising directly or indirectly from the use of, or reliance on, the information contained in this AI-generated report. To the maximum extent permitted by law, CertiK disclaims all liability for any loss, damage, or costs arising from reliance on or use of this report.

## Export Metadata

- Scan Mode: Ultra

# Report for Project [ens-diamonds](https://github.com/thenamespace/ens-diamonds)

Report Date: 2026-08-06 14:57:57

Task ID: `6403612c-95f2-5d69-960d-1fb90b396586`

## Commit:

### File: [packages/contracts/src/ENSDiamonds.sol](<>)

#### Finding 1

**Title:** Stale Commitment Age Parameters Can Temporarily Lock Committed Vault Funds

**Category:** design-issue

**Severity:** Minor

**Location:**

_Start Line:_ 51

_End Line:_ 52

**Description:**

`ENSDiamonds` caches `MIN_COMMITMENT_AGE` and `MAX_COMMITMENT_AGE` as immutables during construction from the Controller. `beginAcquisition`, `purchase`/`_purchaseCommitted`, `expireAcquisition`, and `claim` use these cached values rather than the live values enforced by the canonical ENS `ETHRegistrarController`.

If the Controller owner lowers `maxCommitmentAge` after a vault commits at `committedAt = T0`, `_purchaseCommitted` continues to consider the commitment valid until `T0 + cached MAX_COMMITMENT_AGE`, while `CONTROLLER.register` rejects it after `T0 + live maxCommitmentAge`. During `[T0 + live maxCommitmentAge, T0 + cached MAX_COMMITMENT_AGE)`, purchase reverts at the Controller, but `expireAcquisition` and claim-after-expiry remain unavailable because they also use the cached maximum age. No action can acquire the name or release the escrow until the cached expiry is reached, when `expireAcquisition` and the first claim-after-expiry path permit full refunds.

A higher live minimum age can temporarily cause purchase to revert as too young, while a higher live maximum age causes the protocol to expire and refund earlier than the Controller requires. The affected case requires a privileged external Controller configuration change and results in a bounded member-fund lock-up with an eventual full refund; it does not enable theft.

```
// constructor (L93-103): MIN/MAX ages cached once, never refreshed
uint256 minimumAge = controller_.minCommitmentAge();
uint256 maximumAge = controller_.maxCommitmentAge();
...
MIN_COMMITMENT_AGE = minimumAge;
MAX_COMMITMENT_AGE = maximumAge;

// beginAcquisition (L220-258): adopted/create/replace window uses cached MAX
...
} else {
    uint256 expiresAt = timestamp + MAX_COMMITMENT_AGE;
    // At equality ENS permits neither registration nor recommitment.
    if (currentTime == expiresAt) revert CommitmentAtBoundary();
    if (currentTime > expiresAt) {
        CONTROLLER.commit(commitment);
        timestamp = currentTime;
    }
}
vault.committedAt = timestamp.toUint40();

// _purchaseCommitted (L387-400): protocol window from cached MIN/MAX, then LIVE register
uint256 committedAt = vault.committedAt;
uint256 validAt = committedAt + MIN_COMMITMENT_AGE;
uint256 expiresAt = committedAt + MAX_COMMITMENT_AGE;
if (block.timestamp < validAt) revert CommitmentTooYoung(validAt);
if (block.timestamp >= expiresAt) revert CommitmentExpired(expiresAt);
...
CONTROLLER.register{value: price}(registration);

// expireAcquisition (L315-317): expiry gated by cached MAX
uint256 expiresAt = uint256(vault.committedAt) + MAX_COMMITMENT_AGE;
if (block.timestamp < expiresAt) revert CommitmentNotExpired(expiresAt);

// claim (L330-334): same cached-MAX gate before Committed -> Failed finalization
uint256 expiresAt = uint256(vault.committedAt) + MAX_COMMITMENT_AGE;
if (block.timestamp < expiresAt) revert InvalidState(State.Committed);
```

**Recommendation:**

Replace the constructor-cached commitment-age parameters with values synchronized with the canonical `ETHRegistrarController` configuration. Before evaluating commitment validity, purchase eligibility, expiry, or claim-after-expiry conditions, use the Controller’s current `minCommitmentAge` and `maxCommitmentAge` values so that vault state transitions remain aligned with `CONTROLLER.register`.

If live reads are undesirable, implement a restricted synchronization mechanism that updates the stored values whenever the Controller configuration changes, and ensure no commitment can remain blocked between the vault’s local expiry window and the Controller’s enforced expiry window.

**Scenario:**

A vault committed at `T0` when the cached maximum commitment age was longer than the Controller’s later-updated `maxCommitmentAge`. After the live maximum age passes but before `T0 + MAX_COMMITMENT_AGE`, a purchase reaches `CONTROLLER.register` and reverts because the Controller treats the commitment as expired, while `expireAcquisition` and `claim` still revert because the vault’s cached expiry has not yet elapsed. The committed funds remain locked until the cached maximum-age deadline, after which the acquisition can expire and be refunded.

**Proof of Concept:**

---

#### Finding 2

**Title:** Cached ENS Controller Parameters Can Invalidate Committed Vault Acquisitions

**Category:** design-issue

**Severity:** Info

**Location:**

_Start Line:_ 93

_End Line:_ 103

**Description:**

`ENSDiamonds` snapshots `controller_.minCommitmentAge()`, `controller_.maxCommitmentAge()`, and `controller_.MIN_REGISTRATION_DURATION()` in its constructor as immutable `MIN_COMMITMENT_AGE`, `MAX_COMMITMENT_AGE`, and `MIN_REGISTRATION_DURATION`. Its commitment windows and vault-duration validation use these cached values, while `CONTROLLER.register` enforces the Controller's live configuration.

If the Controller's commitment ages change after deployment, `_purchaseCommitted` may accept a purchase based on the cached window although `CONTROLLER.register` rejects it because the commitment is already too old. Member escrow remains locked until the cached expiry; if the live maximum age is reduced to or below the cached minimum age, no valid purchase window exists. Conversely, if the live maximum age is increased, `expireAcquisition` or `claim` can force an acquisition to fail at the cached expiry even though the Controller would still accept registration. Similarly, if the live minimum registration duration exceeds the cached `MIN_REGISTRATION_DURATION`, a vault may pass `createVault` but every purchase can revert during registration.

A privileged Controller configuration change can therefore invalidate in-flight committed vaults. Depending on the direction of the divergence, acquisitions can be prematurely failed or member funds can remain locked until expiry, despite the affected callers not controlling the configuration change.

```
constructor(...) {
    ...
    uint256 minimumAge = controller_.minCommitmentAge();
    uint256 maximumAge = controller_.maxCommitmentAge();
    uint256 minimumDuration = controller_.MIN_REGISTRATION_DURATION();
    if (maximumAge <= minimumAge || minimumDuration > type(uint32).max) revert InvalidConfiguration();
    MIN_COMMITMENT_AGE = minimumAge;
    MAX_COMMITMENT_AGE = maximumAge;
    MIN_REGISTRATION_DURATION = minimumDuration;
    ...
}

function _purchaseCommitted(...) internal {
    uint256 committedAt = vault.committedAt;
    uint256 validAt = committedAt + MIN_COMMITMENT_AGE;
    uint256 expiresAt = committedAt + MAX_COMMITMENT_AGE;
    if (block.timestamp < validAt) revert CommitmentTooYoung(validAt);
    if (block.timestamp >= expiresAt) revert CommitmentExpired(expiresAt);
    IPriceOracle.Price memory quote = CONTROLLER.rentPrice(registration.label, registration.duration);
    ...
    CONTROLLER.register{value: price}(registration);
    ...
}

function expireAcquisition(bytes32 vaultId) external override nonReentrant {
    ...
    uint256 expiresAt = uint256(vault.committedAt) + MAX_COMMITMENT_AGE;
    if (block.timestamp < expiresAt) revert CommitmentNotExpired(expiresAt);
    vault.state = State.Failed;
    ...
}

function claim(bytes32 vaultId, address payable recipient) external override nonReentrant {
    ...
    if (vault.state == State.Committed) {
        uint256 expiresAt = uint256(vault.committedAt) + MAX_COMMITMENT_AGE;
        if (block.timestamp < expiresAt) revert InvalidState(State.Committed);
        vault.state = State.Failed;
        ...
    }
}

function createVault(...) external payable override returns (bytes32 vaultId) {
    if (vaultSalt == bytes32(0) || maxSpend == 0
        || registrationDuration < MIN_REGISTRATION_DURATION || targetIntent == bytes32(0)
        || ensCommitment == bytes32(0)) revert InvalidConfiguration();
    ...
}
```

**Recommendation:**

Avoid caching mutable Controller configuration in `ENSDiamonds`. Query `minCommitmentAge()`, `maxCommitmentAge()`, and `MIN_REGISTRATION_DURATION()` from `CONTROLLER` at the points where commitment validity, acquisition expiry, and registration duration are evaluated, so local validation remains aligned with `CONTROLLER.register`.

If dynamic lookups are not feasible, introduce a controlled synchronization mechanism that updates the cached parameters whenever the Controller configuration changes and prevents new vaults or acquisitions from using stale values during the transition. This approach requires careful access control and may still require explicit handling for commitments created under previous parameters.

**Scenario:**

A vault commits an ENS registration when the Controller’s commitment window permits it, but the Controller later reduces `maxCommitmentAge` below the immutable `MAX_COMMITMENT_AGE` stored by `ENSDiamonds`. During the interval still considered valid by `_purchaseCommitted`, a member attempts the purchase and passes the cached-age checks, but `CONTROLLER.register` rejects the now-expired commitment; the escrowed funds remain unavailable until the vault reaches its cached expiry.

**Proof of Concept:**

---
