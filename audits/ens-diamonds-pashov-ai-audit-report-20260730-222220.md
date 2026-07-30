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

`ENSDiamonds.purchase` · Confidence: 75 · Verdict: Confirmed · Status: Open

#### How it was confirmed

1. ENS commitments hash the full registration request, including its secret.
2. An attacker who knows or guesses the intended label can create a second commitment, `C2`, using the same label, predicted Safe, and duration but a different secret.
3. Registering through `C2` delivers the name to the intended Safe and deletes only `C2`; the vault commitment, `C1`, remains unchanged.
4. `purchase` sees `commitments[C1] == vault.committedAt` and selects the normal registration branch.
5. ENS rejects the normal `C1` registration with `NameNotAvailable`, leaving the vault `Committed` until the original commitment expires.

#### Impact

The attacker pays for the ENS registration and cannot steal the name or escrow, but can lock all contributor escrow for the rest of the commitment window and force the vault to finish as `Failed` even though its deterministic Safe owns the intended live name.

#### Suggested fix

Before attempting normal registration, check whether the Base Registrar already reports the deterministic Safe as the current owner of a live name whose expiry satisfies the existing minimum-expiry requirement. If it does, route the vault through copied-purchase recovery regardless of whether `C1` changed.

The ownership probe must not revert for an unregistered name; an unavailable name that fails recovery validation should permit immediate failure and refunds rather than repeatedly attempting a registration that cannot succeed.

#### Regression test

Add a test that:

1. Creates and matures `C1` and alternate commitment `C2` for the same label, Safe, and duration using different secrets.
2. Registers the name through `C2`.
3. Verifies `C1` remains unchanged.
4. Calls `purchase` with the legitimate `C1` reveal.
5. Asserts the vault becomes `Acquired`, contributors retain their full escrow balances, and copied-purchase settlement succeeds.

### [75] 2. Zero commitment age aliases consumed and recommitted generations

`ENSDiamonds.purchase` · Confidence: 75 · Verdict: Confirmed · Status: Configuration-dependent

#### How it was confirmed

1. The constructor rejects `maximumAge <= minimumAge` but permits `minimumAge == 0`.
2. With a zero-age controller, an exact commitment can be created, consumed by registration, and recommitted in the same block.
3. All transactions in the block share the same timestamp, so the recommitted generation has the same numeric timestamp as `vault.committedAt`.
4. `purchase` treats timestamp equality as proof that the original commitment remains active and enters the normal registration branch.
5. ENS rejects the second registration with `NameNotAvailable`, locking escrow until the commitment deadline.

#### Impact

This reproduces the bounded liveness and state-synchronization failure when ENSDiamonds is deployed with a controller whose minimum commitment age is zero. The intended Safe owns the name, but the vault cannot recognize the acquisition or release contributor escrow before expiry.

#### Suggested fix

Either reject `minimumAge == 0` in the constructor or remove timestamp equality as the decisive recovery signal by recognizing verified live ownership by the predicted Safe before the normal registration attempt.

The ownership-based recovery change recommended for finding 1 also closes this timestamp-alias case.

#### Regression test

Add a zero-minimum-age controller test that consumes and recommits the exact commitment in one block, then verifies the vault recognizes the Safe-owned registration instead of entering the doomed normal branch.

---

Findings List

| #   | Confidence | Verdict   | Status                  | Title                                                        |
| --- | ---------- | --------- | ----------------------- | ------------------------------------------------------------ |
| 1   | [75]       | Confirmed | Open                    | Alternate commitment bypasses copied-purchase recovery       |
| 2   | [75]       | Confirmed | Configuration-dependent | Zero commitment age aliases consumed/recommitted generations |

---

## Verification Notes

- The original exact-commitment recommitment fix is correct: a consumed `C1` that is recommitted at a later canonical ENS timestamp now enters copied-purchase recovery.
- The original renewal fix is correct: removing the mutable maximum-expiry bound prevents permissionless renewal from invalidating recovery while retaining Safe ownership, liveness, and minimum-expiry checks.
- The broader copied-purchase recovery remains incomplete because registration through a distinct commitment can leave `C1` unchanged.
- `packages/contracts/ARCHITECTURE.md` documents a different commitment registering to a different owner, but does not cover a different commitment registering to the same predicted Safe.
- `forge build`, `forge lint`, and `forge test -q` pass.
- `forge test --list` reports no project tests, so both earlier fixes and the findings in this report currently lack automated regression coverage.

---

## Leads

_No additional vulnerability leads were identified during this fix-verification pass._

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
