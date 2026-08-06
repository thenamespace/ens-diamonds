// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {IENSDiamondsRegistrarController} from "src/interfaces/IENSDiamondsRegistrarController.sol";
import {CommittedVaultTestBase} from "test/utils/CommittedVaultTestBase.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

contract PurchaseValidationTest is CommittedVaultTestBase {
    function test_purchaseRevertsBeforeMinimumAge() public {
        uint256 validAt =
            uint256(_readVault(config.vaultId).committedAt) + controller.minCommitmentAge();

        vm.expectRevert(abi.encodeWithSelector(IENSDiamonds.CommitmentTooYoung.selector, validAt));
        _purchase(config, accounts.eve.addr);
    }

    function test_purchaseRevertsAtCommitmentExpiry() public {
        uint256 expiresAt =
            uint256(_readVault(config.vaultId).committedAt) + controller.maxCommitmentAge();
        vm.warp(expiresAt);

        vm.expectRevert(abi.encodeWithSelector(IENSDiamonds.CommitmentExpired.selector, expiresAt));
        _purchase(config, accounts.eve.addr);
    }

    function test_purchaseRevertsForWrongLabel() public {
        _matureCommitment(config.vaultId);

        vm.expectRevert(IENSDiamonds.TargetMismatch.selector);
        vm.prank(accounts.eve.addr);
        diamonds.purchase(config.vaultId, "wrong-label", config.targetSalt, config.ensSecret);
    }

    function test_purchaseRevertsForWrongTargetSalt() public {
        _matureCommitment(config.vaultId);

        vm.expectRevert(IENSDiamonds.TargetMismatch.selector);
        vm.prank(accounts.eve.addr);
        diamonds.purchase(config.vaultId, config.label, keccak256("wrong salt"), config.ensSecret);
    }

    function test_purchaseRevertsForWrongEnsSecret() public {
        _matureCommitment(config.vaultId);

        vm.expectRevert(IENSDiamonds.CommitmentMismatch.selector);
        vm.prank(accounts.eve.addr);
        diamonds.purchase(
            config.vaultId, config.label, config.targetSalt, keccak256("wrong secret")
        );
    }

    function test_purchaseRevertsWhenCommitmentChanges() public {
        _matureCommitment(config.vaultId);
        vm.mockCall(
            address(controller),
            abi.encodeWithSelector(
                IENSDiamondsRegistrarController.commitments.selector, config.ensCommitment
            ),
            abi.encode(uint256(0))
        );

        vm.expectRevert(IENSDiamonds.CommitmentChanged.selector);
        _purchase(config, accounts.eve.addr);
    }

    function test_purchaseRevertsForInsufficientFunding() public {
        _matureCommitment(config.vaultId);
        usdOracle.set(1);
        uint256 price = _quote(config);

        vm.expectRevert(
            abi.encodeWithSelector(
                IENSDiamonds.InsufficientFunding.selector, price, DEFAULT_FUNDING
            )
        );
        _purchase(config, accounts.eve.addr);
    }

    function test_purchaseRevertsForUnknownVault() public {
        vm.expectRevert(IENSDiamonds.VaultNotFound.selector);
        vm.prank(accounts.eve.addr);
        diamonds.purchase(keccak256("missing"), config.label, config.targetSalt, config.ensSecret);
    }

    function test_purchaseRequiresCommittedState() public {
        VaultConfig memory fundingConfig = _buildVault(
            accounts.bob.addr,
            _owners(accounts.bob.addr, accounts.charlie.addr),
            "funding-vault",
            keccak256("FUNDING_VAULT"),
            keccak256("FUNDING_TARGET"),
            keccak256("FUNDING_SECRET"),
            DEFAULT_MAX_SPEND,
            DEFAULT_REGISTRATION_DURATION
        );
        _createVault(fundingConfig, 1 ether);

        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InvalidState.selector, IENSDiamonds.State.Funding)
        );
        _purchase(fundingConfig, accounts.eve.addr);

        _matureCommitment(config.vaultId);
        _purchase(config, accounts.eve.addr);

        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InvalidState.selector, IENSDiamonds.State.Acquired)
        );
        _purchase(config, accounts.eve.addr);
    }
}
