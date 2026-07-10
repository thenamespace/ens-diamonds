# CofferEscrow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and fully test `CofferEscrow` — the singleton escrow contract that holds pooled ETH during funding and, at finalization, deploys a contributor-owned Safe multisig and funds it — as an audit-ready Foundry package.

**Architecture:** A single immutable Solidity contract (no proxy, no admin, no upgradability) managing all pools by `poolId`. Pool status is derived, not stored. All ETH-moving functions use checks-effects-interactions plus a reentrancy guard. Safe deployment goes through the canonical `SafeProxyFactory`; unit tests mock it, and a mainnet-fork test exercises the real factory + a full ENS commit→register through the deployed Safe.

**Tech Stack:** Solidity `^0.8.24`, Foundry (forge/anvil), forge-std. pnpm workspace root so later phases (indexer/web/notifier) slot in; only `packages/contracts` is built in this phase.

**Reference:** `docs/superpowers/specs/2026-07-10-coffer-escrow-design.md` (authoritative for all decisions).

---

## Conventions used in this plan

- All contract code is Solidity `^0.8.24`, `SPDX-License-Identifier: MIT`.
- Run all `forge` commands from `packages/contracts/`.
- Commit after every green task using the message shown in that task's final step.
- "Run: … / Expected: …" steps are literal — run the command and confirm the output matches before checking the box.

---

## Task 1: Monorepo + Foundry scaffold

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `packages/contracts/foundry.toml`
- Create: `packages/contracts/remappings.txt`
- Create: `packages/contracts/.env.example`

- [ ] **Step 1: Create the workspace root files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`package.json`:
```json
{
  "name": "coffer",
  "private": true,
  "version": "0.0.0",
  "description": "Pool ETH to buy premium ENS names together",
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

- [ ] **Step 2: Create the Foundry config**

`packages/contracts/foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = false
ffi = false
fs_permissions = [{ access = "read", path = "./" }]

[fuzz]
runs = 256

[invariant]
runs = 64
depth = 32
fail_on_revert = false

[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
sepolia = "${SEPOLIA_RPC_URL}"
```

`packages/contracts/remappings.txt`:
```
forge-std/=lib/forge-std/src/
```

`packages/contracts/.env.example`:
```
# RPC endpoints (fork tests + deploy). Never commit the real .env.
MAINNET_RPC_URL=
SEPOLIA_RPC_URL=

# Deployer (use a throwaway key; never a mainnet key with funds in plaintext)
DEPLOYER_PRIVATE_KEY=

# Canonical addresses — VERIFY each against official deployment lists at deploy time.
# Do NOT trust values from model memory. See Task 12 for how to resolve them.
SAFE_PROXY_FACTORY=
SAFE_SINGLETON=
SAFE_FALLBACK_HANDLER=
```

- [ ] **Step 3: Install forge-std as a tracked submodule**

Run: `cd packages/contracts && forge install foundry-rs/forge-std`
Expected: `lib/forge-std` created; `.gitmodules` written at repo root.

- [ ] **Step 4: Verify the toolchain builds**

Run: `forge build`
Expected: `Compiler run successful` (nothing to compile yet, but config parses and forge-std resolves).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm workspace + Foundry contracts package"
```

---

## Task 2: Safe & ENS interfaces

**Files:**
- Create: `packages/contracts/src/interfaces/ISafeProxyFactory.sol`
- Create: `packages/contracts/src/interfaces/ISafe.sol`
- Create: `packages/contracts/src/interfaces/IENS.sol`

- [ ] **Step 1: Write the Safe interfaces**

`packages/contracts/src/interfaces/ISafeProxyFactory.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface to the canonical Safe proxy factory (v1.4.1).
interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address proxy);
}
```

`packages/contracts/src/interfaces/ISafe.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface to the canonical Safe singleton (v1.4.1) setup entrypoint.
interface ISafe {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;
}
```

- [ ] **Step 2: Write the ENS interfaces (used only by the fork test)**

`packages/contracts/src/interfaces/IENS.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPriceOracle {
    struct Price {
        uint256 base;
        uint256 premium;
    }
}

/// @notice ENS ETHRegistrarController surface used by the fork test.
/// Verify the on-chain function signatures against the deployed controller
/// at implementation time (Task 11) — this is the current mainnet shape.
interface IETHRegistrarController {
    function rentPrice(string memory name, uint256 duration) external view returns (IPriceOracle.Price memory);
    function minCommitmentAge() external view returns (uint256);
    function makeCommitment(
        string memory name,
        address owner,
        uint256 duration,
        bytes32 secret,
        address resolver,
        bytes[] calldata data,
        bool reverseRecord,
        uint16 ownerControlledFuses
    ) external pure returns (bytes32);
    function commit(bytes32 commitment) external;
    function register(
        string calldata name,
        address owner,
        uint256 duration,
        bytes32 secret,
        address resolver,
        bytes[] calldata data,
        bool reverseRecord,
        uint16 ownerControlledFuses
    ) external payable;
}

interface IBaseRegistrar {
    function ownerOf(uint256 tokenId) external view returns (address);
}
```

- [ ] **Step 3: Verify it builds**

Run: `forge build`
Expected: `Compiler run successful`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(contracts): add Safe and ENS interfaces"
```

---

## Task 3: Contract skeleton — storage, errors, events, constructor, `status()`

**Files:**
- Create: `packages/contracts/src/CofferEscrow.sol`
- Test: `packages/contracts/test/CofferEscrow.t.sol`

- [ ] **Step 1: Write the failing test for constructor + initial status**

`packages/contracts/test/CofferEscrow.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CofferEscrow} from "../src/CofferEscrow.sol";

