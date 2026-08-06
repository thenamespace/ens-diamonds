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

| Command                                                   | Purpose                                  |
| --------------------------------------------------------- | ---------------------------------------- |
| `pnpm --filter @ens-diamonds/contracts build`             | Compile contracts                        |
| `pnpm --filter @ens-diamonds/contracts lint`              | Check Forge formatting and lint rules    |
| `pnpm --filter @ens-diamonds/contracts format`            | Format Solidity                          |
| `pnpm --filter @ens-diamonds/contracts test`              | Run all local test suites                |
| `pnpm --filter @ens-diamonds/contracts test:fork`         | Run both pinned fork suites              |
| `pnpm --filter @ens-diamonds/contracts test:fork:mainnet` | Run the Mainnet fork suite               |
| `pnpm --filter @ens-diamonds/contracts test:fork:sepolia` | Run the Sepolia fork suite               |
| `pnpm --filter @ens-diamonds/contracts test:unit`         | Run focused unit tests                   |
| `pnpm --filter @ens-diamonds/contracts test:integration`  | Run local ENS and Safe integration tests |
| `pnpm --filter @ens-diamonds/contracts test:fuzz`         | Run stateless fuzz tests                 |
| `pnpm --filter @ens-diamonds/contracts test:invariant`    | Run stateful invariant tests             |
| `pnpm --filter @ens-diamonds/contracts test:coverage`     | Print protocol coverage                  |
| `pnpm --filter @ens-diamonds/contracts snapshot`          | Generate a gas snapshot                  |
| `pnpm --filter @ens-diamonds/contracts clean`             | Remove Foundry build artifacts           |

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
├── fork/         # Shared tests for pinned Mainnet and Sepolia snapshots
└── utils/        # Deployments, vault builders, actions, and state-specific bases
```

Tests use locally deployed ENS and Safe contracts rather than protocol mocks for normal
flows. Mocks are limited to explicit dependency-failure tests. The default suite does
not require an RPC.

## Fork tests

Fork tests run one shared Solidity suite against immutable JSON snapshots:

```text
test/fork/
├── config/
│   ├── mainnet-25647730.json
│   └── sepolia-10900000.json
├── ENSDiamondsFork.t.sol
├── ForkConfig.sol
├── ForkConfigLoader.sol
└── ForkTestBase.sol
```

The Mainnet snapshot uses block `25,647,730`. The Sepolia snapshot uses block
`10,900,000`, before the official controller was deauthorized at block `10,927,920`.
Both RPC endpoints must support historical state at their configured block.

Run both networks or one concrete wrapper:

```bash
pnpm --filter @ens-diamonds/contracts test:fork
pnpm --filter @ens-diamonds/contracts test:fork:mainnet
pnpm --filter @ens-diamonds/contracts test:fork:sepolia
```

Each manifest contains the chain identity, fork block, official ENS and Safe deployment
addresses, expected protocol parameters, Safe bytecode hashes, and semantic label
fixtures:

| State             | Mainnet                          | Sepolia                                  |
| ----------------- | -------------------------------- | ---------------------------------------- |
| Never registered  | `ens-diamonds-fork-25647730.eth` | `ens-diamonds-sepolia-fork-10900000.eth` |
| Premium active    | `way.eth`                        | `querty.eth`                             |
| Premium ended     | `agentquantum.eth`               | `jrasser.eth`                            |
| Grace period      | `dmitrybrain.eth`                | `omar.eth`                               |
| Active, unwrapped | `vitalik.eth`                    | `mainnet.eth`                            |
| Active, wrapped   | `aaaanna.eth`                    | `dog.eth`                                |

The concrete `MainnetForkTest` and `SepoliaForkTest` contracts inherit the same tests.
Adding or changing a network requires a snapshot manifest and a small `configPath`
override, not a duplicate test suite.

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
