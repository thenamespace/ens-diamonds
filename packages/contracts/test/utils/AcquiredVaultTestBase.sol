// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {CommittedVaultTestBase} from "test/utils/CommittedVaultTestBase.sol";

abstract contract AcquiredVaultTestBase is CommittedVaultTestBase {
    uint256 internal purchasePrice;

    function setUp() public virtual override {
        super.setUp();
        purchasePrice = _quote(config);
        _matureCommitment(config.vaultId);
        _purchase(config, accounts.eve.addr);
    }
}
