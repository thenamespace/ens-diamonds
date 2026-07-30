// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Safe} from "@safe-global/safe-smart-account/contracts/Safe.sol";
import {
    CompatibilityFallbackHandler
} from "@safe-global/safe-smart-account/contracts/handler/CompatibilityFallbackHandler.sol";
import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {
    SafeProxyFactory
} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";
import {
    BaseRegistrarImplementation
} from "ens-contracts/ethregistrar/BaseRegistrarImplementation.sol";
import {ETHRegistrarController} from "ens-contracts/ethregistrar/ETHRegistrarController.sol";
import {ENSRegistry} from "ens-contracts/registry/ENSRegistry.sol";
import {ENSDiamonds} from "src/ENSDiamonds.sol";
import {IBaseRegistrar} from "src/interfaces/IBaseRegistrar.sol";
import {IENSDiamondsRegistrarController} from "src/interfaces/IENSDiamondsRegistrarController.sol";
import {ForkConfig} from "test/fork/ForkConfig.sol";
import {ForkConfigLoader} from "test/fork/ForkConfigLoader.sol";
import {SafeTestUtils} from "test/utils/SafeTestUtils.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

abstract contract ForkTestBase is SafeTestUtils {
    ForkConfig internal forkConfig;

    function configPath() internal pure virtual returns (string memory);

    function setUp() public virtual override {
        forkConfig = ForkConfigLoader.load(vm, configPath());
        vm.createSelectFork(forkConfig.chain.rpcAlias, forkConfig.chain.blockNumber);

        accounts.deployer = vm.createWallet("deployer");
        accounts.alice = vm.createWallet("alice");
        accounts.bob = vm.createWallet("bob");
        accounts.charlie = vm.createWallet("charlie");
        accounts.dave = vm.createWallet("dave");
        accounts.eve = vm.createWallet("eve");

        vm.deal(accounts.deployer.addr, INITIAL_BALANCE);
        vm.deal(accounts.alice.addr, INITIAL_BALANCE);
        vm.deal(accounts.bob.addr, INITIAL_BALANCE);
        vm.deal(accounts.charlie.addr, INITIAL_BALANCE);
        vm.deal(accounts.dave.addr, INITIAL_BALANCE);
        vm.deal(accounts.eve.addr, INITIAL_BALANCE);

        ensRegistry = ENSRegistry(forkConfig.contracts.ensRegistry);
        baseRegistrar = BaseRegistrarImplementation(forkConfig.contracts.baseRegistrar);
        controller = ETHRegistrarController(forkConfig.contracts.controller);
        safeSingleton = Safe(payable(forkConfig.contracts.safeSingleton));
        safeProxyFactory = SafeProxyFactory(forkConfig.contracts.safeProxyFactory);
        safeFallbackHandler = CompatibilityFallbackHandler(forkConfig.contracts.safeFallbackHandler);

        vm.prank(accounts.deployer.addr);
        diamonds = new ENSDiamonds(
            IENSDiamondsRegistrarController(forkConfig.contracts.controller),
            IBaseRegistrar(forkConfig.contracts.baseRegistrar),
            ISafe(payable(forkConfig.contracts.safeSingleton)),
            safeProxyFactory,
            forkConfig.contracts.safeFallbackHandler
        );
    }

    function _forkVault(string memory label, bytes32 vaultSalt, uint96 maxSpend)
        internal
        view
        returns (VaultConfig memory)
    {
        return _buildVault(
            accounts.alice.addr,
            _owners(accounts.alice.addr, accounts.bob.addr),
            label,
            vaultSalt,
            keccak256(abi.encode("fork target", forkConfig.chain.chainId, label, vaultSalt)),
            keccak256(abi.encode("fork secret", forkConfig.chain.chainId, label, vaultSalt)),
            maxSpend,
            DEFAULT_REGISTRATION_DURATION
        );
    }

    function _skipUnlessConfigured(string memory label, string memory fixture) internal {
        vm.skip(bytes(label).length == 0, string.concat(fixture, " fixture is not configured"));
    }
}
