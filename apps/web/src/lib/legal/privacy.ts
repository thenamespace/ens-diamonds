export const privacyContent = `
> This notice describes data handled by the ENS Diamonds Interface. Public blockchain data is outside the Operator's control and generally cannot be changed or deleted.

## 1. Scope

This Privacy Notice applies to the ENS Diamonds website, wallet authentication, and related offchain coordination services (the "Interface"). It does not govern Ethereum, ENS, Safe, wallets, RPC providers, subgraphs, or other third parties, which operate under their own notices.

For applicable data-protection law, the operator of the Interface is the controller of personal data it determines how and why to process. Contact the Operator through the Feedback link in the site footer.

## 2. Data we process

### Wallet and authentication data

When you connect or sign in, we may process your public wallet address, chain ID, Sign-In with Ethereum message, signature, nonce, issue time, session identifier, and essential CSRF or session-cookie data. A wallet signature proves control of an address for the signed message; it does not reveal your private key.

We may resolve public ENS information such as a primary name or avatar. Doing so can disclose the queried name or address to RPC, gateway, or media providers.

### Vault coordination data

Where vault coordination features are enabled, we may store the chain ID, ENS Diamonds contract address, vault ID, creator address, member addresses, and record timestamps needed to locate a user's vaults.

The service may store encrypted vault material as ciphertext together with an initialization vector, authentication tag, and key version. We do not intentionally store a target salt or ENS secret in plaintext. Encryption reduces exposure but is not a guarantee against compromise.

### Public blockchain and ENS data

We read public data including addresses, transactions, contract events and storage, vault balances and states, Safe configuration, ENS labels, expiry dates, availability, prices, and ownership. If you submit a transaction, Ethereum permanently associates its public details with the sending address.

### Device and request data

Our hosting and security providers may process IP address, user agent, request time, requested URL, referrer, approximate location derived from IP, performance data, and security logs. We do not currently describe optional advertising or cross-site tracking cookies as part of the Interface.

### Information you provide

If you send feedback or support requests, we process the content and contact details you choose to provide.

## 3. Why we use data

We use data to:

- authenticate a wallet and maintain an essential session;
- show vaults associated with an address;
- coordinate authorized access to encrypted vault information;
- query and display ENS names, prices, expiry, availability, and avatars;
- prepare, simulate, and display blockchain transactions;
- secure, debug, operate, and improve the Interface;
- prevent abuse and enforce our Terms; and
- meet legal obligations and respond to valid legal process.

Depending on applicable law, processing may rely on performing our agreement with you, your consent, compliance with law, or legitimate interests in operating and securing the Interface.

## 4. Cookies and local storage

The Interface uses essential session and security storage required for Sign-In with Ethereum, CSRF protection, wallet connection, and user-selected interface state. Disabling essential storage may prevent authentication or preferences from working.

We will update this notice and request consent where required before introducing non-essential analytics, advertising, or similar tracking technologies.

## 5. How data is disclosed

Data may be disclosed to:

- hosting, database, and security providers;
- wallet-connection infrastructure such as Reown;
- RPC and blockchain data providers;
- ENS, Safe, Ethereum, price-feed, and subgraph infrastructure;
- professional advisers and auditors under appropriate duties;
- authorities or counterparties where required to comply with law, protect rights, or address fraud and security; and
- a successor in a merger, financing, reorganization, or transfer of the Interface.

Public blockchain transactions and ENS records are disclosed to everyone by design. Other users may correlate addresses with ENS names, vault membership, transaction history, and information disclosed elsewhere.

We do not sell private keys or seed phrases, and the Interface is not designed to receive them.

## 6. Retention

We retain offchain records only for as long as reasonably needed for the purposes above, security, dispute resolution, backups, and legal obligations. Retention periods depend on the record and service provider.

Authentication sessions expire according to their configuration. Security logs and backups may persist for a limited period after primary deletion. Public blockchain and independently replicated subgraph data may remain available indefinitely and cannot be deleted by the Operator.

## 7. Security

We use technical and organizational safeguards appropriate to the service, including signed wallet authentication, access controls, encrypted transport, and encrypted storage for designated vault secrets. No system is completely secure.

You are responsible for wallet security, device security, reviewing the SIWE domain and nonce, protecting group secrets, and choosing trustworthy vault members. Never provide a seed phrase or private key to the Interface or another participant.

## 8. Your choices and rights

You can disconnect your wallet, sign out, clear local browser storage, and choose not to submit transactions or offchain information.

Depending on where you live, you may have rights to request access, correction, deletion, restriction, portability, or objection, and to withdraw consent or complain to a data-protection authority. These rights can be limited by law and cannot alter public blockchain records. Submit requests through the Feedback link and include enough information to verify the relevant address or record without sending a private key or seed phrase.

## 9. International processing

Providers may process data in countries other than yours. Where required, the Operator will use an approved transfer mechanism or another lawful basis for international transfers.

## 10. Children

The Interface is not directed to children or anyone unable to consent to these practices. Do not use it if you are below the minimum age required by the laws that apply to you.

## 11. Third-party links

Wallets, ENS avatar hosts, block explorers, Safe interfaces, and other linked services may collect data independently. Review their privacy notices before using them.

## 12. Changes

We may update this notice as the Interface, providers, or law changes. The updated date identifies the current version. Material changes may also be announced through the Interface where appropriate.
`;