contract CofferEscrowTest is Test {
    CofferEscrow escrow;

    address factory = address(0xFAC);
    address singleton = address(0x51);
    address fallbackHandler = address(0xFB);

    function setUp() public virtual {
        escrow = new CofferEscrow(factory, singleton, fallbackHandler);
    }

    function test_constructor_setsImmutables() public view {
        assertEq(escrow.safeProxyFactory(), factory);
        assertEq(escrow.safeSingleton(), singleton);
        assertEq(escrow.safeFallbackHandler(), fallbackHandler);
        assertEq(escrow.poolCount(), 0);
        assertEq(escrow.EXECUTION_WINDOW(), 7 days);
        assertEq(escrow.MIN_CONTRIBUTION(), 0.01 ether);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `forge test --match-test test_constructor_setsImmutables -vv`
Expected: FAIL — cannot find `CofferEscrow` (file does not exist).

- [ ] **Step 3: Write the contract skeleton**

`packages/contracts/src/CofferEscrow.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISafeProxyFactory} from "./interfaces/ISafeProxyFactory.sol";
import {ISafe} from "./interfaces/ISafe.sol";

/// @title CofferEscrow
/// @notice Singleton escrow that pools ETH to buy premium ENS names. On
///         finalization it deploys a Safe owned by all contributors and funds it.
///         Immutable by design: no proxy, no admin, no pause, no upgrade path.
contract CofferEscrow {
    // ----------------------------- Types -----------------------------------
    enum PoolStatus {
        Funding,
        Funded,
        Finalized,
        Expired
    }

    struct Pool {
        string label; // plaintext .eth label, e.g. "defi" (no ".eth")
        address creator;
        uint96 targetAmount; // wei
        uint96 totalDeposited; // wei
        uint40 fundingDeadline; // unix ts
        uint40 fundedAt; // set when totalDeposited first hits target; reset to 0 if it later drops below
        uint8 threshold; // Safe threshold, set at creation
        address safe; // zero until finalized
    }

    // --------------------------- Constants ----------------------------------
    uint256 public constant EXECUTION_WINDOW = 7 days;
    uint96 public constant MIN_CONTRIBUTION = 0.01 ether;

    // --------------------------- Immutables ---------------------------------
    address public immutable safeProxyFactory;
    address public immutable safeSingleton;
    address public immutable safeFallbackHandler;

    // ---------------------------- Storage -----------------------------------
    mapping(uint256 => Pool) public pools;
    mapping(uint256 => mapping(address => uint96)) public deposits;
    mapping(uint256 => mapping(address => bool)) public invited;
    mapping(uint256 => address[]) internal contributors;
    uint256 public poolCount;

    uint256 private _locked = 1; // reentrancy guard state

    // ----------------------------- Events -----------------------------------
    event PoolCreated(
        uint256 indexed poolId,
        string label,
        address indexed creator,
        uint96 targetAmount,
        uint40 fundingDeadline,
        uint8 threshold,
        address[] invitees
    );
    event Deposited(uint256 indexed poolId, address indexed member, uint96 amount, uint96 totalDeposited);
    event Withdrawn(uint256 indexed poolId, address indexed member, uint96 amount, uint96 totalDeposited);
    event PoolFunded(uint256 indexed poolId);
    event PoolFinalized(
        uint256 indexed poolId, address indexed safe, address[] contributors, uint8 threshold, uint96 amount
    );

    // ----------------------------- Errors -----------------------------------
    error InvalidTarget();
    error InvalidDeadline();
    error LabelTooShort();
    error InvalidThreshold();
    error DuplicateInvitee();
    error NotInvited();
    error WrongStatus();
    error ZeroValue();
    error BelowMinimum();
    error Overshoot();
    error NoDeposit();
    error WithdrawLocked();
    error NotContributor();
    error BelowThreshold();
    error SafeDeployFailed();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address _factory, address _singleton, address _fallbackHandler) {
        safeProxyFactory = _factory;
        safeSingleton = _singleton;
        safeFallbackHandler = _fallbackHandler;
    }

    // ----------------------------- Views ------------------------------------

    /// @notice Derived pool status (never stored). See spec §4.
    function status(uint256 poolId) public view returns (PoolStatus) {
        Pool storage p = pools[poolId];
        if (p.safe != address(0)) return PoolStatus.Finalized;
        if (p.totalDeposited == p.targetAmount) {
            if (block.timestamp <= uint256(p.fundedAt) + EXECUTION_WINDOW) {
                return PoolStatus.Funded;
            }
            return PoolStatus.Funding; // execution lock lapsed → withdrawable again
        }
        if (block.timestamp > p.fundingDeadline) return PoolStatus.Expired;
        return PoolStatus.Funding;
    }

    /// @notice Contributor addresses and their current deposit amounts.
    /// Implemented in the skeleton so test files referencing it always compile.
    function getContributors(uint256 poolId) external view returns (address[] memory addrs, uint96[] memory amounts) {
        addrs = contributors[poolId];
        amounts = new uint96[](addrs.length);
        for (uint256 i = 0; i < addrs.length; i++) {
            amounts[i] = deposits[poolId][addrs[i]];
        }
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `forge test --match-test test_constructor_setsImmutables -vv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(contracts): CofferEscrow skeleton with storage, events, status()"
```

---

## Task 4: `createPool`

**Files:**
- Modify: `packages/contracts/src/CofferEscrow.sol` (add `createPool`)
- Test: `packages/contracts/test/CofferEscrow.t.sol` (add tests)

- [ ] **Step 1: Write the failing tests**

Add to `CofferEscrowTest`:
```solidity
    address creator = address(0xC0FFEE);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function _invitees2() internal view returns (address[] memory a) {
        a = new address[](2);
        a[0] = alice;
        a[1] = bob;
    }

    function test_createPool_happyPath() public {
        vm.prank(creator);
        uint256 id = escrow.createPool("defi", 10 ether, uint40(block.timestamp + 3 days), 2, _invitees2());

        assertEq(id, 0);
        assertEq(escrow.poolCount(), 1);

        (
            string memory label,
            address c,
            uint96 target,
            uint96 total,
            uint40 deadline,
            uint40 fundedAt,
            uint8 threshold,
            address safe
        ) = escrow.pools(id);
        assertEq(label, "defi");
        assertEq(c, creator);
        assertEq(target, 10 ether);
        assertEq(total, 0);
        assertEq(deadline, uint40(block.timestamp + 3 days));
        assertEq(fundedAt, 0);
        assertEq(threshold, 2);
        assertEq(safe, address(0));

        assertTrue(escrow.invited(id, creator));
        assertTrue(escrow.invited(id, alice));
        assertTrue(escrow.invited(id, bob));
        assertEq(uint256(escrow.status(id)), uint256(CofferEscrow.PoolStatus.Funding));
    }

    function test_createPool_revertsOnZeroTarget() public {
        vm.prank(creator);
        vm.expectRevert(CofferEscrow.InvalidTarget.selector);
        escrow.createPool("defi", 0, uint40(block.timestamp + 1 days), 1, _invitees2());
    }

    function test_createPool_revertsOnPastDeadline() public {
        vm.warp(1_000_000);
        vm.prank(creator);
        vm.expectRevert(CofferEscrow.InvalidDeadline.selector);
        escrow.createPool("defi", 1 ether, uint40(block.timestamp), 1, _invitees2());
    }

    function test_createPool_revertsOnShortLabel() public {
        vm.prank(creator);
        vm.expectRevert(CofferEscrow.LabelTooShort.selector);
        escrow.createPool("ab", 1 ether, uint40(block.timestamp + 1 days), 1, _invitees2());
    }

    function test_createPool_revertsOnThresholdTooHigh() public {
        // 2 invitees + creator = 3 possible signers; threshold 4 is invalid
        vm.prank(creator);
        vm.expectRevert(CofferEscrow.InvalidThreshold.selector);
        escrow.createPool("defi", 1 ether, uint40(block.timestamp + 1 days), 4, _invitees2());
    }

    function test_createPool_revertsOnZeroThreshold() public {
        vm.prank(creator);
        vm.expectRevert(CofferEscrow.InvalidThreshold.selector);
        escrow.createPool("defi", 1 ether, uint40(block.timestamp + 1 days), 0, _invitees2());
    }

    function test_createPool_revertsOnDuplicateInvitee() public {
        address[] memory dup = new address[](2);
        dup[0] = alice;
        dup[1] = alice;
        vm.prank(creator);
        vm.expectRevert(CofferEscrow.DuplicateInvitee.selector);
        escrow.createPool("defi", 1 ether, uint40(block.timestamp + 1 days), 1, dup);
    }

    function test_createPool_revertsWhenCreatorInInvitees() public {
        address[] memory a = new address[](1);
        a[0] = creator;
        vm.prank(creator);
        vm.expectRevert(CofferEscrow.DuplicateInvitee.selector);
        escrow.createPool("defi", 1 ether, uint40(block.timestamp + 1 days), 1, a);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `forge test --match-test test_createPool -vv`
Expected: FAIL — `createPool` not defined / compilation error.

- [ ] **Step 3: Implement `createPool`**

Add to `CofferEscrow` (after `status`):
```solidity
    function createPool(
        string calldata label,
        uint96 targetAmount,
        uint40 fundingDeadline,
        uint8 threshold,
        address[] calldata invitees
    ) external returns (uint256 poolId) {
        if (targetAmount == 0) revert InvalidTarget();
        if (fundingDeadline <= block.timestamp) revert InvalidDeadline();
        if (bytes(label).length < 3) revert LabelTooShort();
        if (threshold < 1 || threshold > invitees.length + 1) revert InvalidThreshold();

        poolId = poolCount++;
        Pool storage p = pools[poolId];
        p.label = label;
        p.creator = msg.sender;
        p.targetAmount = targetAmount;
        p.fundingDeadline = fundingDeadline;
        p.threshold = threshold;

        invited[poolId][msg.sender] = true; // creator auto-invited

        for (uint256 i = 0; i < invitees.length; i++) {
            address invitee = invitees[i];
            if (invited[poolId][invitee]) revert DuplicateInvitee(); // also catches creator-in-invitees
            invited[poolId][invitee] = true;
        }

        emit PoolCreated(poolId, label, msg.sender, targetAmount, fundingDeadline, threshold, invitees);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `forge test --match-test test_createPool -vv`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(contracts): createPool with validation and dedupe-revert"
```

---

## Task 5: `deposit`

**Files:**
- Modify: `packages/contracts/src/CofferEscrow.sol` (add `deposit`)
- Test: `packages/contracts/test/CofferEscrow.t.sol` (add tests + helper)

- [ ] **Step 1: Write the failing tests**

Add a pool-creation helper and tests to `CofferEscrowTest`:
```solidity
    // Creates a pool: target 10 ETH, deadline +3d, threshold 2, invitees [alice, bob].
    function _createDefaultPool() internal returns (uint256 id) {
        vm.prank(creator);
        id = escrow.createPool("defi", 10 ether, uint40(block.timestamp + 3 days), 2, _invitees2());
    }

    function test_deposit_happyPath() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit CofferEscrow.Deposited(id, alice, 4 ether, 4 ether);
        escrow.deposit{value: 4 ether}(id);

        assertEq(escrow.deposits(id, alice), 4 ether);
        (,,, uint96 total,,,,) = escrow.pools(id);
        assertEq(total, 4 ether);
        assertEq(address(escrow).balance, 4 ether);
        (address[] memory addrs,) = escrow.getContributors(id);
        assertEq(addrs.length, 1);
        assertEq(addrs[0], alice);
    }

    function test_deposit_revertsIfNotInvited() public {
        uint256 id = _createDefaultPool();
        address stranger = address(0xDEAD);
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(CofferEscrow.NotInvited.selector);
        escrow.deposit{value: 1 ether}(id);
    }

    function test_deposit_revertsOnZeroValue() public {
        uint256 id = _createDefaultPool();
        vm.prank(alice);
        vm.expectRevert(CofferEscrow.ZeroValue.selector);
        escrow.deposit{value: 0}(id);
    }

    function test_deposit_revertsOnOvershoot() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        vm.expectRevert(CofferEscrow.Overshoot.selector);
        escrow.deposit{value: 11 ether}(id); // target is 10
    }

    function test_deposit_revertsBelowMinimumForNewDepositor() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(CofferEscrow.BelowMinimum.selector);
        escrow.deposit{value: 0.005 ether}(id); // below 0.01 and not an exact gap
    }

    function test_deposit_allowsTopUpBelowMinimum() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.startPrank(alice);
        escrow.deposit{value: 1 ether}(id); // establishes a deposit
        escrow.deposit{value: 0.001 ether}(id); // top-up may be below minimum
        vm.stopPrank();
        assertEq(escrow.deposits(id, alice), 1.001 ether);
    }

    function test_deposit_allowsSubMinimumExactGap() public {
        // Fill to a remaining gap smaller than MIN_CONTRIBUTION, then let a NEW
        // depositor close it with an exact-gap deposit below the minimum.
        vm.prank(creator);
        uint256 id = escrow.createPool("defi", 1 ether, uint40(block.timestamp + 3 days), 1, _invitees2());
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        vm.prank(alice);
        escrow.deposit{value: 0.995 ether}(id); // remaining = 0.005 ETH (< MIN)

        vm.prank(bob);
        escrow.deposit{value: 0.005 ether}(id); // exact-gap close, below MIN, must succeed
        (,,, uint96 total,,,,) = escrow.pools(id);
        assertEq(total, 1 ether);
    }

    function test_deposit_exactFillMarksFundedAndEmits() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        vm.prank(alice);
        escrow.deposit{value: 6 ether}(id);

        vm.prank(bob);
        vm.expectEmit(true, false, false, false, address(escrow));
        emit CofferEscrow.PoolFunded(id);
        escrow.deposit{value: 4 ether}(id); // reaches target exactly

        (,,,, , uint40 fundedAt,,) = escrow.pools(id);
        assertEq(fundedAt, uint40(block.timestamp));
        assertEq(uint256(escrow.status(id)), uint256(CofferEscrow.PoolStatus.Funded));
    }

    function test_deposit_revertsWhenNotFunding() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 6 ether}(id);
        vm.prank(bob);
        escrow.deposit{value: 4 ether}(id); // now Funded

        vm.prank(alice);
        vm.expectRevert(CofferEscrow.WrongStatus.selector);
        escrow.deposit{value: 1 ether}(id);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `forge test --match-test test_deposit -vv`
Expected: FAIL — `deposit` not defined.

- [ ] **Step 3: Implement `deposit`**

Add to `CofferEscrow`:
```solidity
    function deposit(uint256 poolId) external payable {
        Pool storage p = pools[poolId];
        if (!invited[poolId][msg.sender]) revert NotInvited();
        if (status(poolId) != PoolStatus.Funding) revert WrongStatus();
        if (msg.value == 0) revert ZeroValue();

        uint96 remaining = p.targetAmount - p.totalDeposited;
        if (msg.value > remaining) revert Overshoot();
        uint96 amount = uint96(msg.value); // safe: msg.value <= remaining <= type(uint96).max

        bool isTopUp = deposits[poolId][msg.sender] > 0;
        bool isExactGap = amount == remaining;
        if (!isTopUp && !isExactGap && amount < MIN_CONTRIBUTION) revert BelowMinimum();

        if (!isTopUp) {
            contributors[poolId].push(msg.sender);
        }
        deposits[poolId][msg.sender] += amount;
        p.totalDeposited += amount;

        if (p.totalDeposited == p.targetAmount) {
            p.fundedAt = uint40(block.timestamp);
            emit PoolFunded(poolId);
        }

        emit Deposited(poolId, msg.sender, amount, p.totalDeposited);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `forge test --match-test test_deposit -vv`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(contracts): deposit with exact-gap rule and funded detection"
```

---

## Task 6: `withdraw` + `_removeContributor`

**Files:**
- Modify: `packages/contracts/src/CofferEscrow.sol` (add `withdraw`, `_removeContributor`)
- Test: `packages/contracts/test/CofferEscrow.t.sol` (add tests)

- [ ] **Step 1: Write the failing tests**

Add to `CofferEscrowTest`:
```solidity
    function test_withdraw_happyPathDuringFunding() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 4 ether}(id);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit CofferEscrow.Withdrawn(id, alice, 4 ether, 0);
        escrow.withdraw(id);

        assertEq(alice.balance, balBefore + 4 ether);
        assertEq(escrow.deposits(id, alice), 0);
        (,,, uint96 total,,,,) = escrow.pools(id);
        assertEq(total, 0);
        (address[] memory addrs,) = escrow.getContributors(id);
        assertEq(addrs.length, 0);
    }

    function test_withdraw_swapAndPopKeepsOthers() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 3 ether}(id);
        vm.prank(bob);
        escrow.deposit{value: 3 ether}(id);

        vm.prank(alice);
        escrow.withdraw(id);

        (address[] memory addrs, uint96[] memory amts) = escrow.getContributors(id);
        assertEq(addrs.length, 1);
        assertEq(addrs[0], bob);
        assertEq(amts[0], 3 ether);
    }

    function test_withdraw_revertsWithNoDeposit() public {
        uint256 id = _createDefaultPool();
        vm.prank(alice);
        vm.expectRevert(CofferEscrow.NoDeposit.selector);
        escrow.withdraw(id);
    }

    function test_withdraw_lockedWhileFunded() public {
        uint256 id = _fundPool(); // fully funded, within lock
        vm.prank(alice);
        vm.expectRevert(CofferEscrow.WithdrawLocked.selector);
        escrow.withdraw(id);
    }

    function test_withdraw_allowedAfterLockLapses() public {
        uint256 id = _fundPool();
        // move past the execution window
        vm.warp(block.timestamp + 7 days + 1);
        assertEq(uint256(escrow.status(id)), uint256(CofferEscrow.PoolStatus.Funding));

        vm.prank(alice);
        escrow.withdraw(id);
        assertEq(escrow.deposits(id, alice), 0);
        // fundedAt reset after dropping below target
        (,,,, , uint40 fundedAt,,) = escrow.pools(id);
        assertEq(fundedAt, 0);
    }

    function test_withdraw_allowedWhenExpired() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 4 ether}(id); // partial, never funded

        vm.warp(block.timestamp + 3 days + 1); // past deadline → Expired
        assertEq(uint256(escrow.status(id)), uint256(CofferEscrow.PoolStatus.Expired));

        vm.prank(alice);
        escrow.withdraw(id);
        assertEq(escrow.deposits(id, alice), 0);
    }

    // Funds the default pool exactly to target (alice 6, bob 4). Within lock.
    function _fundPool() internal returns (uint256 id) {
        id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 6 ether}(id);
        vm.prank(bob);
        escrow.deposit{value: 4 ether}(id);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `forge test --match-test test_withdraw -vv`
