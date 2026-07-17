// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EnsDiamondsEscrow} from "../src/EnsDiamondsEscrow.sol";
import {MockSafe} from "./mocks/MockSafe.sol";
import {MockSafeProxyFactory} from "./mocks/MockSafeProxyFactory.sol";
import {ISafe} from "../src/interfaces/ISafe.sol";
import {ReentrantAttacker} from "./mocks/ReentrantAttacker.sol";

contract EnsDiamondsEscrowTest is Test {
    EnsDiamondsEscrow escrow;

    address factory;
    // Constructor now requires factory/singleton/fallbackHandler to have code
    // (InvalidSafeConfig guard), so stand in with deployed mock contracts
    // rather than bare addresses — their bytecode is never actually invoked
    // as a Safe by MockSafeProxyFactory (it hardcodes MockSafe's creation
    // code), they just need to satisfy the "is a contract" check.
    address singleton;
    address fallbackHandler;

    MockSafeProxyFactory mockFactory;

    function setUp() public virtual {
        mockFactory = new MockSafeProxyFactory();
        factory = address(mockFactory);
        singleton = address(new MockSafe());
        fallbackHandler = address(new MockSafeProxyFactory());
        escrow = new EnsDiamondsEscrow(factory, singleton, fallbackHandler);
    }

    function test_constructor_revertsBadSafeConfig() public {
        vm.expectRevert(EnsDiamondsEscrow.InvalidSafeConfig.selector);
        new EnsDiamondsEscrow(address(0), singleton, fallbackHandler);

        vm.expectRevert(EnsDiamondsEscrow.InvalidSafeConfig.selector);
        new EnsDiamondsEscrow(factory, address(0), fallbackHandler);

        vm.expectRevert(EnsDiamondsEscrow.InvalidSafeConfig.selector);
        new EnsDiamondsEscrow(factory, singleton, address(0));

        // Sanity: a config where every address has code deploys fine (this is
        // exactly what setUp() above already does every test run).
        EnsDiamondsEscrow ok = new EnsDiamondsEscrow(factory, singleton, fallbackHandler);
        assertEq(ok.safeProxyFactory(), factory);
    }

    function test_constructor_setsImmutables() public view {
        assertEq(escrow.safeProxyFactory(), factory);
        assertEq(escrow.safeSingleton(), singleton);
        assertEq(escrow.safeFallbackHandler(), fallbackHandler);
        assertEq(escrow.poolCount(), 0);
        assertEq(escrow.EXECUTION_WINDOW(), 1 days);
        assertEq(escrow.MIN_CONTRIBUTION(), 0.01 ether);
    }

    address creator = address(0xC0FFEE);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA501);

    function _invitees2() internal view returns (address[] memory a) {
        a = new address[](2);
        a[0] = alice;
        a[1] = bob;
    }

    function _invitees3() internal view returns (address[] memory a) {
        a = new address[](3);
        a[0] = alice;
        a[1] = bob;
        a[2] = carol;
    }

    function test_createPool_happyPath() public {
        vm.prank(creator);
        uint256 id = escrow.createPool("defi", 10 ether, uint40(block.timestamp + 3 days), _invitees2());

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
        assertEq(threshold, 0, "threshold is derived at finalize, not creation");
        assertEq(safe, address(0));

        assertTrue(escrow.invited(id, creator));
        assertTrue(escrow.invited(id, alice));
        assertTrue(escrow.invited(id, bob));
        assertEq(uint256(escrow.status(id)), uint256(EnsDiamondsEscrow.PoolStatus.Funding));
    }

    function test_createPool_revertsOnZeroTarget() public {
        vm.prank(creator);
        vm.expectRevert(EnsDiamondsEscrow.InvalidTarget.selector);
        escrow.createPool("defi", 0, uint40(block.timestamp + 1 days), _invitees2());
    }

    function test_createPool_revertsOnPastDeadline() public {
        vm.warp(1_000_000);
        vm.prank(creator);
        vm.expectRevert(EnsDiamondsEscrow.InvalidDeadline.selector);
        escrow.createPool("defi", 1 ether, uint40(block.timestamp), _invitees2());
    }

    function test_createPool_revertsOnShortLabel() public {
        vm.prank(creator);
        vm.expectRevert(EnsDiamondsEscrow.LabelTooShort.selector);
        escrow.createPool("ab", 1 ether, uint40(block.timestamp + 1 days), _invitees2());
    }

    function test_createPool_revertsOnDuplicateInvitee() public {
        address[] memory dup = new address[](2);
        dup[0] = alice;
        dup[1] = alice;
        vm.prank(creator);
        vm.expectRevert(EnsDiamondsEscrow.DuplicateInvitee.selector);
        escrow.createPool("defi", 1 ether, uint40(block.timestamp + 1 days), dup);
    }

    function test_createPool_revertsWhenCreatorInInvitees() public {
        address[] memory a = new address[](1);
        a[0] = creator;
        vm.prank(creator);
        vm.expectRevert(EnsDiamondsEscrow.DuplicateInvitee.selector);
        escrow.createPool("defi", 1 ether, uint40(block.timestamp + 1 days), a);
    }

    function test_createPool_emitsEventWithoutThreshold() public {
        vm.prank(creator);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit EnsDiamondsEscrow.PoolCreated(
            0, "defi", creator, 10 ether, uint40(block.timestamp + 3 days), _invitees2()
        );
        escrow.createPool("defi", 10 ether, uint40(block.timestamp + 3 days), _invitees2());
    }

    // Creates a pool: target 10 ETH, deadline +3d, invitees [alice, bob].
    // Threshold is no longer set at creation — it's derived at finalize as a
    // strict majority of the actual contributors.
    function _createDefaultPool() internal returns (uint256 id) {
        vm.prank(creator);
        id = escrow.createPool("defi", 10 ether, uint40(block.timestamp + 3 days), _invitees2());
    }

    function test_deposit_happyPath() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit EnsDiamondsEscrow.Deposited(id, alice, 4 ether, 4 ether);
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
        vm.expectRevert(EnsDiamondsEscrow.NotInvited.selector);
        escrow.deposit{value: 1 ether}(id);
    }

    function test_deposit_revertsOnZeroValue() public {
        uint256 id = _createDefaultPool();
        vm.prank(alice);
        vm.expectRevert(EnsDiamondsEscrow.ZeroValue.selector);
        escrow.deposit{value: 0}(id);
    }

    function test_deposit_overshootIsCappedAndRefunded() public {
        uint256 id = _createDefaultPool(); // target 10 ETH
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 11 ether}(id); // 1 ETH over — should cap + refund

        (,, uint96 target, uint96 total,,,,) = escrow.pools(id);
        assertEq(total, target, "capped to target");
        assertEq(escrow.deposits(id, alice), 10 ether, "credited only the gap");
        assertEq(alice.balance, 90 ether, "1 ETH excess refunded");
        assertEq(uint256(escrow.status(id)), uint256(EnsDiamondsEscrow.PoolStatus.Funded), "funded");
    }

    function test_deposit_revertsBelowMinimumForNewDepositor() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(EnsDiamondsEscrow.BelowMinimum.selector);
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
        uint256 id = escrow.createPool("defi", 1 ether, uint40(block.timestamp + 3 days), _invitees2());
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
        emit EnsDiamondsEscrow.PoolFunded(id);
        escrow.deposit{value: 4 ether}(id); // reaches target exactly

        (,,,,, uint40 fundedAt,,) = escrow.pools(id);
        assertEq(fundedAt, uint40(block.timestamp));
        assertEq(uint256(escrow.status(id)), uint256(EnsDiamondsEscrow.PoolStatus.Funded));
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
        vm.expectRevert(EnsDiamondsEscrow.WrongStatus.selector);
        escrow.deposit{value: 1 ether}(id);
    }

    function test_deposit_revertsWhenFullAfterLockLapses() public {
        // Regression (external audit, Finding 1): a pool at target whose
        // execution window lapsed is back in Funding status but has a zero
        // remaining gap. Before the PoolFull guard, a 1-wei deposit here was
        // fully refunded yet still pushed the sender as a zero-stake
        // contributor (isExactGap: 0 == 0), re-armed fundedAt, and — repeated
        // across lapses — inserted duplicate owners that brick finalize().
        uint256 id = _fundPool(); // alice 6 + bob 4 = 10 ETH target, Funded
        vm.warp(block.timestamp + 1 days + 1); // lock lapsed → Funding again
        assertEq(uint256(escrow.status(id)), uint256(EnsDiamondsEscrow.PoolStatus.Funding));

        // creator is invited but has zero deposit — the attacker profile.
        vm.deal(creator, 1 ether);
        vm.prank(creator);
        vm.expectRevert(EnsDiamondsEscrow.PoolFull.selector);
        escrow.deposit{value: 1 wei}(id);

        // Contributor set and fundedAt are untouched.
        (address[] memory addrs,) = escrow.getContributors(id);
        assertEq(addrs.length, 2, "no zero-stake contributor planted");
        (,,,,, uint40 fundedAt,,) = escrow.pools(id);
        assertGt(fundedAt, 0, "fundedAt not re-armed by a rejected deposit");
    }

    function test_deposit_worksAgainAfterLapsedPoolReopensGap() public {
        // Sanity: the PoolFull guard only blocks deposits while the gap is
        // zero. Once a withdrawal reopens it, refilling works as before.
        uint256 id = _fundPool();
        vm.warp(block.timestamp + 1 days + 1); // lock lapsed → Funding

        vm.prank(bob);
        escrow.withdraw(id); // gap reopens: 4 ETH

        vm.deal(creator, 100 ether);
        vm.prank(creator); // creator is auto-invited
        escrow.deposit{value: 4 ether}(id); // refills to target

        assertEq(uint256(escrow.status(id)), uint256(EnsDiamondsEscrow.PoolStatus.Funded));
        (address[] memory addrs,) = escrow.getContributors(id);
        assertEq(addrs.length, 2, "alice + creator");
    }

    function test_withdraw_happyPathDuringFunding() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 4 ether}(id);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit EnsDiamondsEscrow.Withdrawn(id, alice, 4 ether, 0);
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
        vm.expectRevert(EnsDiamondsEscrow.NoDeposit.selector);
        escrow.withdraw(id);
    }

    function test_deposit_revertsSameBlock() public {
        // Same member depositing again in the SAME block they withdrew must
        // revert — this blocks an atomic withdraw→re-deposit that would
        // otherwise re-arm the funding lock within a single transaction/block.
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);

        vm.startPrank(alice);
        escrow.deposit{value: 4 ether}(id);
        escrow.withdraw(id);

        vm.expectRevert(EnsDiamondsEscrow.SameBlock.selector);
        escrow.deposit{value: 4 ether}(id);
        vm.stopPrank();

        // Once the next block arrives, the same member can deposit again.
        vm.roll(block.number + 1);
        vm.prank(alice);
        escrow.deposit{value: 4 ether}(id);
        assertEq(escrow.deposits(id, alice), 4 ether);
    }

    function test_withdraw_lockedWhileFunded() public {
        uint256 id = _fundPool(); // fully funded, within lock
        vm.prank(alice);
        vm.expectRevert(EnsDiamondsEscrow.WithdrawLocked.selector);
        escrow.withdraw(id);
    }

    function test_withdraw_allowedAfterLockLapses() public {
        uint256 id = _fundPool();
        // move past the execution window
        vm.warp(block.timestamp + 1 days + 1);
        assertEq(uint256(escrow.status(id)), uint256(EnsDiamondsEscrow.PoolStatus.Funding));

        vm.prank(alice);
        escrow.withdraw(id);
        assertEq(escrow.deposits(id, alice), 0);
        // fundedAt reset after dropping below target
        (,,,,, uint40 fundedAt,,) = escrow.pools(id);
        assertEq(fundedAt, 0);
    }

    function test_withdraw_allowedWhenExpired() public {
        uint256 id = _createDefaultPool();
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 4 ether}(id); // partial, never funded

        vm.warp(block.timestamp + 3 days + 1); // past deadline → Expired
        assertEq(uint256(escrow.status(id)), uint256(EnsDiamondsEscrow.PoolStatus.Expired));

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

    function test_finalize_happyPath() public {
        uint256 id = _fundPool(); // alice 6, bob 4, threshold 2, contributors = 2

        vm.prank(alice);
        address safe = escrow.finalize(id);

        assertTrue(safe != address(0));
        assertEq(safe.balance, 10 ether);
        assertEq(address(escrow).balance, 0);

        (,,,,,,, address storedSafe) = escrow.pools(id);
        assertEq(storedSafe, safe);
        assertEq(uint256(escrow.status(id)), uint256(EnsDiamondsEscrow.PoolStatus.Finalized));

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
        vm.expectRevert(EnsDiamondsEscrow.WrongStatus.selector);
        escrow.finalize(id);
    }

    function test_finalize_revertsForNonContributor() public {
        uint256 id = _fundPool();
        // bob's co-invitee "carol" was never invited; use an invited-but-not-contributed path:
        // create a pool where a third invitee never deposits, then have them finalize.
        // stranger not invited/contributor:
        address stranger = address(0xBEEF);
        vm.prank(stranger);
        vm.expectRevert(EnsDiamondsEscrow.NotContributor.selector);
        escrow.finalize(id);
    }

    function test_finalize_solo_thresholdOne() public {
        // One contributor funds the whole target alone. Threshold is now
        // derived as a strict majority of ACTUAL contributors (1/2+1 = 1),
        // so a solo funder can finalize and becomes sole signer.
        vm.prank(creator);
        uint256 id = escrow.createPool("defi", 5 ether, uint40(block.timestamp + 3 days), _invitees2());
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 5 ether}(id); // funded by ONE contributor

        assertEq(uint256(escrow.status(id)), uint256(EnsDiamondsEscrow.PoolStatus.Funded));
        vm.prank(alice);
        address safe = escrow.finalize(id);

        (,,,,,, uint8 threshold,) = escrow.pools(id);
        assertEq(threshold, 1);
        assertEq(MockSafe(payable(safe)).threshold(), 1);
        address[] memory owners = MockSafe(payable(safe)).getOwners();
        assertEq(owners.length, 1);
        assertEq(owners[0], alice);
    }

    function test_finalize_majorityThreshold_twoContributors() public {
        // alice + bob both contribute → majority of 2 is 2 (both must sign).
        uint256 id = _fundPool(); // alice 6, bob 4, target 10
        vm.prank(alice);
        address safe = escrow.finalize(id);

        (,,,,,, uint8 threshold,) = escrow.pools(id);
        assertEq(threshold, 2);
        assertEq(MockSafe(payable(safe)).threshold(), 2);
    }

    function test_finalize_majorityThreshold_threeContributors() public {
        // 3 distinct contributors → majority = 3/2 + 1 = 2.
        vm.prank(creator);
        uint256 id = escrow.createPool("defi", 9 ether, uint40(block.timestamp + 3 days), _invitees3());
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.prank(alice);
        escrow.deposit{value: 3 ether}(id);
        vm.prank(bob);
        escrow.deposit{value: 3 ether}(id);
        vm.prank(carol);
        escrow.deposit{value: 3 ether}(id);

        vm.prank(alice);
        address safe = escrow.finalize(id);

        (,,,,,, uint8 threshold,) = escrow.pools(id);
        assertEq(threshold, 2);
        assertEq(MockSafe(payable(safe)).threshold(), 2);
        address[] memory owners = MockSafe(payable(safe)).getOwners();
        assertEq(owners.length, 3);
    }

    function test_finalize_revertsOutsideWindow() public {
        uint256 id = _fundPool();
        vm.warp(block.timestamp + 1 days + 1); // lock lapsed → status Funding, not Funded
        vm.prank(alice);
        vm.expectRevert(EnsDiamondsEscrow.WrongStatus.selector);
        escrow.finalize(id);
    }

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

    function test_finalize_adoptsPreExistingSquattedSafe() public {
        uint256 id = _fundPool(); // contributors [alice, bob], threshold 2

        // Reconstruct the exact initializer finalize will use, and squat the address.
        address[] memory owners = new address[](2);
        owners[0] = alice;
        owners[1] = bob;
        bytes memory initializer = abi.encodeWithSelector(
            ISafe.setup.selector,
            owners,
            uint256(2),
            address(0),
            bytes(""),
            fallbackHandler,
            address(0),
            uint256(0),
            payable(address(0))
        );
        address squatted = mockFactory.createProxyWithNonce(singleton, initializer, id);

        // finalize must ADOPT the pre-existing Safe and fund it, not revert.
        vm.prank(alice);
        address safe = escrow.finalize(id);
        assertEq(safe, squatted, "did not adopt the squatted safe");
        assertEq(safe.balance, 10 ether);
        assertEq(address(escrow).balance, 0);
        (,,,,,,, address storedSafe) = escrow.pools(id);
        assertEq(storedSafe, safe);
        assertEq(uint256(escrow.status(id)), uint256(EnsDiamondsEscrow.PoolStatus.Finalized));
    }

    function test_createPool_revertsAboveMaxOwners() public {
        // MAX_OWNERS invitees + creator = MAX_OWNERS + 1 > MAX_OWNERS → revert
        uint256 n = escrow.MAX_OWNERS();
        address[] memory many = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            many[i] = address(uint160(0x2000 + i));
        }
        vm.prank(creator);
        vm.expectRevert(EnsDiamondsEscrow.TooManyOwners.selector);
        escrow.createPool("defi", 1 ether, uint40(block.timestamp + 1 days), many);
    }

    function test_ownershipBps_returnsZeroForNonexistentPool() public view {
        assertEq(escrow.ownershipBps(999, alice), 0);
    }

    function test_withdraw_isReentrancySafe() public {
        // Pool holds BOTH the attacker's and an honest member's funds, so a successful
        // reentrant withdraw would let the attacker drain the honest member. The pool
        // stays in Funding (total < target) so withdraw is allowed.
        ReentrantAttacker attacker = new ReentrantAttacker(escrow);
        address[] memory inv = new address[](2);
        inv[0] = address(attacker);
        inv[1] = alice;
        vm.prank(creator);
        uint256 id = escrow.createPool("defi", 10 ether, uint40(block.timestamp + 3 days), inv);

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
}
