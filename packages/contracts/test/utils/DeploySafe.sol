// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Safe} from "@safe-global/safe-smart-account/contracts/Safe.sol";
import {
    CompatibilityFallbackHandler
} from "@safe-global/safe-smart-account/contracts/handler/CompatibilityFallbackHandler.sol";
import {
    SafeProxyFactory
} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";

abstract contract DeploySafe {
    Safe internal safeSingleton;
    SafeProxyFactory internal safeProxyFactory;
    CompatibilityFallbackHandler internal safeFallbackHandler;

    function deploySafe() internal {
        safeSingleton = new Safe();
        safeProxyFactory = new SafeProxyFactory();
        safeFallbackHandler = new CompatibilityFallbackHandler();
    }
}
