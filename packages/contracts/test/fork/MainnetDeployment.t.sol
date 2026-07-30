// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";
import {MainnetForkTestBase} from "test/fork/MainnetForkTestBase.sol";

contract MainnetDeploymentForkTest is MainnetForkTestBase {
    function test_mainnetDependenciesMatchPinnedSnapshot() public view {
        assertEq(block.chainid, 1);
        assertEq(block.number, MAINNET_FORK_BLOCK);
        assertEq(block.timestamp, MAINNET_FORK_TIMESTAMP);

        assertGt(MAINNET_CONTROLLER.code.length, 0);
        assertGt(MAINNET_BASE_REGISTRAR.code.length, 0);
        assertGt(MAINNET_SAFE_SINGLETON.code.length, 0);
        assertGt(MAINNET_SAFE_PROXY_FACTORY.code.length, 0);
        assertGt(MAINNET_SAFE_FALLBACK_HANDLER.code.length, 0);

        assertTrue(baseRegistrar.controllers(MAINNET_CONTROLLER));
        assertFalse(baseRegistrar.controllers(LEGACY_WRAPPED_CONTROLLER));
        assertEq(controller.minCommitmentAge(), 60);
        assertEq(controller.maxCommitmentAge(), 1 days);
        assertEq(controller.MIN_REGISTRATION_DURATION(), 28 days);
        assertEq(safeSingleton.VERSION(), "1.5.0");

        assertEq(address(diamonds.CONTROLLER()), MAINNET_CONTROLLER);
        assertEq(address(diamonds.BASE_REGISTRAR()), MAINNET_BASE_REGISTRAR);
        assertEq(address(diamonds.SAFE_SINGLETON()), MAINNET_SAFE_SINGLETON);
        assertEq(address(diamonds.SAFE_PROXY_FACTORY()), MAINNET_SAFE_PROXY_FACTORY);
        assertEq(diamonds.SAFE_FALLBACK_HANDLER(), MAINNET_SAFE_FALLBACK_HANDLER);
        assertEq(
            diamonds.SAFE_PROXY_INIT_CODE_HASH(),
            keccak256(
                abi.encodePacked(
                    safeProxyFactory.proxyCreationCode(), uint256(uint160(MAINNET_SAFE_SINGLETON))
                )
            )
        );
    }

    function test_wayEthIsAvailableInsidePremiumPeriod() public view {
        uint256 tokenId = uint256(keccak256(bytes(WAY_LABEL)));
        IPriceOracle.Price memory quote =
            controller.rentPrice(WAY_LABEL, DEFAULT_REGISTRATION_DURATION);

        assertEq(baseRegistrar.nameExpires(tokenId), WAY_EXPIRY);
        assertGt(block.timestamp, WAY_EXPIRY + baseRegistrar.GRACE_PERIOD());
        assertLt(block.timestamp - (WAY_EXPIRY + baseRegistrar.GRACE_PERIOD()), WAY_PREMIUM_PERIOD);
        assertTrue(baseRegistrar.available(tokenId));
        assertTrue(controller.available(WAY_LABEL));
        assertGt(quote.base, 0);
        assertGt(quote.premium, 0);
        assertLt(quote.base + quote.premium, WAY_MAX_SPEND);
    }
}
