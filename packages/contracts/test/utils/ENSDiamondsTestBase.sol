// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {ENSDiamonds} from "src/ENSDiamonds.sol";
import {IBaseRegistrar} from "src/interfaces/IBaseRegistrar.sol";
import {IENSDiamondsRegistrarController} from "src/interfaces/IENSDiamondsRegistrarController.sol";
import {DeployENS} from "test/utils/DeployENS.sol";
import {DeploySafe} from "test/utils/DeploySafe.sol";

abstract contract ENSDiamondsTestBase is Test, DeployENS, DeploySafe {
    struct Accounts {
        Vm.Wallet deployer;
        Vm.Wallet alice;
        Vm.Wallet bob;
        Vm.Wallet charlie;
        Vm.Wallet dave;
        Vm.Wallet eve;
    }

    uint256 internal constant INITIAL_TIMESTAMP = 1_800_000_000;
    uint256 internal constant INITIAL_BALANCE = 100 ether;

    Accounts internal accounts;
    ENSDiamonds internal diamonds;

    function setUp() public virtual {
        vm.warp(INITIAL_TIMESTAMP);

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

        vm.startPrank(accounts.deployer.addr);
        deployEns();
        deploySafe();

        diamonds = new ENSDiamonds(
            IENSDiamondsRegistrarController(address(controller)),
            IBaseRegistrar(address(baseRegistrar)),
            ISafe(payable(address(safeSingleton))),
            safeProxyFactory,
            address(safeFallbackHandler)
        );
        vm.stopPrank();
    }
}