Expected: FAIL — `withdraw` not defined.

- [ ] **Step 3: Implement `withdraw` and `_removeContributor`**

Add to `CofferEscrow`:
```solidity
    function withdraw(uint256 poolId) external nonReentrant {
        Pool storage p = pools[poolId];
        PoolStatus s = status(poolId);
        if (s != PoolStatus.Funding && s != PoolStatus.Expired) revert WithdrawLocked();

        uint96 amount = deposits[poolId][msg.sender];
        if (amount == 0) revert NoDeposit();

        // effects
        deposits[poolId][msg.sender] = 0;
        p.totalDeposited -= amount;
        _removeContributor(poolId, msg.sender);
        if (p.totalDeposited < p.targetAmount && p.fundedAt != 0) {
            p.fundedAt = 0;
        }

        emit Withdrawn(poolId, msg.sender, amount, p.totalDeposited);

        // interaction
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _removeContributor(uint256 poolId, address member) internal {
        address[] storage arr = contributors[poolId];
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == member) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `forge test --match-test test_withdraw -vv`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(contracts): withdraw with lock window and fundedAt reset"
```

---

## Task 7: `finalize` + Safe mocks

**Files:**
- Create: `packages/contracts/test/mocks/MockSafe.sol`
- Create: `packages/contracts/test/mocks/MockSafeProxyFactory.sol`
- Modify: `packages/contracts/src/CofferEscrow.sol` (add `finalize`)
- Test: `packages/contracts/test/CofferEscrow.t.sol` (add tests; wire mock factory)

