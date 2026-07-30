// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {SafeTestUtils} from "test/utils/SafeTestUtils.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

contract SafeExecutionIntegrationTest is SafeTestUtils {
    function test_acquiredSafeExecutesThresholdSignedTransaction() public {
        VaultConfig memory config = _defaultVault();
        _createVault(config, 1 ether);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);
        _purchase(config, accounts.eve.addr);

        uint256 transferAmount = 0.5 ether;
        vm.deal(config.predictedSafe, transferAmount);
        uint256 recipientBalance = accounts.eve.addr.balance;
        uint256[] memory privateKeys = new uint256[](3);
        privateKeys[0] = accounts.alice.privateKey;
        privateKeys[1] = accounts.bob.privateKey;
        privateKeys[2] = accounts.charlie.privateKey;

        assertTrue(
            _executeSafeTransaction(
                config.predictedSafe, privateKeys, accounts.eve.addr, transferAmount, bytes("")
            )
        );
        assertEq(accounts.eve.addr.balance, recipientBalance + transferAmount);
        assertEq(_safeAt(config.predictedSafe).nonce(), 1);
    }
}
