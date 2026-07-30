// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {
    BaseRegistrarImplementation
} from "ens-contracts/ethregistrar/BaseRegistrarImplementation.sol";
import {DummyOracle} from "ens-contracts/ethregistrar/DummyOracle.sol";
import {ETHRegistrarController} from "ens-contracts/ethregistrar/ETHRegistrarController.sol";
import {
    ExponentialPremiumPriceOracle
} from "ens-contracts/ethregistrar/ExponentialPremiumPriceOracle.sol";
import {AggregatorInterface} from "ens-contracts/ethregistrar/StablePriceOracle.sol";
import {ENSRegistry} from "ens-contracts/registry/ENSRegistry.sol";
import {
    IDefaultReverseRegistrar
} from "ens-contracts/reverseRegistrar/IDefaultReverseRegistrar.sol";
import {IReverseRegistrar} from "ens-contracts/reverseRegistrar/IReverseRegistrar.sol";

abstract contract DeployENS {
    bytes32 internal constant ETH_NODE =
        0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;
    uint256 internal constant MIN_COMMITMENT_AGE = 60;
    uint256 internal constant MAX_COMMITMENT_AGE = 1 days;

    ENSRegistry internal ensRegistry;
    BaseRegistrarImplementation internal baseRegistrar;
    DummyOracle internal usdOracle;
    ExponentialPremiumPriceOracle internal priceOracle;
    ETHRegistrarController internal controller;

    function deployEns() internal {
        ensRegistry = new ENSRegistry();
        baseRegistrar = new BaseRegistrarImplementation(ensRegistry, ETH_NODE);
        usdOracle = new DummyOracle(160_000_000_000);

        uint256[] memory rentPrices = new uint256[](5);
        rentPrices[0] = 0;
        rentPrices[1] = 0;
        rentPrices[2] = 20_294_266_869_609;
        rentPrices[3] = 5_073_566_717_402;
        rentPrices[4] = 158_548_959_919;

        priceOracle = new ExponentialPremiumPriceOracle(
            AggregatorInterface(address(usdOracle)), rentPrices, 100_000_000 ether, 21
        );
        controller = new ETHRegistrarController(
            baseRegistrar,
            priceOracle,
            MIN_COMMITMENT_AGE,
            MAX_COMMITMENT_AGE,
            IReverseRegistrar(address(0)),
            IDefaultReverseRegistrar(address(0)),
            ensRegistry
        );

        ensRegistry.setSubnodeOwner(bytes32(0), keccak256("eth"), address(baseRegistrar));
        baseRegistrar.addController(address(controller));
    }
}
