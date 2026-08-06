// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {FundingVaultTestBase} from "test/utils/FundingVaultTestBase.sol";

contract ClaimTerminalTest is FundingVaultTestBase {
    function test_claimReturnsContributionAfterCancellation() public {
        _cancel(config.vaultId, config.creator);
        uint256 recipientBalance = accounts.eve.addr.balance;

        vm.expectEmit(true, true, true, true, address(diamonds));
        emit IENSDiamonds.Claimed(
            config.vaultId, config.creator, accounts.eve.addr, DEFAULT_FUNDING
        );
        _claim(config.vaultId, config.creator, payable(accounts.eve.addr));

        assertEq(accounts.eve.addr.balance, recipientBalance + DEFAULT_FUNDING);
        assertEq(diamonds.balanceOf(config.vaultId, config.creator), 0);
        assertEq(_readVault(config.vaultId).escrowed, 0);
        assertEq(diamonds.totalLiabilities(), 0);
    }

    function test_claimReturnsContributionAfterExplicitExpiry() public {
        _beginAcquisition(config.vaultId, config.creator);
        uint256 expiresAt =
            uint256(_readVault(config.vaultId).committedAt) + controller.maxCommitmentAge();
        vm.warp(expiresAt);
        diamonds.expireAcquisition(config.vaultId);

        _claim(config.vaultId, config.creator, payable(config.creator));

        assertEq(diamonds.balanceOf(config.vaultId, config.creator), 0);
        assertEq(_readVault(config.vaultId).escrowed, 0);
        assertEq(diamonds.totalLiabilities(), 0);
    }

    function test_claimFinalizesExpiredCommitmentAndPaysMember() public {
        _beginAcquisition(config.vaultId, config.creator);
        uint256 expiresAt =
            uint256(_readVault(config.vaultId).committedAt) + controller.maxCommitmentAge();
        vm.warp(expiresAt);

        vm.expectEmit(true, false, false, false, address(diamonds));
        emit IENSDiamonds.AcquisitionExpired(config.vaultId);
        vm.expectEmit(true, true, true, true, address(diamonds));
        emit IENSDiamonds.Claimed(config.vaultId, config.creator, config.creator, DEFAULT_FUNDING);
        _claim(config.vaultId, config.creator, payable(config.creator));

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Failed));
        assertEq(_readVault(config.vaultId).escrowed, 0);
    }

    function test_claimPaysProportionalPurchaseSurplusWithoutLosingRemainder() public {
        _deposit(config.vaultId, accounts.bob.addr, 2 ether);
        _deposit(config.vaultId, accounts.charlie.addr, 1 ether);
        uint256 funding = 6 ether;
        uint256 price = _quote(config);
        uint256 surplus = funding - price;
        uint256 aliceRefund = DEFAULT_FUNDING * surplus / funding;
        uint256 bobRefund = 2 ether * surplus / funding;
        uint256 charlieRefund = surplus - aliceRefund - bobRefund;

        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);
        _purchase(config, accounts.eve.addr);

        assertEq(diamonds.balanceOf(config.vaultId, accounts.alice.addr), aliceRefund);
        assertEq(diamonds.balanceOf(config.vaultId, accounts.bob.addr), bobRefund);
        assertEq(diamonds.balanceOf(config.vaultId, accounts.charlie.addr), charlieRefund);
        assertEq(_sumBalances(config.vaultId, config.owners), surplus);

        _claim(config.vaultId, accounts.alice.addr, payable(accounts.alice.addr));
        _claim(config.vaultId, accounts.bob.addr, payable(accounts.bob.addr));
        _claim(config.vaultId, accounts.charlie.addr, payable(accounts.charlie.addr));

        assertEq(_readVault(config.vaultId).escrowed, 0);
        assertEq(diamonds.totalLiabilities(), 0);
        assertEq(address(diamonds).balance, 0);
    }
}
