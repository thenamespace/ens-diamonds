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
        try escrow.createPool("pool", target, dl, inv) returns (uint256 id) {
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
