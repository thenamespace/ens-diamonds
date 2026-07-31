export const termsContent = `
> These Terms govern the ENS Diamonds website and interface. Smart-contract transactions are governed by the code deployed at the contract address shown by the Interface. Review every transaction in your wallet before signing.

## 1. Agreement

These Terms of Service ("Terms") govern your access to and use of the ENS Diamonds website, applications, and related offchain services (the "Interface"). "Operator," "we," and "us" mean the person or entity operating the Interface.

By using the Interface, connecting a wallet, signing in, or submitting a transaction, you agree to these Terms and the [Risks](/risks). If you do not agree, do not use the Interface.

## 2. What ENS Diamonds provides

The Interface helps users discover expiring second-level \`.eth\` names and interact with public smart contracts on Ethereum. The ENS Diamonds contract coordinates groups that pool ETH in a vault for one attempt to register one ENS name directly to a deterministic Safe smart account.

The Interface is not the ENS Diamonds contract, ENS, Safe, Ethereum, a wallet, an exchange, or a custodian. You may interact with public contracts without this Interface.

The deployed ENS Diamonds contract is designed as an **immutable singleton** with no administrator, upgrade function, pause switch, protocol fee, arbitrary execution function, or discretionary operator withdrawal. These properties apply only to the reviewed deployment and its configured dependencies. Verify the chain and contract address before transacting.

## 3. Eligibility and lawful use

You may use the Interface only if you can legally enter into these Terms and your use is permitted where you live. You are responsible for complying with laws that apply to you, including sanctions, anti-money-laundering, tax, consumer-protection, and digital-asset rules.

You must not use the Interface to violate law, infringe rights, deceive other vault members, interfere with the Interface or contracts, distribute malware, evade access controls, or attempt unauthorized access to another user's secrets or session.

## 4. Wallets, signatures, and transactions

You control your wallet, private keys, and signing devices. We do not receive your private key or seed phrase. A Sign-In with Ethereum signature authenticates your wallet to the Interface; it is separate from a transaction that moves ETH or changes blockchain state.

Blockchain transactions are irreversible once confirmed. Wallet prompts may contain addresses, calldata, values, chain identifiers, and permissions. You are responsible for checking them, using the intended account and network, and protecting your credentials from loss, compromise, phishing, or malware.

## 5. Vault configuration

A vault fixes one creator, between two and ten Safe owners, a strict-majority Safe threshold, a maximum spend, a registration duration, one hidden target intent, one ENS commitment, one deterministic vault ID, and one deterministic Safe address.

The creator must be the first owner. The Safe threshold is \`floor(ownerCount / 2) + 1\`; a two-owner vault therefore creates a 2-of-2 Safe. Owner membership cannot change inside the vault lifecycle. Safe owners may change the Safe configuration later only through valid Safe transactions after deployment.

Every participant must independently verify the members, threshold, target, maximum spend, registration duration, chain, contract address, and predicted Safe before depositing.

## 6. Funding and cancellation

Only fixed vault members may deposit. The maximum spend is a cap, not a funding target. The creator may begin acquisition with any positive escrow, even if the vault has not reached the cap.

While a vault is in **Funding**, each contributor may withdraw part or all of their own recorded contribution, and the creator may cancel the vault. A contributor cannot withdraw another member's balance.

When the creator calls \`beginAcquisition\`, the vault enters **Committed**. Deposits, funding withdrawals, and cancellation then stop. Remaining ETH stays locked by the contract until acquisition succeeds or the commitment window expires.

## 7. Acquisition and ENS pricing

The creator alone starts acquisition, but any address may call the permissionless purchase and expiry functions. Purchase is possible only during the ENS Controller's accepted commitment-age window.

At purchase, the contract obtains the current ENS base and temporary premium price. If the total price exceeds escrow, the transaction reverts and the vault remains committed. ENS prices, ETH/USD conversion, gas prices, and transaction inclusion can change between display, signing, and execution.

On success, the contract deploys the deterministic Safe if needed, registers the name directly to that Safe, and verifies the Safe as Base Registrar owner. ENS Diamonds is not intended to own the name.

## 8. Completion, failure, and refunds

After successful acquisition, the ENS price is paid from escrow. Unused ETH is allocated among contributors in proportion to their recorded contributions, with integer-rounding remainder assigned as specified by the contract.

If a vault is cancelled or its commitment expires without successful finalization, each contributor's remaining recorded balance becomes claimable. Claims are individual; funds are not automatically pushed to members. A member must submit a claim transaction and choose a recipient that can receive ETH.

A vault represents **one acquisition attempt**. Acquired, Cancelled, and Failed states are terminal. Retrying an available name requires a new vault, salt, commitment, and predicted Safe.

## 9. Target information and secrets

The normalized label, target salt, and ENS secret must remain confidential until purchase. Participants are responsible for generating independent, unpredictable values and sharing them only through channels they trust.

The Interface may offer encrypted coordination storage, but encryption does not eliminate risks from compromised devices, accounts, servers, keys, participants, backups, or implementation defects. A leaked or weak secret may reveal the intended label, enable interference, or cause the acquisition to fail.

## 10. Safe ownership and group decisions

After acquisition, the Safe owners—not the Operator or ENS Diamonds contract—control the name according to the Safe's threshold and configuration. Owners are responsible for renewals, records, wrapping, transfers, sales, recovery arrangements, disputes, expenses, and any later Safe configuration changes.

ENS Diamonds does not resolve disagreements among members and owes no fiduciary duty to a vault, member, creator, executor, or Safe owner.

## 11. Third-party systems

The Interface and protocol depend on systems we do not control, including Ethereum, wallets, RPC providers, ENS contracts and data services, Safe contracts, price feeds, hosting, databases, and wallet-connection infrastructure. Their availability, correctness, terms, fees, and security may change.

References or links to third-party services are provided for convenience and are not warranties or endorsements.

## 12. Fees, taxes, and no financial advice

The reviewed ENS Diamonds contract does not charge a protocol fee. You remain responsible for ENS registration charges, temporary premiums, Ethereum gas, wallet or service fees, renewal costs, and taxes.

Nothing in the Interface is legal, tax, financial, investment, or security advice. ENS names and ETH can lose value, and participation may result in complete economic loss.

## 13. Availability and changes

The Interface may be changed, restricted, suspended, or discontinued. Displayed names, status, prices, dates, Safe addresses, balances, and transaction simulations may be delayed, incomplete, or wrong. Authoritative state is the state accepted by the relevant blockchain contracts.

Changes to the Interface cannot modify an immutable deployed contract. A new contract deployment is a separate system with its own address and configuration.

## 14. Disclaimers

To the maximum extent permitted by law, the Interface and related content are provided **"as is" and "as available."** We disclaim warranties of title, merchantability, fitness for a particular purpose, non-infringement, accuracy, availability, security, and uninterrupted or error-free operation.

No audit, test suite, simulation, documentation, or security review guarantees that contracts or the Interface are free from defects or attacks.

## 15. Limitation of liability

To the maximum extent permitted by law, the Operator and its contributors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages; loss of ETH, names, keys, data, profits, opportunity, or goodwill; failed, delayed, reordered, or reverted transactions; third-party conduct; or smart-contract, wallet, network, oracle, Safe, ENS, hosting, or database failures.

Where liability cannot be excluded, it is limited to the greater of the amount you paid directly to the Operator for the Interface during the preceding twelve months or USD 100. Some jurisdictions do not allow certain limitations, so they may not apply to you.

## 16. Indemnity

To the extent permitted by law, you will defend and indemnify the Operator and its contributors against claims, losses, and reasonable costs arising from your unlawful use, breach of these Terms, infringement of another person's rights, or disputes with your vault members or Safe owners.

## 17. Changes and general terms

We may update these Terms by posting a revised version and date. Continued use after an update means you accept the revised Terms where permitted by law.

If a provision is unenforceable, the remaining provisions remain effective. A failure to enforce a provision is not a waiver. You may not assign these Terms without consent; the Operator may assign them in connection with a reorganization or transfer of the Interface. These Terms, the Privacy Notice, and the Risks page form the complete agreement concerning the Interface, subject to rights that cannot legally be waived.
`;
