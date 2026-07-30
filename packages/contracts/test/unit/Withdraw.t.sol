// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ReentrancyGuardTransient} from "solady/utils/ReentrancyGuardTransient.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {FundingVaultTestBase} from "test/utils/FundingVaultTestBase.sol";
import {ReentrantRecipient} from "test/utils/ReentrantRecipient.sol";
import {RejectEther} from "test/utils/RejectEther.sol";

contract WithdrawTest is FundingVaultTestBase {
    function test_withdrawTransfersAndUpdatesAccounting() public {
        uint256 amount = 1 ether;
        uint256 recipientBalance = accounts.eve.addr.balance;

        vm.expectEmit(true, true, true, true, address(diamonds));
        emit IENSDiamonds.Withdrawn(config.vaultId, accounts.alice.addr, accounts.eve.addr, amount);
        _withdraw(config.vaultId, accounts.alice.addr, amount, payable(accounts.eve.addr));

        assertEq(accounts.eve.addr.balance, recipientBalance + amount);
        assertEq(diamonds.balanceOf(config.vaultId, accounts.alice.addr), DEFAULT_FUNDING - amount);
        assertEq(_readVault(config.vaultId).escrowed, DEFAULT_FUNDING - amount);
        assertEq(diamonds.totalLiabilities(), DEFAULT_FUNDING - amount);
        _assertVaultAccounting(config.vaultId, config.owners);
    }

    function test_withdrawEntireBalance() public {
        _withdraw(
            config.vaultId, accounts.alice.addr, DEFAULT_FUNDING, payable(accounts.alice.addr)
        );

        assertEq(diamonds.balanceOf(config.vaultId, accounts.alice.addr), 0);
        assertEq(_readVault(config.vaultId).escrowed, 0);
        assertEq(diamonds.totalLiabilities(), 0);
        assertEq(address(diamonds).balance, 0);
    }

    function test_withdrawRevertsForInvalidArguments() public {
        vm.expectRevert(IENSDiamonds.InvalidAmount.selector);
        _withdraw(config.vaultId, accounts.alice.addr, 0, payable(accounts.alice.addr));

        vm.expectRevert(IENSDiamonds.InvalidAddress.selector);
        _withdraw(config.vaultId, accounts.alice.addr, 1, payable(address(0)));
    }

    function test_withdrawRevertsForInsufficientBalance() public {
        vm.expectRevert(IENSDiamonds.InsufficientBalance.selector);
        _withdraw(
            config.vaultId, accounts.alice.addr, DEFAULT_FUNDING + 1, payable(accounts.alice.addr)
        );

        vm.expectRevert(IENSDiamonds.InsufficientBalance.selector);
        _withdraw(config.vaultId, accounts.bob.addr, 1, payable(accounts.bob.addr));
    }

    function test_withdrawRevertsForUnknownVault() public {
        vm.expectRevert(IENSDiamonds.VaultNotFound.selector);
        _withdraw(keccak256("missing"), accounts.alice.addr, 1, payable(accounts.alice.addr));
    }

    function test_withdrawRevertsOutsideFundingState() public {
        _cancel(config.vaultId, config.creator);

        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InvalidState.selector, IENSDiamonds.State.Cancelled)
        );
        _withdraw(config.vaultId, accounts.alice.addr, 1, payable(accounts.alice.addr));
    }

    function test_withdrawRollsBackWhenRecipientRejectsEther() public {
        RejectEther recipient = new RejectEther();

        vm.expectRevert(IENSDiamonds.ETHTransferFailed.selector);
        _withdraw(config.vaultId, accounts.alice.addr, 1 ether, payable(address(recipient)));

        assertEq(diamonds.balanceOf(config.vaultId, accounts.alice.addr), DEFAULT_FUNDING);
        assertEq(_readVault(config.vaultId).escrowed, DEFAULT_FUNDING);
        assertEq(diamonds.totalLiabilities(), DEFAULT_FUNDING);
    }

    function test_withdrawBlocksReentrancyWithoutBlockingTransfer() public {
        ReentrantRecipient recipient = new ReentrantRecipient();
        recipient.configure(
            address(diamonds),
            abi.encodeCall(diamonds.withdraw, (config.vaultId, 1, payable(address(recipient))))
        );

        _withdraw(config.vaultId, accounts.alice.addr, 1 ether, payable(address(recipient)));

        assertTrue(recipient.attempted());
        assertFalse(recipient.succeeded());
        assertEq(
            recipient.result(), abi.encodeWithSelector(ReentrancyGuardTransient.Reentrancy.selector)
        );
        assertEq(address(recipient).balance, 1 ether);
        _assertVaultAccounting(config.vaultId, config.owners);
    }
}
