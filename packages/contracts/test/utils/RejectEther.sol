// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

contract RejectEther {
    receive() external payable {
        revert();
    }
}
