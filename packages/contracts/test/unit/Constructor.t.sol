// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {
    SafeProxyFactory
} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";
import {ENSDiamonds} from "src/ENSDiamonds.sol";
import {IBaseRegistrar} from "src/interfaces/IBaseRegistrar.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {IENSDiamondsRegistrarController} from "src/interfaces/IENSDiamondsRegistrarController.sol";
import {ENSDiamondsTestBase} from "test/utils/ENSDiamondsTestBase.sol";

contract ConstructorTest is ENSDiamondsTestBase {
    function test_constructorStoresDependenciesAndConfiguration() public view {
        assertEq(address(diamonds.CONTROLLER()), address(controller));
        assertEq(address(diamonds.BASE_REGISTRAR()), address(baseRegistrar));
        assertEq(address(diamonds.SAFE_SINGLETON()), address(safeSingleton));
        assertEq(address(diamonds.SAFE_PROXY_FACTORY()), address(safeProxyFactory));
        assertEq(diamonds.SAFE_FALLBACK_HANDLER(), address(safeFallbackHandler));

        bytes32 expectedHash = keccak256(
            abi.encodePacked(
                safeProxyFactory.proxyCreationCode(), uint256(uint160(address(safeSingleton)))
            )
        );
        assertEq(diamonds.SAFE_PROXY_INIT_CODE_HASH(), expectedHash);
    }

    function test_constructorRevertsForZeroDependency() public {
        vm.expectRevert(abi.encodeWithSelector(IENSDiamonds.InvalidContract.selector, address(0)));
        _deploy(
            IENSDiamondsRegistrarController(address(0)),
            IBaseRegistrar(address(baseRegistrar)),
            ISafe(payable(address(safeSingleton))),
            safeProxyFactory,
            address(safeFallbackHandler)
        );
    }

    function test_constructorRevertsForDependencyWithoutCode() public {
        address eoa = accounts.eve.addr;

        vm.expectRevert(abi.encodeWithSelector(IENSDiamonds.InvalidContract.selector, eoa));
        _deploy(
            IENSDiamondsRegistrarController(eoa),
            IBaseRegistrar(address(baseRegistrar)),
            ISafe(payable(address(safeSingleton))),
            safeProxyFactory,
            address(safeFallbackHandler)
        );
    }

    function test_constructorChecksEveryDependency() public {
        address eoa = accounts.eve.addr;

        vm.expectRevert(abi.encodeWithSelector(IENSDiamonds.InvalidContract.selector, eoa));
        _deploy(
            IENSDiamondsRegistrarController(address(controller)),
            IBaseRegistrar(eoa),
            ISafe(payable(address(safeSingleton))),
            safeProxyFactory,
            address(safeFallbackHandler)
        );

        vm.expectRevert(abi.encodeWithSelector(IENSDiamonds.InvalidContract.selector, eoa));
        _deploy(
            IENSDiamondsRegistrarController(address(controller)),
            IBaseRegistrar(address(baseRegistrar)),
            ISafe(payable(eoa)),
            safeProxyFactory,
            address(safeFallbackHandler)
        );

        vm.expectRevert(abi.encodeWithSelector(IENSDiamonds.InvalidContract.selector, eoa));
        _deploy(
            IENSDiamondsRegistrarController(address(controller)),
            IBaseRegistrar(address(baseRegistrar)),
            ISafe(payable(address(safeSingleton))),
            SafeProxyFactory(eoa),
            address(safeFallbackHandler)
        );

        vm.expectRevert(abi.encodeWithSelector(IENSDiamonds.InvalidContract.selector, eoa));
        _deploy(
            IENSDiamondsRegistrarController(address(controller)),
            IBaseRegistrar(address(baseRegistrar)),
            ISafe(payable(address(safeSingleton))),
            safeProxyFactory,
            eoa
        );
    }

    function test_constructorRevertsForInvalidCommitmentAges() public {
        vm.mockCall(
            address(controller),
            abi.encodeWithSelector(IENSDiamondsRegistrarController.maxCommitmentAge.selector),
            abi.encode(MIN_COMMITMENT_AGE)
        );

        vm.expectRevert(IENSDiamonds.InvalidConfiguration.selector);
        _deployDefault();
    }

    function test_constructorRevertsForDurationAboveUint32() public {
        vm.mockCall(
            address(controller),
            abi.encodeWithSelector(
                IENSDiamondsRegistrarController.MIN_REGISTRATION_DURATION.selector
            ),
            abi.encode(uint256(type(uint32).max) + 1)
        );

        vm.expectRevert(IENSDiamonds.InvalidConfiguration.selector);
        _deployDefault();
    }

    function _deployDefault() internal returns (ENSDiamonds deployment) {
        deployment = _deploy(
            IENSDiamondsRegistrarController(address(controller)),
            IBaseRegistrar(address(baseRegistrar)),
            ISafe(payable(address(safeSingleton))),
            safeProxyFactory,
            address(safeFallbackHandler)
        );
    }

    function _deploy(
        IENSDiamondsRegistrarController controller_,
        IBaseRegistrar baseRegistrar_,
        ISafe singleton_,
        SafeProxyFactory factory_,
        address fallbackHandler_
    ) internal returns (ENSDiamonds deployment) {
        vm.prank(accounts.deployer.addr);
        deployment =
            new ENSDiamonds(controller_, baseRegistrar_, singleton_, factory_, fallbackHandler_);
    }
}
