// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ReentrancyGuardTransient} from "solady/utils/ReentrancyGuardTransient.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {FundingVaultTestBase} from "test/utils/FundingVaultTestBase.sol";
import {ReentrantRecipient} from "test/utils/ReentrantRecipient.sol";
import {RejectEther} from "test/utils/RejectEther.sol";

contract ClaimFailuresTest is FundingVaultTestBase {
    function test_claimRevertsForUnknownVault() public {
        vm.expectRevert(IENSDiamonds.VaultNotFound.selector);
        _claim(keccak256("missing"), accounts.alice.addr, payable(accounts.alice.addr));
    }

    function test_claimRevertsForZeroRecipient() public {
        _cancel(config.vaultId, config.creator);

        vm.expectRevert(IENSDiamonds.InvalidAddress.selector);
        _claim(config.vaultId, config.creator, payable(address(0)));
    }

    function test_claimRevertsInFundingState() public {
        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InvalidState.selector, IENSDiamonds.State.Funding)
        );
        _claim(config.vaultId, config.creator, payable(config.creator));
    }

    function test_claimRevertsBeforeCommittedVaultExpires() public {
        _beginAcquisition(config.vaultId, config.creator);

        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InvalidState.selector, IENSDiamonds.State.Committed)
        );
        _claim(config.vaultId, config.creator, payable(config.creator));
    }

    function test_claimRevertsForZeroBalanceAndSecondClaim() public {
        _cancel(config.vaultId, config.creator);

        vm.expectRevert(IENSDiamonds.NothingToClaim.selector);
        _claim(config.vaultId, accounts.bob.addr, payable(accounts.bob.addr));

        _claim(config.vaultId, config.creator, payable(config.creator));
        vm.expectRevert(IENSDiamonds.NothingToClaim.selector);
        _claim(config.vaultId, config.creator, payable(config.creator));
    }

    function test_claimRollsBackWhenRecipientRejectsEther() public {
        RejectEther recipient = new RejectEther();
        _cancel(config.vaultId, config.creator);

        vm.expectRevert(IENSDiamonds.ETHTransferFailed.selector);
        _claim(config.vaultId, config.creator, payable(address(recipient)));

        assertEq(diamonds.balanceOf(config.vaultId, config.creator), DEFAULT_FUNDING);
        assertEq(_readVault(config.vaultId).escrowed, DEFAULT_FUNDING);
        assertEq(diamonds.totalLiabilities(), DEFAULT_FUNDING);
    }

    function test_claimBlocksReentrancyWithoutBlockingTransfer() public {
        ReentrantRecipient recipient = new ReentrantRecipient();
        _cancel(config.vaultId, config.creator);
        recipient.configure(
            address(diamonds),
            abi.encodeCall(diamonds.claim, (config.vaultId, payable(address(recipient))))
        );

        _claim(config.vaultId, config.creator, payable(address(recipient)));

        assertTrue(recipient.attempted());
        assertFalse(recipient.succeeded());
        assertEq(
            recipient.result(), abi.encodeWithSelector(ReentrancyGuardTransient.Reentrancy.selector)
        );
        assertEq(address(recipient).balance, DEFAULT_FUNDING);
        assertEq(diamonds.totalLiabilities(), 0);
    }
}
