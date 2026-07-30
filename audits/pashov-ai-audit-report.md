# 🔐 Security Review — ENSDiamonds

---

## Scope

|                                  |                                          |
| -------------------------------- | ---------------------------------------- |
| **Mode**                         | default (`packages/contracts/src`)       |
| **Files reviewed**               | `packages/contracts/src/ENSDiamonds.sol` |
| **Confidence threshold (1-100)** | 80                                       |

---

## Findings

[75] **1. A member can front-run acquisition and lock honest contributions until expiry**

`ENSDiamonds.beginAcquisition` · Confidence: 75 · [agents: 1]

**Description**
A funded member can front-run the creator by withdrawing enough ETH to make the vault underfunded; because acquisition requires only nonzero escrow, the vault becomes irreversibly committed, purchases revert above the reduced balance, and honest contributors cannot recover their ETH until commitment expiry.

---

[75] **2. A near-expiry third-party commitment can collapse the acquisition window**

`ENSDiamonds.beginAcquisition` · Confidence: 75 · [agents: 4]

**Description**
An outsider can pre-seed the public ENS commitment so that a creator beginning at `committedAt + MAX_COMMITMENT_AGE - 1` adopts a formally live timestamp but has no practical purchase block before the vault becomes eligible to fail and refund.

---

Findings List

| #   | Confidence | Title                                                                         |
| --- | ---------- | ----------------------------------------------------------------------------- |
| 1   | [75]       | A member can front-run acquisition and lock honest contributions until expiry |
| 2   | [75]       | A near-expiry third-party commitment can collapse the acquisition window      |

---

## Leads

_No additional actionable leads survived deduplication and validation._

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
