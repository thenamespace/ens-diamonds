// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

contract ReentrantRecipient {
    address internal target;
    bytes internal callData;

    bool public attempted;
    bool public succeeded;
    bytes public result;

    function configure(address target_, bytes calldata callData_) external {
        target = target_;
        callData = callData_;
    }

    receive() external payable {
        if (attempted) return;

        attempted = true;
        (succeeded, result) = target.call(callData);
    }
}
