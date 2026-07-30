// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {FundingVaultTestBase} from "test/utils/FundingVaultTestBase.sol";

contract CancelTest is FundingVaultTestBase {
    function test_cancelMovesVaultToCancelled() public {
        vm.expectEmit(true, false, false, false, address(diamonds));
        emit IENSDiamonds.VaultCancelled(config.vaultId);
        _cancel(config.vaultId, config.creator);

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Cancelled));
        assertEq(_readVault(config.vaultId).escrowed, DEFAULT_FUNDING);
        assertEq(diamonds.totalLiabilities(), DEFAULT_FUNDING);
    }

    function test_cancelRevertsForNonCreator() public {
        vm.expectRevert(IENSDiamonds.Unauthorized.selector);
        _cancel(config.vaultId, accounts.bob.addr);
    }

    function test_cancelRevertsForUnknownVault() public {
        vm.expectRevert(IENSDiamonds.VaultNotFound.selector);
        _cancel(keccak256("missing"), accounts.alice.addr);
    }

    function test_cancelRevertsOutsideFundingState() public {
        _cancel(config.vaultId, config.creator);

        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InvalidState.selector, IENSDiamonds.State.Cancelled)
        );
        _cancel(config.vaultId, config.creator);
    }
}