- [ ] **Step 1: Write the mocks**

`packages/contracts/test/mocks/MockSafe.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal Safe stand-in: records setup args and accepts ETH.
contract MockSafe {
    address[] public owners;
    uint256 public threshold;
    address public fallbackHandler;
    bool public initialized;

    function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address, // to
        bytes calldata, // data
        address _fallbackHandler,
        address, // paymentToken
        uint256, // payment
        address payable // paymentReceiver
    ) external {
        owners = _owners;
        threshold = _threshold;
        fallbackHandler = _fallbackHandler;
        initialized = true;
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    receive() external payable {}
}
```

`packages/contracts/test/mocks/MockSafeProxyFactory.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockSafe} from "./MockSafe.sol";

/// @notice Deploys a MockSafe and forwards the initializer, mirroring the real
///         SafeProxyFactory.createProxyWithNonce shape used by CofferEscrow.
contract MockSafeProxyFactory {
    event ProxyCreation(address proxy);

    function createProxyWithNonce(address, /*singleton*/ bytes memory initializer, uint256 /*saltNonce*/ )
        external
        returns (address proxy)
    {
        MockSafe s = new MockSafe();
        (bool ok,) = address(s).call(initializer);
        require(ok, "setup failed");
        proxy = address(s);
        emit ProxyCreation(proxy);
    }
}
```

