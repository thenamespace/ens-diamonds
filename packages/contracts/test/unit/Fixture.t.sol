// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ENSDiamondsTestBase} from "test/utils/ENSDiamondsTestBase.sol";

contract ENSDiamondsFixtureTest is ENSDiamondsTestBase {
    function test_fixtureDeploysProtocolDependencies() public view {
        assertEq(ensRegistry.owner(bytes32(0)), accounts.deployer.addr);
        assertEq(ensRegistry.owner(ETH_NODE), address(baseRegistrar));
        assertEq(baseRegistrar.owner(), accounts.deployer.addr);
        assertEq(controller.owner(), accounts.deployer.addr);
        assertTrue(baseRegistrar.controllers(address(controller)));
        assertEq(controller.minCommitmentAge(), MIN_COMMITMENT_AGE);
        assertEq(controller.maxCommitmentAge(), MAX_COMMITMENT_AGE);
        assertEq(safeSingleton.VERSION(), "1.5.0");

        assertEq(address(diamonds.CONTROLLER()), address(controller));
        assertEq(address(diamonds.BASE_REGISTRAR()), address(baseRegistrar));
        assertEq(address(diamonds.SAFE_SINGLETON()), address(safeSingleton));
        assertEq(address(diamonds.SAFE_PROXY_FACTORY()), address(safeProxyFactory));
        assertEq(diamonds.SAFE_FALLBACK_HANDLER(), address(safeFallbackHandler));
    }

    function test_fixtureCreatesFundedWallets() public view {
        assertEq(accounts.deployer.addr.balance, INITIAL_BALANCE);
        assertEq(accounts.alice.addr.balance, INITIAL_BALANCE);
        assertEq(accounts.bob.addr.balance, INITIAL_BALANCE);
        assertEq(accounts.charlie.addr.balance, INITIAL_BALANCE);
        assertEq(accounts.dave.addr.balance, INITIAL_BALANCE);
        assertEq(accounts.eve.addr.balance, INITIAL_BALANCE);
    }
}
