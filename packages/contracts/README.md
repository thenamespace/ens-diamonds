# ENS Diamonds Contracts

ENS Diamonds lets a fixed group pool ETH to register one `.eth` name directly to a
deterministic Safe smart account. The contract never owns the name: the predicted Safe
is the registrant in the ENS commitment and receives the name at registration.

The implementation is a non-upgradeable singleton with no administrator, fees, tokens,
or rescue path. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the protocol model,
function-level flows, invariants, and design decisions.

## Requirements

- Git
- Node.js `>=22.18`
- pnpm `11.10.0`
- Foundry with Solidity `0.8.36` support

The contracts target the Cancun EVM and use EIP-1153 transient storage. Deploy only on
networks that support EIP-1153.

## Setup

From the repository root:

```bash
git submodule update --init --recursive
pnpm install
cp packages/contracts/.env.example packages/contracts/.env
```

Configure RPC and explorer credentials when scripts or verification need them:

```dotenv
ETHEREUM_MAINNET_RPC_URL=
ETHEREUM_SEPOLIA_RPC_URL=
ETHERSCAN_API_KEY=
```

## Commands

Run these from the repository root:

| Command                                                  | Purpose                                  |
| -------------------------------------------------------- | ---------------------------------------- |
| `pnpm --filter @ens-diamonds/contracts build`            | Compile contracts                        |
| `pnpm --filter @ens-diamonds/contracts lint`             | Check Forge formatting and lint rules    |
| `pnpm --filter @ens-diamonds/contracts format`           | Format Solidity                          |
| `pnpm --filter @ens-diamonds/contracts test`             | Run all local test suites                |
| `pnpm --filter @ens-diamonds/contracts test:fork`        | Run pinned mainnet fork tests            |
| `pnpm --filter @ens-diamonds/contracts test:unit`        | Run focused unit tests                   |
| `pnpm --filter @ens-diamonds/contracts test:integration` | Run local ENS and Safe integration tests |
| `pnpm --filter @ens-diamonds/contracts test:fuzz`        | Run stateless fuzz tests                 |
| `pnpm --filter @ens-diamonds/contracts test:invariant`   | Run stateful invariant tests             |
| `pnpm --filter @ens-diamonds/contracts test:coverage`    | Print protocol coverage                  |
| `pnpm --filter @ens-diamonds/contracts snapshot`         | Generate a gas snapshot                  |
| `pnpm --filter @ens-diamonds/contracts clean`            | Remove Foundry build artifacts           |

Direct Foundry commands can also be run from `packages/contracts`:

```bash
forge build
forge lint
forge test --no-match-path 'test/fork/*.t.sol'
forge coverage -D never --no-match-path 'test/fork/*.t.sol' --report summary
forge snapshot --no-match-path 'test/fork/*.t.sol'
```

Coverage instrumentation disables the normal optimizer settings and causes warnings in
upstream ENS and Safe sources. `-D never` changes only the compiler diagnostic policy
for that run; it does not suppress test failures.

## Test layout

```text
test/
├── unit/         # One public transition or failure family per file
├── integration/  # Full local ENS registration and Safe execution flows
├── fuzz/         # Accounting, timing, and deterministic-address properties
├── invariant/    # Stateful handler and protocol-wide invariants
├── fork/         # Pinned mainnet ENS and Safe integration tests
└── utils/        # Deployments, vault builders, actions, and state-specific bases
```

Tests use locally deployed ENS and Safe contracts rather than protocol mocks for normal
flows. Mocks are limited to explicit dependency-failure tests. The default suite does
not require an RPC.

## Mainnet fork tests

Fork tests use block `25,647,730` and require an archive-capable
`ETHEREUM_MAINNET_RPC_URL`. Set it in `packages/contracts/.env`, then run:

```bash
pnpm --filter @ens-diamonds/contracts test:fork
```

The pinned snapshot covers:

| Label                            | State at block `25,647,730` |
| -------------------------------- | --------------------------- |
| `way.eth`                        | Available, premium active   |
| `ens-diamonds-fork-25647730.eth` | Never registered, available |
| `vitalik.eth`                    | Registered, unavailable     |

Fork tests use the latest authorized ENS controller at
`0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547` and the deterministic Safe v1.5.0
deployments.

## Source layout

```text
src/
├── ENSDiamonds.sol
└── interfaces/
    ├── IBaseRegistrar.sol
    ├── IENSDiamonds.sol
    └── IENSDiamondsRegistrarController.sol
```

- `ENSDiamonds.sol` contains the complete protocol implementation.
- `IENSDiamonds.sol` defines the external ABI, state types, events, and protocol errors.
- `IENSDiamondsRegistrarController.sol` adds ENS controller getters absent from the
  upstream interface.
- `IBaseRegistrar.sol` contains only the two Base Registrar reads used by the protocol.

## Pinned contract dependencies

| Dependency             | Version   |
| ---------------------- | --------- |
| ENS Contracts          | `v1.7.0`  |
| Safe Smart Account     | `v1.5.0`  |
| Solady                 | `v0.1.26` |
| Forge Standard Library | `v1.16.2` |

Dependencies are pinned as Git submodules and recorded in `foundry.lock`.

## Status

The contracts are under active development. Do not use the protocol with real funds
before deployment validation and an independent security audit are complete.
