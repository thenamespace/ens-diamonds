// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {VaultActions} from "test/utils/VaultActions.sol";

contract PredictionFuzzTest is VaultActions {
    function testFuzz_predictionIsStableForValidOwnerSets(uint8 ownerCountSeed, bytes32 vaultSalt)
        public
        view
    {
        uint256 ownerCount = bound(ownerCountSeed, 2, 10);
        if (vaultSalt == bytes32(0)) vaultSalt = bytes32(uint256(1));

        address[] memory owners = new address[](ownerCount);
        owners[0] = accounts.alice.addr;
        for (uint256 i = 1; i < ownerCount; ++i) {
            owners[i] = vm.addr(30_000 + i);
        }

        (bytes32 vaultId, address safe, uint256 threshold) =
            diamonds.predictSafe(accounts.alice.addr, vaultSalt, owners);
        (bytes32 repeatedId, address repeatedSafe, uint256 repeatedThreshold) =
            diamonds.predictSafe(accounts.alice.addr, vaultSalt, owners);

        assertEq(repeatedId, vaultId);
        assertEq(repeatedSafe, safe);
        assertEq(repeatedThreshold, threshold);
        assertEq(threshold, ownerCount / 2 + 1);
        assertNotEq(vaultId, bytes32(0));
        assertNotEq(safe, address(0));
    }
}
