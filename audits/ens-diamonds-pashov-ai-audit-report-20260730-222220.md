# 🔐 Security Review — ENSDiamonds Fix Verification

---

## Scope

|                                  |                                          |
| -------------------------------- | ---------------------------------------- |
| **Mode**                         | filename                                 |
| **Files reviewed**               | `packages/contracts/src/ENSDiamonds.sol` |
| **Confidence threshold (1-100)** | 80                                       |

---

## Findings

### [75] 1. Alternate commitment bypasses copied-purchase recovery

`ENSDiamonds.purchase` · Confidence: 75 · Verdict: Confirmed · Status: Accepted risk

#### How it was confirmed

1. ENS commitments hash the complete registration request, including its secret.
2. Another account can create a different commitment for the same label and register it first.
3. That registration can deliver the name to the predicted Safe or another owner without consuming the vault's commitment.
4. The vault commitment can therefore retain its stored timestamp and enter the normal purchase path.
5. The Controller rejects the vault's registration because the label is no longer available.
6. The complete transaction reverts, the vault remains `Committed`, and it later expires using the configured Controller maximum commitment age.

#### Impact

An external acquisition can delay contributor refunds until the vault expires. If the external buyer selects the predicted Safe, it pays for the Safe's name but ENS Diamonds does not recognize the result. If it selects another owner, it acquires the name independently. In neither case can it spend or claim the vault escrow. Contributors recover their full recorded balances after expiry.

#### Resolution

Accepted by design. V1 is limited to labels available through the configured Controller and recognizes acquisition only when its own direct registration succeeds and the Base Registrar confirms the predicted Safe as owner. It intentionally does not query current ownership before registration or reconcile Universal Resolver, NameWrapper, CCIP, or L2 state.

Regression test status: pending.

### [75] 2. Zero commitment age aliases consumed and recommitted generations

`ENSDiamonds.purchase` · Confidence: 75 · Verdict: Configuration-dependent · Status: Accepted Controller behavior

#### How it was confirmed

1. ENS Diamonds requires `maxCommitmentAge > minCommitmentAge` but permits a configured Controller whose minimum age is zero.
2. With such a Controller, a commitment could be created, consumed, and recommitted in one block.
3. All transactions in that block share the same timestamp, so the new generation can equal `vault.committedAt`.
4. `purchase` can enter the normal branch and then revert because the label is unavailable.
5. The vault remains `Committed` until the configured Controller maximum commitment age passes.

#### Impact

For a zero-minimum-age Controller, timestamp equality does not uniquely identify a commitment generation. The result is the same bounded liveness delay: no vault escrow is spent, and every contribution is refundable after expiry.

#### Resolution

Accepted as part of trusting the configured Controller. ENS Diamonds reads and caches that Controller's minimum and maximum ages at deployment and does not impose separate protocol bounds. Deployment must use the intended ENS Controller. The contract still rejects an internally inconsistent timing configuration where `maxCommitmentAge <= minCommitmentAge`.

Regression test status: pending.

---

Findings List

| #   | Confidence | Verdict                 | Status                       | Title                                                        |
| --- | ---------- | ----------------------- | ---------------------------- | ------------------------------------------------------------ |
| 1   | [75]       | Confirmed               | Accepted risk                | Alternate commitment bypasses copied-purchase recovery       |
| 2   | [75]       | Configuration-dependent | Accepted Controller behavior | Zero commitment age aliases consumed/recommitted generations |

---

## Verification Notes

- Copied-purchase recovery was removed rather than expanded into general ENS ownership discovery.
- `purchase` requires the stored commitment timestamp to match and otherwise reverts with `CommitmentChanged`.
- A matching timestamp proceeds through the normal Controller registration; an unavailable label causes the complete transaction to revert.
- External acquisition never changes vault accounting. After the Controller-defined maximum age, `expireAcquisition` or the first `claim` marks the vault `Failed`, and contributors claim their full balances.
- Normal successful registration still verifies that the Base Registrar reports the deterministic Safe as owner.
- No extra minimum-age or maximum-age bounds were added beyond the values supplied by the configured Controller.
- Automated regression coverage remains pending.

---

## Leads

_No additional vulnerability leads were identified during this fix-verification pass._

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