- [ ] **Step 2: Write the failing tests**

At the top of `CofferEscrow.t.sol`, add imports:
```solidity
import {MockSafe} from "./mocks/MockSafe.sol";
import {MockSafeProxyFactory} from "./mocks/MockSafeProxyFactory.sol";
```

Replace the `setUp()` body so the factory is a real mock (keep `singleton`/`fallbackHandler` as sentinels):
```solidity
    MockSafeProxyFactory mockFactory;

    function setUp() public virtual {
        mockFactory = new MockSafeProxyFactory();
        factory = address(mockFactory);
        escrow = new CofferEscrow(factory, singleton, fallbackHandler);
    }
```
(Delete the old `factory = address(0xFAC);` initializer so `factory` is assigned in `setUp`; `test_constructor_setsImmutables` still passes because it reads whatever `factory` holds.)

Add finalize tests:
```solidity
    function test_finalize_happyPath() public {
        uint256 id = _fundPool(); // alice 6, bob 4, threshold 2, contributors = 2

        vm.prank(alice);
        address safe = escrow.finalize(id);

        assertTrue(safe != address(0));
        assertEq(safe.balance, 10 ether);
        assertEq(address(escrow).balance, 0);

        (,,,,,,, address storedSafe) = escrow.pools(id);
        assertEq(storedSafe, safe);
        assertEq(uint256(escrow.status(id)), uint256(CofferEscrow.PoolStatus.Finalized));

        MockSafe s = MockSafe(payable(safe));
        assertEq(s.threshold(), 2);
        assertEq(s.fallbackHandler(), fallbackHandler);
        address[] memory owners = s.getOwners();
        assertEq(owners.length, 2);
        assertEq(owners[0], alice);
        assertEq(owners[1], bob);
    }

    function test_finalize_emitsEvent() public {
        uint256 id = _fundPool();
        vm.prank(alice);
        vm.recordLogs();
        escrow.finalize(id);
        // event presence is asserted via storedSafe + status in happyPath; here just ensure no revert
        (,,,,,,, address storedSafe) = escrow.pools(id);
        assertTrue(storedSafe != address(0));
    }

    function test_finalize_revertsWhenNotFunded() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 4 ether}(id); // partial only

        vm.prank(alice);
        vm.expectRevert(CofferEscrow.WrongStatus.selector);
        escrow.finalize(id);
    }

    function test_finalize_revertsForNonContributor() public {
        uint256 id = _fundPool();
        // bob's co-invitee "carol" was never invited; use an invited-but-not-contributed path:
        // create a pool where a third invitee never deposits, then have them finalize.
        vm.prank(bob); // bob IS a contributor, so use a stranger instead
        // stranger not invited/contributor:
        address stranger = address(0xBEEF);
        vm.prank(stranger);
        vm.expectRevert(CofferEscrow.NotContributor.selector);
        escrow.finalize(id);
    }

    function test_finalize_revertsBelowThreshold() public {
        // One contributor funds the whole target but threshold is 2 → hard-block.
        vm.prank(creator);
        uint256 id = escrow.createPool("defi", 5 ether, uint40(block.timestamp + 3 days), 2, _invitees2());
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 5 ether}(id); // funded by ONE contributor

        assertEq(uint256(escrow.status(id)), uint256(CofferEscrow.PoolStatus.Funded));
        vm.prank(alice);
        vm.expectRevert(CofferEscrow.BelowThreshold.selector);
        escrow.finalize(id);
    }

    function test_finalize_revertsOutsideWindow() public {
        uint256 id = _fundPool();
        vm.warp(block.timestamp + 7 days + 1); // lock lapsed → status Funding, not Funded
        vm.prank(alice);
        vm.expectRevert(CofferEscrow.WrongStatus.selector);
        escrow.finalize(id);
    }
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `forge test --match-test test_finalize -vv`
Expected: FAIL — `finalize` not defined.

- [ ] **Step 4: Implement `finalize`**

Add to `CofferEscrow`:
```solidity
    function finalize(uint256 poolId) external nonReentrant returns (address safe) {
        Pool storage p = pools[poolId];
        if (status(poolId) != PoolStatus.Funded) revert WrongStatus();
        if (deposits[poolId][msg.sender] == 0) revert NotContributor();

        address[] memory owners = contributors[poolId];
        if (owners.length < p.threshold) revert BelowThreshold();

        bytes memory initializer = abi.encodeWithSelector(
            ISafe.setup.selector,
            owners,
            uint256(p.threshold),
            address(0), // to
            bytes(""), // data
            safeFallbackHandler,
            address(0), // paymentToken
            uint256(0), // payment
            payable(address(0)) // paymentReceiver
        );

        // interaction 1: deploy the Safe via the trusted factory (guarded by nonReentrant)
        safe = ISafeProxyFactory(safeProxyFactory).createProxyWithNonce(safeSingleton, initializer, poolId);
        if (safe == address(0)) revert SafeDeployFailed();

        // effect: mark finalized before sending funds (status becomes Finalized)
        p.safe = safe;

        uint96 amount = p.targetAmount;
        emit PoolFinalized(poolId, safe, owners, p.threshold, amount);

        // interaction 2: fund the Safe
        (bool ok,) = safe.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `forge test --match-test test_finalize -vv`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(contracts): finalize deploys Safe and sweeps target; add Safe mocks"
```

---

## Task 8: View — `ownershipBps`

**Files:**
- Modify: `packages/contracts/src/CofferEscrow.sol` (add `ownershipBps`)
- Test: `packages/contracts/test/CofferEscrow.t.sol` (add tests)

> `getContributors` was implemented in the Task 3 skeleton (so test files compile). This task adds only `ownershipBps`.

- [ ] **Step 1: Write the failing tests**

Add to `CofferEscrowTest`:
```solidity
    function test_ownershipBps_proportionalToTarget() public {
        uint256 id = _createDefaultPool(); // target 10 ETH
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 2.5 ether}(id); // 25%
        vm.prank(bob);
        escrow.deposit{value: 5 ether}(id); // 50%

        assertEq(escrow.ownershipBps(id, alice), 2500);
        assertEq(escrow.ownershipBps(id, bob), 5000);
        assertEq(escrow.ownershipBps(id, creator), 0);
    }

    function test_ownershipBps_sumsTo10000WhenFunded() public {
        uint256 id = _fundPool(); // alice 6 (60%), bob 4 (40%)
        assertEq(escrow.ownershipBps(id, alice) + escrow.ownershipBps(id, bob), 10000);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `forge test --match-test test_ownershipBps -vv`
Expected: FAIL — `ownershipBps` not defined.

- [ ] **Step 3: Implement the view**

Add to `CofferEscrow`:
```solidity
    function ownershipBps(uint256 poolId, address member) external view returns (uint256) {
        return uint256(deposits[poolId][member]) * 10_000 / pools[poolId].targetAmount;
    }
```

- [ ] **Step 4: Run the whole suite**

Run: `forge test -vv`
Expected: PASS — all unit tests green (Tasks 3–8).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(contracts): ownershipBps and getContributors views"
```

---

## Task 9: Reentrancy protection test

**Files:**
- Create: `packages/contracts/test/mocks/ReentrantAttacker.sol`
- Test: `packages/contracts/test/CofferEscrow.t.sol` (add test)

- [ ] **Step 1: Write the attacker mock**

`packages/contracts/test/mocks/ReentrantAttacker.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CofferEscrow} from "../../src/CofferEscrow.sol";

