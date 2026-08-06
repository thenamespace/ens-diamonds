// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {FundingVaultTestBase} from "test/utils/FundingVaultTestBase.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

contract DepositTest is FundingVaultTestBase {
    function test_depositCreditsMemberAndVault() public {
        uint256 amount = 2 ether;

        vm.expectEmit(true, true, false, true, address(diamonds));
        emit IENSDiamonds.Deposited(config.vaultId, accounts.bob.addr, amount);
        _deposit(config.vaultId, accounts.bob.addr, amount);

        assertEq(diamonds.balanceOf(config.vaultId, accounts.bob.addr), amount);
        assertEq(_readVault(config.vaultId).escrowed, DEFAULT_FUNDING + amount);
        assertEq(diamonds.totalLiabilities(), DEFAULT_FUNDING + amount);
        assertEq(address(diamonds).balance, DEFAULT_FUNDING + amount);
        _assertVaultAccounting(config.vaultId, config.owners);
    }

    function test_depositAccumulatesAndMayReachMaximum() public {
        _deposit(config.vaultId, accounts.bob.addr, 2 ether);
        _deposit(config.vaultId, accounts.bob.addr, 1 ether);
        _deposit(config.vaultId, accounts.charlie.addr, 4 ether);

        assertEq(diamonds.balanceOf(config.vaultId, accounts.bob.addr), 3 ether);
        assertEq(diamonds.balanceOf(config.vaultId, accounts.charlie.addr), 4 ether);
        assertEq(_readVault(config.vaultId).escrowed, config.maxSpend);
        _assertVaultAccounting(config.vaultId, config.owners);
    }

    function test_depositRevertsForZeroAmount() public {
        vm.expectRevert(IENSDiamonds.InvalidAmount.selector);
        _deposit(config.vaultId, accounts.bob.addr, 0);
    }

    function test_depositRevertsForNonMember() public {
        vm.expectRevert(IENSDiamonds.NotMember.selector);
        _deposit(config.vaultId, accounts.eve.addr, 1 ether);
    }

    function test_depositRevertsAboveMaximum() public {
        vm.expectRevert(IENSDiamonds.FundingLimitExceeded.selector);
        _deposit(config.vaultId, accounts.bob.addr, uint256(config.maxSpend) - DEFAULT_FUNDING + 1);
    }

    function test_depositRevertsForUnknownVault() public {
        vm.expectRevert(IENSDiamonds.VaultNotFound.selector);
        _deposit(keccak256("missing"), accounts.bob.addr, 1 ether);
    }

    function test_depositRevertsOutsideFundingState() public {
        _cancel(config.vaultId, config.creator);

        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InvalidState.selector, IENSDiamonds.State.Cancelled)
        );
        _deposit(config.vaultId, accounts.bob.addr, 1 ether);

        VaultConfig memory committedConfig = _buildVault(
            accounts.alice.addr,
            config.owners,
            "second-vault",
            keccak256("SECOND_VAULT"),
            keccak256("SECOND_TARGET"),
            keccak256("SECOND_SECRET"),
            DEFAULT_MAX_SPEND,
            DEFAULT_REGISTRATION_DURATION
        );
        _createVault(committedConfig, 1 ether);
        _beginAcquisition(committedConfig.vaultId, committedConfig.creator);

        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InvalidState.selector, IENSDiamonds.State.Committed)
        );
        _deposit(committedConfig.vaultId, accounts.bob.addr, 1 ether);
    }
}
