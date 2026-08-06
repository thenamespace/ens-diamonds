// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

struct ForkChainConfig {
    string name;
    string rpcAlias;
    uint256 chainId;
    uint256 blockNumber;
    uint256 blockTimestamp;
}

struct ForkContractConfig {
    address ensRegistry;
    address baseRegistrar;
    address controller;
    address nameWrapper;
    address safeSingleton;
    address safeProxyFactory;
    address safeFallbackHandler;
}

struct ForkExpectationConfig {
    string safeVersion;
    uint256 minCommitmentAge;
    uint256 maxCommitmentAge;
    uint256 minRegistrationDuration;
    bytes32 safeSingletonCodeHash;
    bytes32 safeProxyFactoryCodeHash;
    bytes32 safeFallbackHandlerCodeHash;
}

struct ForkLabelConfig {
    string neverRegistered;
    string premium;
    string postPremium;
    string gracePeriod;
    string registered;
    string wrapped;
}

struct ForkConfig {
    ForkChainConfig chain;
    ForkContractConfig contracts;
    ForkExpectationConfig expectations;
    ForkLabelConfig labels;
}
