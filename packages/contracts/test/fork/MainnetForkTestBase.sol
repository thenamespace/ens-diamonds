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
import {SafeTestUtils} from "test/utils/SafeTestUtils.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

abstract contract MainnetForkTestBase is SafeTestUtils {
    uint256 internal constant MAINNET_FORK_BLOCK = 25_647_730;
    uint256 internal constant MAINNET_FORK_TIMESTAMP = 1_785_439_319;

    address internal constant MAINNET_ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;
    address internal constant MAINNET_BASE_REGISTRAR = 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85;
    address internal constant MAINNET_CONTROLLER = 0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547;
    address internal constant LEGACY_WRAPPED_CONTROLLER =
        0x253553366Da8546fC250F225fe3d25d0C782303b;

    address internal constant MAINNET_SAFE_SINGLETON = 0xFf51A5898e281Db6DfC7855790607438dF2ca44b;
    address internal constant MAINNET_SAFE_PROXY_FACTORY =
        0x14F2982D601c9458F93bd70B218933A6f8165e7b;
    address internal constant MAINNET_SAFE_FALLBACK_HANDLER =
        0x3EfCBb83A4A7AfcB4F68D501E2c2203a38be77f4;

    string internal constant WAY_LABEL = "way";
    uint256 internal constant WAY_EXPIRY = 1_776_652_594;
    uint256 internal constant WAY_PREMIUM_PERIOD = 21 days;
    uint96 internal constant WAY_MAX_SPEND = 20 ether;

    function setUp() public virtual override {
        vm.createSelectFork("mainnet", MAINNET_FORK_BLOCK);

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

        ensRegistry = ENSRegistry(MAINNET_ENS_REGISTRY);
        baseRegistrar = BaseRegistrarImplementation(MAINNET_BASE_REGISTRAR);
        controller = ETHRegistrarController(MAINNET_CONTROLLER);
        safeSingleton = Safe(payable(MAINNET_SAFE_SINGLETON));
        safeProxyFactory = SafeProxyFactory(MAINNET_SAFE_PROXY_FACTORY);
        safeFallbackHandler = CompatibilityFallbackHandler(MAINNET_SAFE_FALLBACK_HANDLER);

        vm.prank(accounts.deployer.addr);
        diamonds = new ENSDiamonds(
            IENSDiamondsRegistrarController(MAINNET_CONTROLLER),
            IBaseRegistrar(MAINNET_BASE_REGISTRAR),
            ISafe(payable(MAINNET_SAFE_SINGLETON)),
            safeProxyFactory,
            MAINNET_SAFE_FALLBACK_HANDLER
        );
    }

    function _wayVault(bytes32 vaultSalt, uint96 maxSpend)
        internal
        view
        returns (VaultConfig memory)
    {
        return _buildVault(
            accounts.alice.addr,
            _owners(accounts.alice.addr, accounts.bob.addr),
            WAY_LABEL,
            vaultSalt,
            keccak256(abi.encode("way target", vaultSalt)),
            keccak256(abi.encode("way secret", vaultSalt)),
            maxSpend,
            DEFAULT_REGISTRATION_DURATION
        );
    }

    function _mainnetVault(string memory label, bytes32 vaultSalt, uint96 maxSpend)
        internal
        view
        returns (VaultConfig memory)
    {
        return _buildVault(
            accounts.alice.addr,
            _owners(accounts.alice.addr, accounts.bob.addr),
            label,
            vaultSalt,
            keccak256(abi.encode("mainnet target", label, vaultSalt)),
            keccak256(abi.encode("mainnet secret", label, vaultSalt)),
            maxSpend,
            DEFAULT_REGISTRATION_DURATION
        );
    }
}
