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
}
