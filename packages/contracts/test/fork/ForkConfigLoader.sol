// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {stdJson} from "forge-std/StdJson.sol";
import {Vm} from "forge-std/Vm.sol";
import {ForkConfig} from "test/fork/ForkConfig.sol";

library ForkConfigLoader {
    using stdJson for string;

    uint256 internal constant SCHEMA_VERSION = 1;

    error UnsupportedSchemaVersion(uint256 version);

    function load(Vm vm, string memory relativePath)
        internal
        view
        returns (ForkConfig memory config)
    {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/", relativePath));
        uint256 schemaVersion = json.readUint(".schemaVersion");

        if (schemaVersion != SCHEMA_VERSION) {
            revert UnsupportedSchemaVersion(schemaVersion);
        }

        config.chain.name = json.readString(".chain.name");
        config.chain.rpcAlias = json.readString(".chain.rpcAlias");
        config.chain.chainId = json.readUint(".chain.chainId");
        config.chain.blockNumber = json.readUint(".chain.blockNumber");
        config.chain.blockTimestamp = json.readUint(".chain.blockTimestamp");

        config.contracts.ensRegistry = json.readAddress(".contracts.ensRegistry");
        config.contracts.baseRegistrar = json.readAddress(".contracts.baseRegistrar");
        config.contracts.controller = json.readAddress(".contracts.controller");
        config.contracts.nameWrapper = json.readAddress(".contracts.nameWrapper");
        config.contracts.safeSingleton = json.readAddress(".contracts.safeSingleton");
        config.contracts.safeProxyFactory = json.readAddress(".contracts.safeProxyFactory");
        config.contracts.safeFallbackHandler = json.readAddress(".contracts.safeFallbackHandler");

        config.expectations.safeVersion = json.readString(".expectations.safeVersion");
        config.expectations.minCommitmentAge = json.readUint(".expectations.minCommitmentAge");
        config.expectations.maxCommitmentAge = json.readUint(".expectations.maxCommitmentAge");
        config.expectations.minRegistrationDuration =
            json.readUint(".expectations.minRegistrationDuration");
        config.expectations.safeSingletonCodeHash =
            json.readBytes32(".expectations.safeSingletonCodeHash");
        config.expectations.safeProxyFactoryCodeHash =
            json.readBytes32(".expectations.safeProxyFactoryCodeHash");
        config.expectations.safeFallbackHandlerCodeHash =
            json.readBytes32(".expectations.safeFallbackHandlerCodeHash");

        config.labels.neverRegistered = json.readString(".labels.neverRegistered");
        config.labels.premium = json.readString(".labels.premium");
        config.labels.postPremium = json.readString(".labels.postPremium");
        config.labels.gracePeriod = json.readString(".labels.gracePeriod");
        config.labels.registered = json.readString(".labels.registered");
        config.labels.wrapped = json.readString(".labels.wrapped");
    }
}
