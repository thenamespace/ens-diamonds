# ens.diamonds 💎

**Pool ETH with friends to claim premium ENS names together.** Funds sit in an open-source escrow with unilateral refunds, and a Safe multisig you all control registers and owns the name.

- **Live app:** [ens.diamonds](https://www.ens.diamonds) (Ethereum mainnet)
- **Testnet app:** [coffer-web-delta.vercel.app](https://coffer-web-delta.vercel.app) (Sepolia)
- Built by the [Namespace](https://namespace.ninja) team, an ENS service provider.

## How it works

Recently expired ENS names go through a 21-day Dutch auction where the price starts near $100M and halves daily. The best names are usually too expensive to grab alone, so ens.diamonds makes it multiplayer:

1. **Start a vault** for one specific name and invite co-owners by ENS name or address.
2. **Everyone deposits** toward the target in the escrow contract. Deposits are withdrawable in full at any time before the funding target is met (and again if the 24-hour execution window lapses).
3. **Finalize** deploys a Safe multisig (owners = contributors, threshold = strict majority) and moves the pooled ETH into it.
4. **Register** through the app: ENS commit, wait, then collect majority owner signatures and execute from the Safe. The Safe owns the name; contributors co-own the Safe.

No one can run off with the money or the name, and no single person can act alone.

## Contracts

| Contract | Address |
|---|---|
| `EnsDiamondsEscrow` (mainnet) | [`0x7A11F2071344ADA4D6e53D8D8F18E83C7b03e044`](https://etherscan.io/address/0x7A11F2071344ADA4D6e53D8D8F18E83C7b03e044#code) (verified on Etherscan + Sourcify) |
| Retired v1 (mainnet, held 0 ETH) | [`0x0bb0C8C12dd86cBE478C416fa51071e51ee1a729`](https://etherscan.io/address/0x0bb0C8C12dd86cBE478C416fa51071e51ee1a729#code) (superseded, see `docs/security/2026-07-17-external-audit-response.md`) |
| `EnsDiamondsEscrow` (Sepolia) | [`0x37d1A0Fc5BD9735147cbEe7630C63690C6FDfD6d`](https://sepolia.etherscan.io/address/0x37d1A0Fc5BD9735147cbEe7630C63690C6FDfD6d#code) |

Contract source: [`packages/contracts/src/EnsDiamondsEscrow.sol`](packages/contracts/src/EnsDiamondsEscrow.sol) (Foundry; 41 tests + invariants).

## Repository layout

```
apps/web             Next.js 15 app (React 19, wagmi/viem, Namespace UIKit)
packages/contracts   Foundry project: escrow contract, tests, deploy scripts
docs/                Runbook, status/handoff notes, security audit, history
```

## Running locally

Prereqs: Node 20+, pnpm, Foundry (for contracts).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill in values (see docs/RUNBOOK.md)
cd apps/web && pnpm dev                        # http://localhost:3000
```

Checks:

```bash
cd apps/web && pnpm exec tsc --noEmit && pnpm test && pnpm build
cd packages/contracts && forge test
```

Deployment details, environment matrix, and chain configuration: [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Security

- The escrow went through a detailed internal security review with all findings fixed, plus a round of external AI-driven review with a public response: [`docs/security/2026-07-17-external-audit-response.md`](docs/security/2026-07-17-external-audit-response.md). Two more automated scans are in [`docs/security/`](docs/security/) (`2026-07-22-1dollar-audit-report.md`, `2026-07-22-nethermind-audit-agent-report.pdf`); their findings are under triage. No formal manual third-party audit has been performed yet. Judge your deposits accordingly — the contract is deliberately small, escape hatches (unilateral withdraw) are always available outside the 24-hour execution lock, and the code is fully public.
- The app is non-custodial: the server coordinates signatures and metadata but never holds funds, and clients independently verify the transaction they are asked to sign.
- Found a vulnerability? Please report it privately to the Namespace team rather than opening a public issue.

## License

[MIT](LICENSE)
