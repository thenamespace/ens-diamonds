// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {VaultActions} from "test/utils/VaultActions.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

contract CreateVaultTest is VaultActions {
    function test_createVaultStoresConfigurationWithoutDeposit() public {
        VaultConfig memory config = _defaultVault();

        vm.expectEmit(true, true, false, true, address(diamonds));
        emit IENSDiamonds.VaultCreated(
            config.vaultId,
            config.creator,
            config.maxSpend,
            config.registrationDuration,
            config.owners,
            config.targetIntent,
            config.ensCommitment,
            DEFAULT_VAULT_URI,
            0
        );
        bytes32 createdId = _createVault(config, 0);

        IENSDiamonds.Vault memory vault = _readVault(createdId);
        assertEq(createdId, config.vaultId);
        assertEq(vault.creator, config.creator);
        assertEq(vault.escrowed, 0);
        assertEq(vault.maxSpend, config.maxSpend);
        assertEq(vault.committedAt, 0);
        assertEq(vault.registrationDuration, config.registrationDuration);
        assertEq(uint256(vault.state), uint256(IENSDiamonds.State.Funding));
        assertEq(vault.targetIntent, config.targetIntent);
        assertEq(vault.ensCommitment, config.ensCommitment);
        assertEq(diamonds.getOwners(createdId), config.owners);
        assertEq(diamonds.vaultURI(createdId), DEFAULT_VAULT_URI);
        assertEq(diamonds.totalLiabilities(), 0);
    }

    function test_createVaultCreditsInitialDeposit() public {
        VaultConfig memory config = _defaultVault();
        uint256 deposit = 2 ether;

        _createVault(config, deposit);

        assertEq(diamonds.balanceOf(config.vaultId, config.creator), deposit);
        assertEq(_readVault(config.vaultId).escrowed, deposit);
        assertEq(diamonds.totalLiabilities(), deposit);
        assertEq(address(diamonds).balance, deposit);
        _assertVaultAccounting(config.vaultId, config.owners);
    }

    function test_createVaultRevertsForInvalidConfiguration() public {
        VaultConfig memory config = _defaultVault();

        config.vaultSalt = bytes32(0);
        vm.expectRevert(IENSDiamonds.InvalidConfiguration.selector);
        _createVault(config, 0);

        config = _defaultVault();
        config.maxSpend = 0;
        vm.expectRevert(IENSDiamonds.InvalidConfiguration.selector);
        _createVault(config, 0);

        config = _defaultVault();
        config.registrationDuration = uint32(controller.MIN_REGISTRATION_DURATION() - 1);
        vm.expectRevert(IENSDiamonds.InvalidConfiguration.selector);
        _createVault(config, 0);

        config = _defaultVault();
        config.targetIntent = bytes32(0);
        vm.expectRevert(IENSDiamonds.InvalidConfiguration.selector);
        _createVault(config, 0);

        config = _defaultVault();
        config.ensCommitment = bytes32(0);
        vm.expectRevert(IENSDiamonds.InvalidConfiguration.selector);
        _createVault(config, 0);

        vm.prank(config.creator);
        vm.expectRevert(IENSDiamonds.InvalidConfiguration.selector);
        diamonds.createVault(
            config.vaultSalt,
            config.maxSpend,
            config.registrationDuration,
            config.owners,
            config.targetIntent,
            keccak256("commitment"),
            ""
        );
    }

    function test_createVaultRevertsWhenDepositExceedsMaximum() public {
        VaultConfig memory config = _defaultVault();

        vm.expectRevert(IENSDiamonds.FundingLimitExceeded.selector);
        _createVault(config, uint256(config.maxSpend) + 1);
    }

    function test_createVaultRevertsForInvalidOwners() public {
        VaultConfig memory config = _defaultVault();

        config.owners[0] = accounts.bob.addr;
        vm.expectRevert(IENSDiamonds.InvalidOwners.selector);
        _createVault(config, 0);

        config = _defaultVault();
        config.owners[2] = config.owners[1];
        vm.expectRevert(IENSDiamonds.InvalidOwners.selector);
        _createVault(config, 0);
    }

    function test_createVaultRevertsWhenVaultAlreadyExists() public {
        VaultConfig memory config = _defaultVault();
        _createVault(config, 0);

        vm.expectRevert(IENSDiamonds.VaultAlreadyExists.selector);
        _createVault(config, 0);
    }

    function test_getOwnersRevertsForUnknownVault() public {
        vm.expectRevert(IENSDiamonds.VaultNotFound.selector);
        diamonds.getOwners(keccak256("missing"));
    }
}
