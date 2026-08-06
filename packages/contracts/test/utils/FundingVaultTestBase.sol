// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {SafeTestUtils} from "test/utils/SafeTestUtils.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

abstract contract FundingVaultTestBase is SafeTestUtils {
    uint256 internal constant DEFAULT_FUNDING = 3 ether;

    VaultConfig internal config;

    function setUp() public virtual override {
        super.setUp();
        config = _defaultVault();
        _createVault(config, DEFAULT_FUNDING);
    }
}
