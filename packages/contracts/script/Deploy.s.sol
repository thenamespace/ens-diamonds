// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {CofferEscrow} from "../src/CofferEscrow.sol";

/// @notice Deploys CofferEscrow. All Safe addresses come from env and MUST be
///         verified against canonical deployment lists before running.
contract Deploy is Script {
    function run() external returns (CofferEscrow escrow) {
        address factory = vm.envAddress("SAFE_PROXY_FACTORY");
        address singleton = vm.envAddress("SAFE_SINGLETON");
        address fallbackHandler = vm.envAddress("SAFE_FALLBACK_HANDLER");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        require(factory != address(0), "SAFE_PROXY_FACTORY unset");
        require(singleton != address(0), "SAFE_SINGLETON unset");
        require(fallbackHandler != address(0), "SAFE_FALLBACK_HANDLER unset");

        vm.startBroadcast(pk);
        escrow = new CofferEscrow(factory, singleton, fallbackHandler);
        vm.stopBroadcast();

        console2.log("CofferEscrow deployed at:", address(escrow));
    }
}
