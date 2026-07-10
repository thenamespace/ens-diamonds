// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface to the canonical Safe proxy factory (v1.4.1).
interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address proxy);
}