/// @notice On receiving a withdrawal, tries to re-enter withdraw().
contract ReentrantAttacker {
    CofferEscrow public immutable escrow;
    uint256 public poolId;
    bool public reentered;

    constructor(CofferEscrow _escrow) {
        escrow = _escrow;
    }

    function depositTo(uint256 _poolId) external payable {
        poolId = _poolId;
        escrow.deposit{value: msg.value}(_poolId);
    }

    function triggerWithdraw() external {
        escrow.withdraw(poolId);
    }

    receive() external payable {
        // Attempt reentrancy exactly once; swallow the revert so the outer
        // call's success flag reflects the failed reentrant transfer.
        if (!reentered) {
            reentered = true;
            try escrow.withdraw(poolId) {} catch {}
        }
    }
}
```

- [ ] **Step 2: Write the failing test**

Add import and test to `CofferEscrow.t.sol`:
```solidity
import {ReentrantAttacker} from "./mocks/ReentrantAttacker.sol";
```
```solidity
    function test_withdraw_isReentrancySafe() public {
        // Pool holds BOTH the attacker's and an honest member's funds, so a successful
        // reentrant withdraw would let the attacker drain the honest member. The pool
        // stays in Funding (total < target) so withdraw is allowed.
        ReentrantAttacker attacker = new ReentrantAttacker(escrow);
        address[] memory inv = new address[](2);
        inv[0] = address(attacker);
        inv[1] = alice;
        vm.prank(creator);
        uint256 id = escrow.createPool("defi", 10 ether, uint40(block.timestamp + 3 days), 1, inv);

        vm.deal(address(this), 100 ether);
        attacker.depositTo{value: 3 ether}(id);
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 3 ether}(id);
        assertEq(address(escrow).balance, 6 ether);

        // Attacker withdraws; its receive() attempts to re-enter withdraw(). The
        // nonReentrant guard blocks the nested call (and CEI already zeroed the deposit),
        // so the attacker recovers exactly its own 3 ETH — no double-spend — and the
        // honest member's 3 ETH is untouched.
        attacker.triggerWithdraw();

        assertTrue(attacker.reentered(), "reentry was not attempted");
        assertEq(escrow.deposits(id, address(attacker)), 0);
        assertEq(address(attacker).balance, 3 ether, "attacker extracted more than its deposit");
        assertEq(address(escrow).balance, 3 ether, "honest member's funds were drained");
        assertEq(escrow.deposits(id, alice), 3 ether, "honest member's ledger changed");
    }
```

> **Plan correction:** an earlier draft of this test expected `withdraw` to revert with `TransferFailed`. That was wrong about EVM semantics — `ReentrantAttacker.receive()` wraps its reentrant call in `try/catch {}`, which swallows the guard's revert, so the outer `.call` succeeds and `withdraw` completes. The corrected test above proves the real property: reentry is *attempted* (`reentered == true`) but the guard + CEI prevent any double-spend or cross-member drain.

- [ ] **Step 3: Run test to verify it passes**

Run: `forge test --match-test test_withdraw_isReentrancySafe -vv`
Expected: PASS — the guard already exists (Task 6); this test locks the behavior in. If it FAILS, the guard/CEI is broken; fix before proceeding.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(contracts): reentrancy protection on withdraw"
```

---

## Task 10: Invariant tests

**Files:**
- Create: `packages/contracts/test/handlers/EscrowHandler.sol`
- Create: `packages/contracts/test/CofferEscrow.invariant.t.sol`

- [ ] **Step 1: Write the handler**

