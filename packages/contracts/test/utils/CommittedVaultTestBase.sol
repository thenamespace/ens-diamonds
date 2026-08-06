// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {FundingVaultTestBase} from "test/utils/FundingVaultTestBase.sol";

abstract contract CommittedVaultTestBase is FundingVaultTestBase {
    function setUp() public virtual override {
        super.setUp();
        _beginAcquisition(config.vaultId, config.creator);
    }
}
