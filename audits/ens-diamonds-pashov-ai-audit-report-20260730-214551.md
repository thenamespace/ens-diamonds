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

[75] **1. Recommitment hides a correctly copied purchase [agents: 1]**

`ENSDiamonds.purchase` · Confidence: 75

**Description**
After front-running the exact registration to the intended Safe, any account can recommit the deleted ENS hash, causing `purchase` to observe a different nonzero timestamp and revert while contributor escrow remains locked until expiry.

---

[75] **2. Permissionless renewal invalidates copied-purchase recovery [agents: 3]**

`ENSDiamonds._recoverCopiedPurchase` · Confidence: 75

**Description**
After an exact copied registration, any account can renew the name until mutable `nameExpires` reaches the fixed upper bound, permanently rejecting recovery despite the intended Safe owning the live name and locking escrow until vault expiry.

---

Findings List

| #   | Confidence | Title                                                       |
| --- | ---------- | ----------------------------------------------------------- |
| 1   | [75]       | Recommitment hides a correctly copied purchase              |
| 2   | [75]       | Permissionless renewal invalidates copied-purchase recovery |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass. These are not false positives — they are high-signal leads for manual review. Not scored._

- **Public commitment can leave too little execution time** — `ENSDiamonds.beginAcquisition` — Code smells: publicly emitted ENS commitment and adoption of any unexpired timestamp without a minimum remaining lifetime — an outsider can pre-age the commitment, but reliably forcing the creator to begin close enough to expiry requires coincidental timing or transaction-delay capability; the resulting harm is bounded lock-and-refund rather than theft.
- **Reveal holder controls premium timing** — `ENSDiamonds.purchase` — Code smells: permissionless execution against a decaying ENS premium with no execution-price bound below funded `maxSpend` — a minimally exposed reveal holder could buy earlier at a higher premium borne mostly by other contributors, but no source-level path exposing the private reveal before intended execution was verified.

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
