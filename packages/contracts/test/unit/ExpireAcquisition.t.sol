// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {CommittedVaultTestBase} from "test/utils/CommittedVaultTestBase.sol";

contract ExpireAcquisitionTest is CommittedVaultTestBase {
    function test_expireAcquisitionIsPermissionlessAtExpiry() public {
        uint256 expiresAt =
            uint256(_readVault(config.vaultId).committedAt) + controller.maxCommitmentAge();
        vm.warp(expiresAt);

        vm.expectEmit(true, false, false, false, address(diamonds));
        emit IENSDiamonds.AcquisitionExpired(config.vaultId);
        vm.prank(accounts.eve.addr);
        diamonds.expireAcquisition(config.vaultId);

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Failed));
        assertEq(_readVault(config.vaultId).escrowed, DEFAULT_FUNDING);
        assertEq(diamonds.totalLiabilities(), DEFAULT_FUNDING);
    }

    function test_expireAcquisitionRevertsBeforeExpiry() public {
        uint256 expiresAt =
            uint256(_readVault(config.vaultId).committedAt) + controller.maxCommitmentAge();

        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.CommitmentNotExpired.selector, expiresAt)
        );
        diamonds.expireAcquisition(config.vaultId);
    }

    function test_expireAcquisitionRevertsForUnknownVault() public {
        vm.expectRevert(IENSDiamonds.VaultNotFound.selector);
        diamonds.expireAcquisition(keccak256("missing"));
    }

    function test_expireAcquisitionRequiresCommittedState() public {
        uint256 expiresAt =
            uint256(_readVault(config.vaultId).committedAt) + controller.maxCommitmentAge();
        vm.warp(expiresAt);
        diamonds.expireAcquisition(config.vaultId);

        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InvalidState.selector, IENSDiamonds.State.Failed)
        );
        diamonds.expireAcquisition(config.vaultId);
    }
}
