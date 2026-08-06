// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {
    SafeProxyFactory
} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";
import {ETHRegistrarController} from "ens-contracts/ethregistrar/ETHRegistrarController.sol";
import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";
import {IBaseRegistrar} from "src/interfaces/IBaseRegistrar.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {CommittedVaultTestBase} from "test/utils/CommittedVaultTestBase.sol";

contract PurchaseDependenciesTest is CommittedVaultTestBase {
    function test_purchaseRevertsWhenCompetingRegistrationWins() public {
        IETHRegistrarController.Registration memory competing = _registration(config);
        competing.owner = accounts.eve.addr;
        competing.secret = keccak256("competing secret");
        bytes32 competingCommitment = controller.makeCommitment(competing);

        vm.prank(accounts.eve.addr);
        controller.commit(competingCommitment);
        _matureCommitment(config.vaultId);
        uint256 price = _quote(config);
        vm.prank(accounts.eve.addr);
        controller.register{value: price}(competing);

        vm.expectRevert(
            abi.encodeWithSelector(ETHRegistrarController.NameNotAvailable.selector, config.label)
        );
        _purchase(config, accounts.dave.addr);

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Committed));
        assertEq(diamonds.totalLiabilities(), DEFAULT_FUNDING);
    }

    function test_purchaseRevertsWhenRegistrarReportsWrongOwner() public {
        _matureCommitment(config.vaultId);
        uint256 tokenId = uint256(keccak256(bytes(config.label)));
        vm.mockCall(
            address(baseRegistrar),
            abi.encodeWithSelector(IBaseRegistrar.ownerOf.selector, tokenId),
            abi.encode(accounts.eve.addr)
        );

        vm.expectRevert(IENSDiamonds.ENSVerificationFailed.selector);
        _purchase(config, accounts.eve.addr);

        assertEq(config.predictedSafe.code.length, 0);
        assertEq(diamonds.totalLiabilities(), DEFAULT_FUNDING);
    }

    function test_purchaseRevertsWhenRegistrarOwnerQueryFails() public {
        _matureCommitment(config.vaultId);
        uint256 tokenId = uint256(keccak256(bytes(config.label)));
        vm.mockCallRevert(
            address(baseRegistrar),
            abi.encodeWithSelector(IBaseRegistrar.ownerOf.selector, tokenId),
            bytes("owner query failed")
        );

        vm.expectRevert(IENSDiamonds.ENSVerificationFailed.selector);
        _purchase(config, accounts.eve.addr);
    }

    function test_purchaseRevertsWhenFactoryReturnsWrongAddress() public {
        _matureCommitment(config.vaultId);
        vm.mockCall(
            address(safeProxyFactory),
            abi.encodeWithSelector(SafeProxyFactory.createProxyWithNonce.selector),
            abi.encode(accounts.eve.addr)
        );

        vm.expectRevert(IENSDiamonds.SafeVerificationFailed.selector);
        _purchase(config, accounts.eve.addr);
    }

    function test_purchaseRevertsWhenFactoryDoesNotDeployCode() public {
        _matureCommitment(config.vaultId);
        vm.mockCall(
            address(safeProxyFactory),
            abi.encodeWithSelector(SafeProxyFactory.createProxyWithNonce.selector),
            abi.encode(config.predictedSafe)
        );

        vm.expectRevert(IENSDiamonds.SafeVerificationFailed.selector);
        _purchase(config, accounts.eve.addr);
    }

    function test_purchaseRollsBackWhenControllerRegistrationFails() public {
        _matureCommitment(config.vaultId);
        bytes memory controllerError =
            abi.encodeWithSignature("Error(string)", "registration failed");
        vm.mockCallRevert(
            address(controller),
            abi.encodeWithSelector(IETHRegistrarController.register.selector),
            controllerError
        );

        vm.expectRevert(controllerError);
        _purchase(config, accounts.eve.addr);

        assertEq(config.predictedSafe.code.length, 0);
        assertEq(diamonds.totalLiabilities(), DEFAULT_FUNDING);
        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Committed));
    }
}
