// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {FundingVaultTestBase} from "test/utils/FundingVaultTestBase.sol";

contract BeginAcquisitionTest is FundingVaultTestBase {
    function test_beginAcquisitionCreatesNewCommitment() public {
        vm.expectEmit(true, true, true, true, address(diamonds));
        emit IENSDiamonds.AcquisitionCommitted(
            config.vaultId,
            config.ensCommitment,
            config.predictedSafe,
            block.timestamp,
            config.threshold
        );
        _beginAcquisition(config.vaultId, config.creator);

        IENSDiamonds.Vault memory vault = _readVault(config.vaultId);
        assertEq(uint256(vault.state), uint256(IENSDiamonds.State.Committed));
        assertEq(vault.committedAt, block.timestamp);
        assertEq(controller.commitments(config.ensCommitment), block.timestamp);
        assertEq(config.predictedSafe.code.length, 0);
        _assertVaultAccounting(config.vaultId, config.owners);
    }

    function test_beginAcquisitionAdoptsExistingCommitment() public {
        uint256 originalTimestamp = block.timestamp;
        vm.prank(accounts.eve.addr);
        controller.commit(config.ensCommitment);
        vm.warp(originalTimestamp + 30);

        _beginAcquisition(config.vaultId, config.creator);

        assertEq(_readVault(config.vaultId).committedAt, originalTimestamp);
        assertEq(controller.commitments(config.ensCommitment), originalTimestamp);
    }

    function test_beginAcquisitionReplacesExpiredCommitment() public {
        vm.prank(accounts.eve.addr);
        controller.commit(config.ensCommitment);
        vm.warp(block.timestamp + controller.maxCommitmentAge() + 1);
        uint256 recommittedAt = block.timestamp;

        _beginAcquisition(config.vaultId, config.creator);

        assertEq(_readVault(config.vaultId).committedAt, recommittedAt);
        assertEq(controller.commitments(config.ensCommitment), recommittedAt);
    }

    function test_beginAcquisitionRevertsAtExactExpiryBoundary() public {
        vm.prank(accounts.eve.addr);
        controller.commit(config.ensCommitment);
        vm.warp(block.timestamp + controller.maxCommitmentAge());

        vm.expectRevert(IENSDiamonds.CommitmentAtBoundary.selector);
        _beginAcquisition(config.vaultId, config.creator);

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Funding));
    }

    function test_beginAcquisitionRequiresFunding() public {
        _withdraw(config.vaultId, config.creator, DEFAULT_FUNDING, payable(config.creator));

        vm.expectRevert(IENSDiamonds.InvalidAmount.selector);
        _beginAcquisition(config.vaultId, config.creator);
    }

    function test_beginAcquisitionRequiresCreator() public {
        vm.expectRevert(IENSDiamonds.Unauthorized.selector);
        _beginAcquisition(config.vaultId, accounts.bob.addr);
    }

    function test_beginAcquisitionRevertsForUnknownVault() public {
        vm.expectRevert(IENSDiamonds.VaultNotFound.selector);
        _beginAcquisition(keccak256("missing"), accounts.alice.addr);
    }

    function test_beginAcquisitionRequiresFundingState() public {
        _cancel(config.vaultId, config.creator);

        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InvalidState.selector, IENSDiamonds.State.Cancelled)
        );
        _beginAcquisition(config.vaultId, config.creator);
    }

    function test_beginAcquisitionRollsBackWhenControllerReverts() public {
        bytes memory controllerError = abi.encodeWithSignature("Error(string)", "commit failed");
        vm.mockCallRevert(
            address(controller),
            abi.encodeWithSelector(IETHRegistrarController.commit.selector, config.ensCommitment),
            controllerError
        );

        vm.expectRevert(controllerError);
        _beginAcquisition(config.vaultId, config.creator);

        IENSDiamonds.Vault memory vault = _readVault(config.vaultId);
        assertEq(uint256(vault.state), uint256(IENSDiamonds.State.Funding));
        assertEq(vault.committedAt, 0);
    }
}
