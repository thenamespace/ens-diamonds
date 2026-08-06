// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {IProxy} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxy.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {CommittedVaultTestBase} from "test/utils/CommittedVaultTestBase.sol";

contract PurchaseSuccessTest is CommittedVaultTestBase {
    function test_purchaseAcquiresNameIntoConfiguredSafe() public {
        uint256 price = _quote(config);
        uint256 surplus = DEFAULT_FUNDING - price;
        _matureCommitment(config.vaultId);

        vm.expectEmit(true, true, true, true, address(diamonds));
        emit IENSDiamonds.NameAcquired(
            config.vaultId, keccak256(bytes(config.label)), config.predictedSafe, price, surplus
        );
        _purchase(config, accounts.eve.addr);

        IENSDiamonds.Vault memory vault = _readVault(config.vaultId);
        ISafe safe = _safeAt(config.predictedSafe);
        assertEq(uint256(vault.state), uint256(IENSDiamonds.State.Acquired));
        assertEq(vault.escrowed, surplus);
        assertEq(diamonds.balanceOf(config.vaultId, config.creator), surplus);
        assertEq(diamonds.totalLiabilities(), surplus);
        assertEq(address(diamonds).balance, surplus);
        assertEq(address(controller).balance, price);
        assertEq(
            baseRegistrar.ownerOf(uint256(keccak256(bytes(config.label)))), config.predictedSafe
        );
        assertEq(controller.commitments(config.ensCommitment), 0);
        assertGt(config.predictedSafe.code.length, 0);
        assertEq(IProxy(config.predictedSafe).masterCopy(), address(safeSingleton));
        assertEq(safe.getOwners(), config.owners);
        assertEq(safe.getThreshold(), config.threshold);
        assertEq(_fallbackHandlerAt(config.predictedSafe), address(safeFallbackHandler));
        _assertVaultAccounting(config.vaultId, config.owners);
    }

    function test_purchaseSucceedsAtLastValidSecond() public {
        IENSDiamonds.Vault memory vault = _readVault(config.vaultId);
        vm.warp(uint256(vault.committedAt) + controller.maxCommitmentAge() - 1);

        _purchase(config, accounts.dave.addr);

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Acquired));
    }

    function test_purchaseUsesAlreadyDeployedPredictedSafe() public {
        _deployPredictedSafe(config);
        uint256 codeSize = config.predictedSafe.code.length;
        _matureCommitment(config.vaultId);

        _purchase(config, accounts.eve.addr);

        assertEq(config.predictedSafe.code.length, codeSize);
        assertEq(
            baseRegistrar.ownerOf(uint256(keccak256(bytes(config.label)))), config.predictedSafe
        );
    }
}
