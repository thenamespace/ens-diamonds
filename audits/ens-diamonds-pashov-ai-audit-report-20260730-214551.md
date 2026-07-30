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

`ENSDiamonds.purchase` · Original confidence: 75 · Verdict: Confirmed · Status: Fixed in source

#### How it was confirmed

1. An exact copied registration uses the vault's commitment and registers the name to the deterministic Safe.
2. The canonical ENS Controller deletes the consumed commitment during `register`.
3. `commit` is permissionless, so any account can immediately submit the same deleted hash and store a later nonzero timestamp.
4. The previous `purchase` implementation accepted only the original timestamp or zero. The later timestamp reached `CommitmentChanged`.
5. The vault remained `Committed` until its original maximum-age boundary even though the intended Safe owned the name.

#### Impact

This was a bounded liveness and state-synchronization issue. The attacker could delay finalization and refunds until the original commitment expired, but could not steal the name or escrow. The copied registration still delivered the name to the deterministic Safe, and contributors could recover their full balances after expiry.

#### Fix

`packages/contracts/src/ENSDiamonds.sol` now routes a zero Controller timestamp or a timestamp greater than `vault.committedAt` into copied-purchase recovery. Before the original vault window expires, canonical ENS cannot replace an active commitment unless the commitment was first consumed. Recovery still requires the deterministic Safe to own a live registration with a valid minimum expiry. A lower nonzero timestamp remains rejected with `CommitmentChanged` because canonical timestamps cannot move backwards.

Regression test status: pending.

### [75] 2. Permissionless renewal invalidates copied-purchase recovery

`ENSDiamonds._recoverCopiedPurchase` · Original confidence: 75 · Verdict: Confirmed · Status: Fixed in source

#### How it was confirmed

1. An exact copied registration consumes the commitment and registers the name to the deterministic Safe.
2. The canonical ENS Controller exposes permissionless `renew`; it does not require the caller to own the name.
3. Renewal increases the Base Registrar's mutable `nameExpires` value.
4. The previous recovery logic required `nameExpiry < committedAt + maxCommitmentAge + registrationDuration`.
5. Any account could pay for enough renewal time to cross that upper bound, causing recovery to revert despite the Safe owning a live valid registration.

#### Impact

This was also a bounded liveness and state-synchronization issue. The attacker paid for both the copied registration and renewal, the deterministic Safe retained the name, and contributors retained their escrow. The vault could not finalize as `Acquired` and contributors had to wait until the original commitment expired before claiming.

#### Fix

`packages/contracts/src/ENSDiamonds.sol` no longer applies a maximum `nameExpiry` bound during copied-purchase recovery. Recovery requires the name to be live and requires:

```text
nameExpiry >= committedAt + minCommitmentAge + registrationDuration
```

This lower bound remains valid after renewal because renewal only increases expiry. The original commitment deadline and deterministic Safe ownership checks remain unchanged.

Regression test status: pending.

Findings List

| #   | Confidence | Verdict   | Status          | Title                                                       |
| --- | ---------- | --------- | --------------- | ----------------------------------------------------------- |
| 1   | [75]       | Confirmed | Fixed in source | Recommitment hides a correctly copied purchase              |
| 2   | [75]       | Confirmed | Fixed in source | Permissionless renewal invalidates copied-purchase recovery |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass. These are not false positives — they are high-signal leads for manual review. Not scored._

- **Public commitment can leave too little execution time** — `ENSDiamonds.beginAcquisition` — Code smells: publicly emitted ENS commitment and adoption of any unexpired timestamp without a minimum remaining lifetime — an outsider can pre-age the commitment, but reliably forcing the creator to begin close enough to expiry requires coincidental timing or transaction-delay capability; the resulting harm is bounded lock-and-refund rather than theft.
- **Reveal holder controls premium timing** — `ENSDiamonds.purchase` — Code smells: permissionless execution against a decaying ENS premium with no execution-price bound below funded `maxSpend` — a minimally exposed reveal holder could buy earlier at a higher premium borne mostly by other contributors, but no source-level path exposing the private reveal before intended execution was verified.

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
