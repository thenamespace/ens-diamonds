# Response to External Audit (onedollaraudit.com, 2026-07-17)

An external AI-driven security review of the deployed `EnsDiamondsEscrow`
(`0x0bb0C8C12dd86cBE478C416fa51071e51ee1a729`, mainnet) reported seven findings.
Each was independently verified against the source before acting. Summary of
our assessment and response:

## Finding 1 (Critical, confirmed): zero-amount deposit corruption

**Valid.** When a pool at target lapses its 24h execution window, `status()`
returns `Funding` again with a zero remaining gap. A deposit in that state was
capped to `amount = 0`, fully refunded, yet still pushed the sender into
`contributors[]` as a zero-stake member (the `isExactGap` check passed on
`0 == 0`), re-armed `fundedAt`, and, repeated across lapses, inserted the same
address multiple times. Safe `setup()` rejects duplicate owners, so `finalize()`
would revert permanently. No path to fund theft; impact is phantom Safe owners
and a bricked pool.

**Fix:** `deposit()` now reverts with `PoolFull()` whenever the remaining gap
is zero. One guard, no behavior change for any legitimate flow. Regression
tests: `test_deposit_revertsWhenFullAfterLockLapses`,
`test_deposit_worksAgainAfterLapsedPoolReopensGap`.

Because the contract is immutable, the fix required a redeploy. The original
escrow held **0 ETH** at redeploy time (all finalized pools had already moved
funds to their Safes), so no migration of funds was needed.

**Fixed deployments** (both verified Etherscan + Sourcify exact_match):

- Mainnet: `0x7A11F2071344ADA4D6e53D8D8F18E83C7b03e044`
- Sepolia: `0x37d1A0Fc5BD9735147cbEe7630C63690C6FDfD6d`

The retired v1 escrow (`0x0bb0…a729`) remains onchain; its two finalized
vaults' Safes and names are unaffected and independent of it.

## Finding 2 (Critical per report; we assess as design tradeoff)

Safe ownership is one-owner-one-vote by headcount, not capital-weighted. This
is intentional: pools are invite-only among people who know each other, all
deposits are public before finalization, and Safe itself is unweighted. The
cheapest attack variant (a dust deposit via the exact-gap path when the gap is
zero) is closed by the Finding 1 fix. The residual (a 1-wei exact-gap fill of a
tiny remaining gap) is accepted and documented: check `getContributors()`
before finalizing if you don't trust a co-invitee.

## Finding 3 (griefing, accepted)

An invited contributor can withdraw to reopen the gap and stall funding. They
must keep their own capital at risk in the pool to do so, and a same-block
withdraw-redeposit guard already exists. Invite people you trust; a stalled
pool always resolves to full refunds.

## Finding 4 (defense-in-depth, accepted)

The CREATE2 adoption branch is sound as-is: the salt binds
`keccak256(initializer)`, so any contract at the predicted address provably has
the exact owners/threshold/handler setup. Canonical-bytecode pinning would add
belt-and-suspenders only.

## Findings 5-7 (low, accepted)

Deployment-process and redeploy edge cases that do not apply to the live
singleton deployed with canonical Safe v1.4.1 addresses.
