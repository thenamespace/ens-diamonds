# ENS Diamonds

ENS Diamonds lets groups pool ETH to acquire an available `.eth` name and hold it in a Safe smart account controlled by the group.

The protocol uses a shared escrow contract for funding and ENS registration. Vault members are fixed when a vault is created, contributions remain withdrawable while funding, and a successful purchase registers the name directly to a deterministic Safe.

## Repository

- `apps/web` — Next.js interface
- `packages/contracts` — Solidity contracts, tests, and deployment script
- `packages/subgraph` — mainnet protocol event indexer

## Development

Requirements:

- Node.js 22.18 or newer
- pnpm 11.10.0
- Foundry

```bash
pnpm install
pnpm dev
```

Run all repository checks with:

```bash
pnpm check
```

## Deployments

| Network          | ENS Diamonds                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Ethereum mainnet | [`0xb1A022bD260e22e0A767fB7f6324D1C721AF44b9`](https://etherscan.io/address/0xb1A022bD260e22e0A767fB7f6324D1C721AF44b9)         |
| Sepolia          | [`0xc961d72795930ab03164aabc26887ab9c97e14c4`](https://sepolia.etherscan.io/address/0xc961d72795930ab03164aabc26887ab9c97e14c4) |

Mainnet protocol events are indexed by the [ENS Diamonds subgraph](https://api.studio.thegraph.com/query/1704219/ens-diamonds-v1-mainnet/v0.0.1).

## Documentation

- [Contract guide](packages/contracts/README.md)
- [Protocol architecture](packages/contracts/ARCHITECTURE.md)
- [Audit reports](audits)

## License

MIT
