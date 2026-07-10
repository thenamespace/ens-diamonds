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
