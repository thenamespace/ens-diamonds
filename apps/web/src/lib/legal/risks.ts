export const risksContent = `
> **Read this page before depositing.** ENS Diamonds coordinates irreversible blockchain transactions and time-limited ENS acquisition attempts. You can lose gas, access to a name, or the economic value of deposited ETH.

| Risk | Possible result | Practical precaution |
| --- | --- | --- |
| Commitment or transaction delay | Funds remain locked until expiry | Start early and monitor the vault |
| ENS price rises above escrow | Purchase reverts | Leave sufficient price tolerance below max spend |
| Secret or target leaks | Interference or failed acquisition | Generate independent random secrets and share carefully |
| Safe owner disagreement or lost keys | The acquired name cannot be managed | Choose owners and recovery practices before funding |
| Contract or dependency defect | Partial or total loss | Verify deployments and limit exposure |

## 1. Protocol and smart-contract risk

Smart contracts can contain defects, unexpected interactions, compiler issues, or economic vulnerabilities. Testing, formal reasoning, documentation, and audits reduce risk but do not eliminate it.

ENS Diamonds uses one shared immutable singleton. A defect can affect every vault in that deployment. There is no administrator, upgrade path, pause switch, arbitrary rescue, or fee-withdrawal authority. Those limits reduce privileged control but also mean a faulty deployment cannot be repaired in place.

Verify the chain, ENS Diamonds address, ENS Controller, Base Registrar, Safe singleton, Safe Proxy Factory, and fallback handler configured for the deployment. Constructor checks confirm that dependencies contain code, not that they are canonical or safe.

## 2. Escrow and lock risk

During **Funding**, each member may withdraw only their own contribution and the creator may cancel. Once the creator begins acquisition, deposits, withdrawals, and cancellation stop.

Committed ETH stays locked until a purchase succeeds or the ENS Controller's maximum commitment age passes. Network congestion, failed transactions, unavailable executors, or frontend outages do not create an early-withdrawal path.

The maximum spend is a cap, not a required funding target. The creator can begin acquisition with any positive escrow. If that amount is inadequate, purchase reverts while the vault remains committed.

## 3. One-attempt lifecycle

Each vault has one target, commitment generation, deterministic Safe, and terminal outcome. A Failed vault cannot return to Funding or restart acquisition.

Commitment expiry does not prove that somebody else bought the name. The name may still be available, but retrying requires a new vault, salt, commitment, and Safe address. Participants pay new gas and must coordinate again.

## 4. ENS price, premium, and gas risk

ENS registration prices are quoted at execution and paid in ETH. Temporary premiums decay continuously, while ETH/USD conversion and gas prices change independently.

A displayed quote can differ from the execution quote. If price exceeds escrow, purchase reverts. Reverted creation, funding, commitment, purchase, expiry, and claim transactions still consume gas.

ENS pricing rules, commitment ages, minimum duration, or contracts may change for future deployments. ENS Diamonds caches certain timing rules when deployed, so a deployment continues using those immutable values even if an external getter later changes.

## 5. Timing and execution risk

ENS uses a minimum and maximum commitment age. Purchase before the minimum age or at or after maximum age reverts. At the exact maximum-age boundary, ENS may permit neither registration nor recommitment for that block.

Block timestamps, transaction ordering, mempool conditions, gas selection, RPC latency, and chain reorganizations affect execution. Anyone may call purchase or expiry, but there is no guarantee that an executor will act in time.

## 6. Target and secret risk

The contract stores a salted target intent and an ENS commitment. It does not store the plaintext label, target salt, or ENS secret before reveal.

Weak randomness, reused values, compromised devices, insecure backups, malicious members, server compromise, or careless sharing can reveal the target or enable interference. The target salt and ENS secret should be random, independent from one another, and independent from the label, vault salt, vault ID, and public timestamps.

Encrypted offchain storage is only one control. Anyone who obtains the decryption material or plaintext may disclose it. Do not treat group membership as proof that every member will preserve confidentiality.

## 7. External acquisition and commitment risk

Another account may submit the same public commitment hash, consume it, recommit it, or acquire the label through a different commitment. ENS Diamonds accepts purchase only while the Controller stores the exact timestamp adopted by the vault.

If the commitment timestamp changes or the name becomes unavailable, purchase reverts. The vault does not automatically recognize that the predicted Safe or another address obtained the name elsewhere. Contributors generally wait for the original commitment window to expire before claiming full recorded balances.

This bounded delay is intentional and does not give an external buyer access to vault escrow.

## 8. Safe ownership and governance risk

Successful registration sends the name directly to a deterministic Safe. The initial owner list is fixed by the vault, and the threshold is a strict majority: \`floor(ownerCount / 2) + 1\`. Two owners therefore require both signatures.

Lost or compromised keys, owner death or incapacity, sanctions, disputes, unavailable signers, malicious majorities, or incompatible smart-contract owners can prevent or enable Safe actions. ENS Diamonds does not provide key recovery or dispute resolution.

After deployment, valid Safe transactions can change owners, threshold, modules, guards, fallback behavior, or transfer the name. Those later actions are controlled by the Safe and are outside ENS Diamonds escrow logic.

## 9. ENS ownership and naming risk

The protocol validates a successful purchase against the ENS Base Registrar and the predicted Safe. It intentionally does not interpret NameWrapper ownership, Universal Resolver responses, CCIP-read results, or L2 representations when deciding whether its acquisition succeeded.

Clients must normalize labels according to ENS rules before building commitments. The contract does not independently enforce ENSIP-15 normalization. A visually deceptive, malformed, or differently normalized label can differ from what participants believe they selected.

ENS names expire unless renewed. After acquisition, Safe owners are solely responsible for renewal, records, wrapping, transfers, and compliance with ENS rules.

## 10. Interface and data risk

The Interface relies on RPC nodes, ENS subgraphs, price feeds, wallet libraries, Reown, hosting, databases, media hosts, and other services. Data can be stale, unavailable, censored, incorrectly indexed, or inconsistent with current chain state.

Premium charts are estimates derived from contract formulas and current oracle data. Cards and alerts are not execution guarantees. Confirm authoritative values through contract reads and wallet simulation before signing.

The Interface may be unavailable while contracts remain accessible. Users should know how to inspect a vault and submit claims through an alternative interface or block explorer.

## 11. Wallet and transaction risk

Blockchain transactions are public and generally irreversible. A compromised wallet, malicious extension, phishing site, blind signature, wrong network, wrong recipient, or incorrect calldata can cause permanent loss.

A Sign-In with Ethereum message should match the expected domain, address, chain, nonce, and statement. Authentication signatures do not move funds, but signing an unexpected message can still create security or privacy risk.

## 12. Refund and transfer risk

Refunds are pull-based. Every contributor must claim separately after Acquired, Cancelled, or Failed status. No operator automatically sends funds.

A claim can be directed to a nonzero recipient, but it reverts if that recipient rejects ETH. A zero balance, already claimed balance, wrong vault, or non-terminal state also prevents a claim.

Integer division is used to allocate acquisition surplus. The contract assigns rounding remainder to the last positive contributor in owner order so recorded refunds sum to remaining escrow.

## 13. Direct and forced ETH risk

Normal direct ETH transfers to ENS Diamonds revert. ETH forcibly sent to the contract is not recorded as a vault contribution or liability and has no rescue path. Do not send ETH except through the intended payable vault functions.

## 14. Economic, legal, and tax risk

ETH and ENS names can be volatile, illiquid, or worthless. Group members may disagree about valuation, use, sale, renewal, or proceeds. The protocol does not create a partnership, managed investment, fiduciary relationship, or guaranteed return.

Digital-asset, sanctions, tax, consumer, property, and naming laws vary and may change. You are responsible for determining the rules and reporting obligations that apply to you.

## 15. No insurance or guarantee

Deposits, gas, names, and Safe assets are not bank deposits and are not insured by ENS Diamonds. No participant, contributor, operator, auditor, or third party guarantees acquisition, refund timing, Safe access, uptime, profitability, or recovery from loss.

Only deposit an amount you can afford to have locked or lose, and participate only with people whose operational and security practices you understand.
`;
