// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockSafe} from "./MockSafe.sol";

/// @notice Mirrors SafeProxyFactory.createProxyWithNonce's CREATE2 derivation so
///         CofferEscrow._computeSafeAddress predicts the same address it deploys.
contract MockSafeProxyFactory {
    event ProxyCreation(address proxy);

    function proxyCreationCode() public pure returns (bytes memory) {
        return type(MockSafe).creationCode;
    }

    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address proxy)
    {
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
        bytes memory deploymentData = abi.encodePacked(type(MockSafe).creationCode, uint256(uint160(singleton)));
        assembly {
            proxy := create2(0, add(deploymentData, 0x20), mload(deploymentData), salt)
        }
        require(proxy != address(0), "create2 failed");
        (bool ok,) = proxy.call(initializer);
        require(ok, "setup failed");
        emit ProxyCreation(proxy);
    }
}
