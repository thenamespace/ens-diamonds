// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";
import {ENSDiamondsTestBase} from "test/utils/ENSDiamondsTestBase.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

abstract contract VaultBuilder is ENSDiamondsTestBase {
    uint96 internal constant DEFAULT_MAX_SPEND = 10 ether;
    uint32 internal constant DEFAULT_REGISTRATION_DURATION = 365 days;
    bytes32 internal constant DEFAULT_VAULT_SALT = keccak256("DEFAULT_VAULT_SALT");
    bytes32 internal constant DEFAULT_TARGET_SALT = keccak256("DEFAULT_TARGET_SALT");
    bytes32 internal constant DEFAULT_ENS_SECRET = keccak256("DEFAULT_ENS_SECRET");
    string internal constant DEFAULT_LABEL = "ens-diamonds";

    function _defaultVault() internal view returns (VaultConfig memory config) {
        config = _buildVault(
            accounts.alice.addr,
            _owners(accounts.alice.addr, accounts.bob.addr, accounts.charlie.addr),
            DEFAULT_LABEL,
            DEFAULT_VAULT_SALT,
            DEFAULT_TARGET_SALT,
            DEFAULT_ENS_SECRET,
            DEFAULT_MAX_SPEND,
            DEFAULT_REGISTRATION_DURATION
        );
    }

    function _buildVault(
        address creator,
        address[] memory owners,
        string memory label,
        bytes32 vaultSalt,
        bytes32 targetSalt,
        bytes32 ensSecret,
        uint96 maxSpend,
        uint32 registrationDuration
    ) internal view returns (VaultConfig memory config) {
        config.creator = creator;
        config.owners = owners;
        config.label = label;
        config.vaultSalt = vaultSalt;
        config.targetSalt = targetSalt;
        config.ensSecret = ensSecret;
        config.maxSpend = maxSpend;
        config.registrationDuration = registrationDuration;

        (config.vaultId, config.predictedSafe, config.threshold) =
            diamonds.predictSafe(creator, vaultSalt, owners);
        config.targetIntent = _targetIntent(config);
        config.ensCommitment = controller.makeCommitment(_registration(config));
    }

    function _targetIntent(VaultConfig memory config) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                diamonds.TARGET_INTENT_TYPEHASH(),
                block.chainid,
                address(diamonds),
                config.vaultId,
                config.creator,
                keccak256(bytes(config.label)),
                config.registrationDuration,
                config.targetSalt
            )
        );
    }

    function _registration(VaultConfig memory config)
        internal
        pure
        returns (IETHRegistrarController.Registration memory registration)
    {
        registration = IETHRegistrarController.Registration({
            label: config.label,
            owner: config.predictedSafe,
            duration: config.registrationDuration,
            secret: config.ensSecret,
            resolver: address(0),
            data: new bytes[](0),
            reverseRecord: 0,
            referrer: bytes32(0)
        });
    }

    function _owners(address owner0, address owner1)
        internal
        pure
        returns (address[] memory owners)
    {
        owners = new address[](2);
        owners[0] = owner0;
        owners[1] = owner1;
    }

    function _owners(address owner0, address owner1, address owner2)
        internal
        pure
        returns (address[] memory owners)
    {
        owners = new address[](3);
        owners[0] = owner0;
        owners[1] = owner1;
        owners[2] = owner2;
    }
}
