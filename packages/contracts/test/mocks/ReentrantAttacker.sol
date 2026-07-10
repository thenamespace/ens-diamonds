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
