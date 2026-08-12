// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {VaultBuilder} from "test/utils/VaultBuilder.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

abstract contract VaultActions is VaultBuilder {
    string internal constant DEFAULT_VAULT_URI = "https://ens.diamonds/vault-uri/default";

    function _createVault(VaultConfig memory config, uint256 deposit)
        internal
        returns (bytes32 vaultId)
    {
        vm.prank(config.creator);
        vaultId = diamonds.createVault{value: deposit}(
            config.vaultSalt,
            config.maxSpend,
            config.registrationDuration,
            config.owners,
            config.targetIntent,
            config.ensCommitment,
            DEFAULT_VAULT_URI
        );
    }

    function _deposit(bytes32 vaultId, address member, uint256 amount) internal {
        vm.prank(member);
        diamonds.deposit{value: amount}(vaultId);
    }

    function _withdraw(bytes32 vaultId, address member, uint256 amount, address payable recipient)
        internal
    {
        vm.prank(member);
        diamonds.withdraw(vaultId, amount, recipient);
    }

    function _cancel(bytes32 vaultId, address creator) internal {
        vm.prank(creator);
        diamonds.cancel(vaultId);
    }

    function _beginAcquisition(bytes32 vaultId, address creator) internal {
        vm.prank(creator);
        diamonds.beginAcquisition(vaultId);
    }

    function _purchase(VaultConfig memory config, address executor) internal {
        vm.prank(executor);
        diamonds.purchase(config.vaultId, config.label, config.targetSalt, config.ensSecret);
    }

    function _claim(bytes32 vaultId, address member, address payable recipient) internal {
        vm.prank(member);
        diamonds.claim(vaultId, recipient);
    }

    function _matureCommitment(bytes32 vaultId) internal {
        IENSDiamonds.Vault memory vault = _readVault(vaultId);
        vm.warp(uint256(vault.committedAt) + controller.minCommitmentAge());
    }

    function _quote(VaultConfig memory config) internal view returns (uint256 price) {
        IPriceOracle.Price memory quote =
            controller.rentPrice(config.label, config.registrationDuration);
        price = quote.base + quote.premium;
    }

    function _readVault(bytes32 vaultId) internal view returns (IENSDiamonds.Vault memory vault) {
        (bool success, bytes memory data) =
            address(diamonds).staticcall(abi.encodeCall(IENSDiamonds.vaults, (vaultId)));
        require(success);
        vault = abi.decode(bytes.concat(bytes32(uint256(32)), data), (IENSDiamonds.Vault));
    }

    function _sumBalances(bytes32 vaultId, address[] memory owners)
        internal
        view
        returns (uint256 sum)
    {
        for (uint256 i; i < owners.length; ++i) {
            sum += diamonds.balanceOf(vaultId, owners[i]);
        }
    }

    function _assertVaultAccounting(bytes32 vaultId, address[] memory owners) internal view {
        IENSDiamonds.Vault memory vault = _readVault(vaultId);
        assertEq(_sumBalances(vaultId, owners), vault.escrowed);
        assertLe(vault.escrowed, vault.maxSpend);
        assertLe(diamonds.totalLiabilities(), address(diamonds).balance);
    }
}