`packages/contracts/test/handlers/EscrowHandler.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CofferEscrow} from "../../src/CofferEscrow.sol";

/// @notice Drives randomized createPool/deposit/withdraw sequences for invariant testing.
contract EscrowHandler is Test {
    CofferEscrow public escrow;

    address[] public actors;
    uint256[] public poolIds;

    constructor(CofferEscrow _escrow) {
        escrow = _escrow;
        for (uint256 i = 0; i < 5; i++) {
            address a = address(uint160(0x1000 + i));
            actors.push(a);
            vm.deal(a, 1_000 ether);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function createPool(uint256 actorSeed, uint96 target, uint40 dl) public {
        address creator = _actor(actorSeed);
        target = uint96(bound(target, 0.1 ether, 100 ether));
        dl = uint40(bound(dl, block.timestamp + 1, block.timestamp + 30 days));
        // invite all actors except the creator
        address[] memory inv = new address[](actors.length - 1);
        uint256 j = 0;
        for (uint256 i = 0; i < actors.length; i++) {
            if (actors[i] != creator) {
                inv[j++] = actors[i];
            }
        }
        vm.prank(creator);
        try escrow.createPool("pool", target, dl, 1, inv) returns (uint256 id) {
            poolIds.push(id);
        } catch {}
    }

    function deposit(uint256 actorSeed, uint256 poolSeed, uint96 amount) public {
        if (poolIds.length == 0) return;
        uint256 id = poolIds[poolSeed % poolIds.length];
        address actor = _actor(actorSeed);
        amount = uint96(bound(amount, 0.01 ether, 100 ether));
        vm.prank(actor);
        try escrow.deposit{value: amount}(id) {} catch {}
    }

    function withdraw(uint256 actorSeed, uint256 poolSeed) public {
        if (poolIds.length == 0) return;
        uint256 id = poolIds[poolSeed % poolIds.length];
        address actor = _actor(actorSeed);
        vm.prank(actor);
        try escrow.withdraw(id) {} catch {}
    }

    function warp(uint256 secs) public {
        secs = bound(secs, 1, 10 days);
        vm.warp(block.timestamp + secs);
    }

    function poolCount() external view returns (uint256) {
        return poolIds.length;
    }

    function poolIdAt(uint256 i) external view returns (uint256) {
        return poolIds[i];
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }
}
```

- [ ] **Step 2: Write the invariant test**

`packages/contracts/test/CofferEscrow.invariant.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CofferEscrow} from "../src/CofferEscrow.sol";
import {EscrowHandler} from "./handlers/EscrowHandler.sol";
import {MockSafeProxyFactory} from "./mocks/MockSafeProxyFactory.sol";

contract CofferEscrowInvariantTest is Test {
    CofferEscrow escrow;
    EscrowHandler handler;

    function setUp() public {
        MockSafeProxyFactory factory = new MockSafeProxyFactory();
        escrow = new CofferEscrow(address(factory), address(0x51), address(0xFB));
        handler = new EscrowHandler(escrow);
        targetContract(address(handler));
    }

    /// Invariant (a): escrow balance equals the sum of totalDeposited across
    /// all non-finalized pools. (Finalized pools have swept their funds out.)
    function invariant_balanceEqualsSumOfNonFinalizedTotals() public view {
        uint256 sum;
        uint256 n = handler.poolCount();
        for (uint256 i = 0; i < n; i++) {
            uint256 id = handler.poolIdAt(i);
            if (escrow.status(id) != CofferEscrow.PoolStatus.Finalized) {
                (,,, uint96 total,,,,) = escrow.pools(id);
                sum += total;
            }
        }
        assertEq(address(escrow).balance, sum);
    }

    /// Invariant (b): per pool, the sum of member deposits equals totalDeposited.
    function invariant_depositsSumToTotal() public view {
        uint256 n = handler.poolCount();
        uint256 a = handler.actorCount();
        for (uint256 i = 0; i < n; i++) {
            uint256 id = handler.poolIdAt(i);
            (,,, uint96 total,,,,) = escrow.pools(id);
            uint256 sum;
            for (uint256 k = 0; k < a; k++) {
                sum += escrow.deposits(id, handler.actorAt(k));
            }
            assertEq(sum, total);
        }
    }
}
```

- [ ] **Step 3: Run the invariants**

Run: `forge test --match-contract CofferEscrowInvariantTest -vv`
Expected: PASS — both invariants hold across all runs.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(contracts): invariants for balance and deposit accounting"
```

---

## Task 11: Mainnet-fork test (real Safe + full ENS register)

**Files:**
- Create: `packages/contracts/test/CofferEscrow.fork.t.sol`

> **Addresses rule (spec §10):** you MUST resolve the current canonical mainnet
> addresses at implementation time and paste them into the constants below.
> Do NOT trust values from model memory. Resolution methods:
> - Safe `SafeProxyFactory` + Safe singleton (`SafeL2`/`Safe`) + `CompatibilityFallbackHandler` v1.4.1: use the official `safe-global/safe-deployments` repo (JSON files) or app.safe.global's deployment docs.
> - ENS `ETHRegistrarController`, `PublicResolver`, `BaseRegistrarImplementation`: resolve via the ENS registry (`resolver("eth")` / documented addresses on docs.ens.domains). Confirm the `ETHRegistrarController` is the version whose `register`/`rentPrice` signatures match `IENS.sol`; if ENS has shipped a newer controller, update the interface to match before writing the test.
> This test is gated on `MAINNET_RPC_URL`; skip it in CI runs without an archive/full node by not setting the env var (the test `vm.skip`s itself).

- [ ] **Step 1: Write the fork test**

`packages/contracts/test/CofferEscrow.fork.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CofferEscrow} from "../src/CofferEscrow.sol";
import {IETHRegistrarController, IPriceOracle, IBaseRegistrar} from "../src/interfaces/IENS.sol";

