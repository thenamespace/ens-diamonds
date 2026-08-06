// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {
    SafeProxyFactory
} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";
import {Script} from "forge-std/Script.sol";
import {ENSDiamonds} from "src/ENSDiamonds.sol";
import {IBaseRegistrar} from "src/interfaces/IBaseRegistrar.sol";
import {IENSDiamondsRegistrarController} from "src/interfaces/IENSDiamondsRegistrarController.sol";

contract Deploy is Script {
    error UnsupportedChain(uint256 chainId);

    uint256 internal constant MAINNET_CHAIN_ID = 1;
    address internal constant CONTROLLER = 0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547;
    address internal constant BASE_REGISTRAR = 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85;
    address internal constant SAFE_SINGLETON = 0xFf51A5898e281Db6DfC7855790607438dF2ca44b;
    address internal constant SAFE_PROXY_FACTORY = 0x14F2982D601c9458F93bd70B218933A6f8165e7b;
    address internal constant SAFE_FALLBACK_HANDLER = 0x3EfCBb83A4A7AfcB4F68D501E2c2203a38be77f4;

    function run() external returns (ENSDiamonds ensDiamonds) {
        if (block.chainid != MAINNET_CHAIN_ID) revert UnsupportedChain(block.chainid);

        vm.startBroadcast();
        ensDiamonds = new ENSDiamonds(
            IENSDiamondsRegistrarController(CONTROLLER),
            IBaseRegistrar(BASE_REGISTRAR),
            ISafe(payable(SAFE_SINGLETON)),
            SafeProxyFactory(SAFE_PROXY_FACTORY),
            SAFE_FALLBACK_HANDLER
        );
        vm.stopBroadcast();
    }
}
