# 🔐 Security Review — ENSDiamonds

---

## Scope

|                                  |                                          |
| -------------------------------- | ---------------------------------------- |
| **Mode**                         | filename                                 |
| **Files reviewed**               | `packages/contracts/src/ENSDiamonds.sol` |
| **Confidence threshold (1-100)** | 80                                       |

---

## Findings

### [75] 1. Recommitment hides a correctly copied purchase

`ENSDiamonds.purchase` · Original confidence: 75 · Verdict: Confirmed · Status: Accepted risk

#### How it was confirmed

1. An external account can consume the vault's exact commitment by registering the fixed request to the deterministic Safe.
2. The canonical ENS Controller deletes the consumed commitment.
3. Because `commit` is permissionless, the commitment hash can then be stored again with a different timestamp.
4. ENS Diamonds requires the Controller timestamp to equal the timestamp adopted by the vault.
5. A deleted or recommitted hash therefore causes `purchase` to revert with `CommitmentChanged`.
6. The vault remains `Committed` until the configured Controller maximum commitment age passes, then it becomes `Failed`.

#### Impact

This is a bounded liveness and state-synchronization risk. An external account can cause the vault to wait until expiry even if it paid to register the name to the deterministic Safe. It cannot redirect the fixed exact registration, spend the vault escrow, or claim contributor balances. After expiry, contributors recover their full recorded balances.

#### Resolution

Accepted by design. Copied-purchase recovery was removed because v1 does not discover or reconcile acquisitions performed outside its own `purchase` transaction. A nonmatching Controller timestamp never authorizes acquisition. The maximum lock duration comes from the immutable `maxCommitmentAge` read from the configured Controller at deployment; ENS Diamonds does not impose an additional local bound.

Regression test status: pending.

### [75] 2. Permissionless renewal invalidates copied-purchase recovery

`ENSDiamonds._recoverCopiedPurchase` · Original confidence: 75 · Verdict: Confirmed against superseded design · Status: Eliminated by design

#### How it was confirmed

1. The earlier recovery branch read the Base Registrar's mutable `nameExpires` value.
2. ENS renewal is permissionless and can increase that value.
3. An upper expiry bound could therefore reject an otherwise valid Safe-owned registration.
4. The current implementation has no copied-purchase recovery branch and does not read `nameExpires`.

#### Impact

The reported renewal-dependent denial of recovery no longer exists because there is no recovery path to invalidate. External acquisitions follow the accepted bounded expiry-and-refund behavior described in finding 1.

#### Resolution

The recovery function, registration-expiry checks, Base Registrar `nameExpires` interface method, and recovery event flag were removed. Normal acquisition now succeeds only through ENS Diamonds' direct Controller registration followed by a Base Registrar owner postcondition.

Regression test status: pending.

Findings List

| #   | Confidence | Verdict                             | Status               | Title                                                       |
| --- | ---------- | ----------------------------------- | -------------------- | ----------------------------------------------------------- |
| 1   | [75]       | Confirmed                           | Accepted risk        | Recommitment hides a correctly copied purchase              |
| 2   | [75]       | Confirmed against superseded design | Eliminated by design | Permissionless renewal invalidates copied-purchase recovery |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass. These are not false positives — they are high-signal leads for manual review. Not scored._

- **Public commitment can leave too little execution time** — `ENSDiamonds.beginAcquisition` — Code smells: publicly emitted ENS commitment and adoption of any unexpired timestamp without a minimum remaining lifetime — an outsider can pre-age the commitment, but reliably forcing the creator to begin close enough to expiry requires coincidental timing or transaction-delay capability; the resulting harm is bounded lock-and-refund rather than theft.
- **Reveal holder controls premium timing** — `ENSDiamonds.purchase` — Code smells: permissionless execution against a decaying ENS premium with no execution-price bound below funded `maxSpend` — a minimally exposed reveal holder could buy earlier at a higher premium borne mostly by other contributors, but no source-level path exposing the private reveal before intended execution was verified.

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