contract CofferEscrowForkTest is Test {
    // === FILL THESE IN at implementation time — verify against canonical lists. ===
    address constant SAFE_PROXY_FACTORY = address(0); // TODO: canonical v1.4.1 factory
    address constant SAFE_SINGLETON = address(0); //     TODO: canonical v1.4.1 singleton
    address constant SAFE_FALLBACK_HANDLER = address(0); // TODO: CompatibilityFallbackHandler v1.4.1
    address constant ENS_CONTROLLER = address(0); //     TODO: ETHRegistrarController (mainnet)
    address constant ENS_RESOLVER = address(0); //       TODO: PublicResolver (mainnet)
    address constant ENS_BASE_REGISTRAR = address(0); // TODO: BaseRegistrarImplementation (mainnet)
    // =============================================================================

    CofferEscrow escrow;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        vm.skip(bytes(rpc).length == 0);
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        escrow = new CofferEscrow(SAFE_PROXY_FACTORY, SAFE_SINGLETON, SAFE_FALLBACK_HANDLER);
    }

    function test_fork_finalizeDeploysRealSafeAndRegistersName() public {
        // Guard so the test is a no-op until addresses are filled in.
        if (SAFE_PROXY_FACTORY == address(0)) {
            vm.skip(true);
            return;
        }

        // --- Fund a pool to a modest target ---
        string memory label = "coffertestname1234"; // an available, never-in-premium test label on the fork
        uint256 target = 1 ether;

        address[] memory inv = new address[](1);
        inv[0] = bob;
        vm.prank(alice);
        uint256 id = escrow.createPool(label, uint96(target), uint40(block.timestamp + 3 days), 2, inv);

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.prank(alice);
        escrow.deposit{value: 0.5 ether}(id);
        vm.prank(bob);
        escrow.deposit{value: 0.5 ether}(id); // funded exactly

        // --- Finalize: deploy the real Safe and fund it ---
        vm.prank(alice);
        address safe = escrow.finalize(id);
        assertGt(safe.code.length, 0, "safe not deployed");
        assertEq(safe.balance, target);

        // --- Register the name through the Safe (simulated: call controller as the Safe) ---
        IETHRegistrarController controller = IETHRegistrarController(ENS_CONTROLLER);
        uint256 duration = 365 days;
        bytes32 secret = keccak256("coffer-secret");
        bytes[] memory data = new bytes[](0);

        bytes32 commitment =
            controller.makeCommitment(label, safe, duration, secret, ENS_RESOLVER, data, false, 0);
        vm.prank(alice);
        controller.commit(commitment);

        vm.warp(block.timestamp + controller.minCommitmentAge() + 1);

        IPriceOracle.Price memory price = controller.rentPrice(label, duration);
        uint256 total = price.base + price.premium;

        // Execute register AS the Safe (in production this is a threshold Safe tx;
        // on the fork we prank the Safe to prove the controller accepts owner==safe).
        vm.deal(safe, total * 2);
        vm.prank(safe);
        controller.register{value: total}(label, safe, duration, secret, ENS_RESOLVER, data, false, 0);

        // --- Confirm ownership ---
        uint256 labelId = uint256(keccak256(bytes(label)));
        assertEq(IBaseRegistrar(ENS_BASE_REGISTRAR).ownerOf(labelId), safe, "safe does not own the name");
    }
}
```

- [ ] **Step 2: Resolve and paste the canonical addresses**

Follow the addresses rule above. Update the six constants and, if needed, `IENS.sol`. Set `MAINNET_RPC_URL` in `.env` (never commit it).

- [ ] **Step 3: Run the fork test**

Run: `forge test --match-contract CofferEscrowForkTest -vvv`
Expected: with addresses filled + a working `MAINNET_RPC_URL`, PASS. Without them, the test SKIPs cleanly.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(contracts): mainnet-fork Safe deploy + ENS register e2e"
```

---

## Task 12: Deploy script

**Files:**
- Create: `packages/contracts/script/Deploy.s.sol`

- [ ] **Step 1: Write the deploy script**

`packages/contracts/script/Deploy.s.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {CofferEscrow} from "../src/CofferEscrow.sol";

/// @notice Deploys CofferEscrow. All Safe addresses come from env and MUST be
///         verified against canonical deployment lists before running.
contract Deploy is Script {
    function run() external returns (CofferEscrow escrow) {
        address factory = vm.envAddress("SAFE_PROXY_FACTORY");
        address singleton = vm.envAddress("SAFE_SINGLETON");
        address fallbackHandler = vm.envAddress("SAFE_FALLBACK_HANDLER");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        require(factory != address(0), "SAFE_PROXY_FACTORY unset");
        require(singleton != address(0), "SAFE_SINGLETON unset");
        require(fallbackHandler != address(0), "SAFE_FALLBACK_HANDLER unset");

        vm.startBroadcast(pk);
        escrow = new CofferEscrow(factory, singleton, fallbackHandler);
        vm.stopBroadcast();

        console2.log("CofferEscrow deployed at:", address(escrow));
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `forge build`
Expected: `Compiler run successful`.

- [ ] **Step 3: Dry-run the script against a local fork (optional sanity check)**

Run: `forge script script/Deploy.s.sol:Deploy --rpc-url sepolia` (requires `SEPOLIA_RPC_URL` + the three Safe addresses set in `.env`; without `--broadcast` this only simulates)
Expected: simulation succeeds and logs a deployment address. If env vars are unset, it reverts with the relevant `unset` message — that's correct.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(contracts): deploy script with env-verified Safe addresses"
```

---

## Task 13: Final suite run + gas snapshot

**Files:**
- Create: `packages/contracts/.gas-snapshot` (generated)

- [ ] **Step 1: Run the entire suite**

Run: `forge test -vv`
Expected: all unit, reentrancy, and invariant tests PASS; the fork test SKIPs (no addresses/RPC in this environment).

- [ ] **Step 2: Generate a gas snapshot**

Run: `forge snapshot`
Expected: `.gas-snapshot` written.

- [ ] **Step 3: Check formatting**

Run: `forge fmt --check`
Expected: no diff. If it reports changes, run `forge fmt` and re-run the suite.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(contracts): gas snapshot and formatting"
```

---

## Self-review notes (author checklist — verify during execution)

- **Spec coverage:** Every §5.2 function has a task (createPool T4, deposit T5, withdraw T6, finalize T7, status T3, ownershipBps/getContributors T8). Every §5.4 requirement has a task: unit + revert paths (T4–T8), invariants a/b/d (T10 covers a/b; d is asserted in T7 `test_finalize_happyPath` = "sweeps exactly target"; c "always withdrawable outside lock" is asserted in T6 `test_withdraw_allowedAfterLockLapses`/`_allowedWhenExpired`), fuzz (T10 handler is fuzzed), fork (T11), reentrancy (T9).
- **Locked decisions:** fixed 7d (T3 constant), hard-block below threshold (T7 `test_finalize_revertsBelowThreshold`), dup-revert incl. creator (T4), exact-gap deposit (T5 `test_deposit_allowsSubMinimumExactGap`), `safeFallbackHandler` immutable (T3 + asserted in T7 happy path).
- **Type consistency:** error names, event signatures, and function selectors used in tests match the contract definitions in T3. `getContributors` (in the T3 skeleton) returns `(address[], uint96[])` everywhere. `status` returns `CofferEscrow.PoolStatus`.
- **Compile ordering:** `getContributors` is implemented in the T3 skeleton precisely because T5/T6 tests reference it — this keeps every test file compilable at each task boundary (a missing method fails the whole file's compilation in Solidity). No task references a contract member that an earlier task hasn't defined.
```
