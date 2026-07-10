// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockSafe} from "./MockSafe.sol";

/// @notice Deploys a MockSafe and forwards the initializer, mirroring the real
///         SafeProxyFactory.createProxyWithNonce shape used by CofferEscrow.
contract MockSafeProxyFactory {
    event ProxyCreation(address proxy);

    function createProxyWithNonce(address, /*singleton*/ bytes memory initializer, uint256 /*saltNonce*/ )
        external
        returns (address proxy)
    {
        MockSafe s = new MockSafe();
        (bool ok,) = address(s).call(initializer);
        require(ok, "setup failed");
        proxy = address(s);
        emit ProxyCreation(proxy);
    }
}
