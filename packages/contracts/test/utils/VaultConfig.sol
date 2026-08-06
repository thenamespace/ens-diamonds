// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

struct VaultConfig {
    address creator;
    address[] owners;
    string label;
    bytes32 vaultSalt;
    bytes32 targetSalt;
    bytes32 ensSecret;
    uint96 maxSpend;
    uint32 registrationDuration;
    bytes32 vaultId;
    address predictedSafe;
    uint256 threshold;
    bytes32 targetIntent;
    bytes32 ensCommitment;
}
