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
    uint256 internal constant INITIAL_TIMESTAMP = 1_800_000_000;
    uint256 internal constant INITIAL_BALANCE = 100 ether;

    Vm.Wallet internal creator;
    Vm.Wallet internal member;
    Vm.Wallet internal thirdMember;
    Vm.Wallet internal executor;

    ENSDiamonds internal diamonds;

    function setUp() public virtual {
        vm.warp(INITIAL_TIMESTAMP);

        creator = vm.createWallet("creator");
        member = vm.createWallet("member");
        thirdMember = vm.createWallet("thirdMember");
        executor = vm.createWallet("executor");

        vm.deal(creator.addr, INITIAL_BALANCE);
        vm.deal(member.addr, INITIAL_BALANCE);
        vm.deal(thirdMember.addr, INITIAL_BALANCE);
        vm.deal(executor.addr, INITIAL_BALANCE);

        deployEns();
        deploySafe();

        diamonds = new ENSDiamonds(
            IENSDiamondsRegistrarController(address(controller)),
            IBaseRegistrar(address(baseRegistrar)),
            ISafe(payable(address(safeSingleton))),
            safeProxyFactory,
            address(safeFallbackHandler)
        );
    }
}
