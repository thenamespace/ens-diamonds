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
