// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface to the canonical Safe singleton (v1.4.1) setup entrypoint.
interface ISafe {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;
}
