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
