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
}
