// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {CommittedVaultTestBase} from "test/utils/CommittedVaultTestBase.sol";

contract PurchaseTimingFuzzTest is CommittedVaultTestBase {
    function testFuzz_purchaseRespectsCommitmentWindow(uint256 offsetSeed) public {
        IENSDiamonds.Vault memory vault = _readVault(config.vaultId);
        uint256 minAge = controller.minCommitmentAge();
        uint256 maxAge = controller.maxCommitmentAge();
        uint256 offset = bound(offsetSeed, 0, maxAge + 1);
        vm.warp(uint256(vault.committedAt) + offset);

        if (offset < minAge) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IENSDiamonds.CommitmentTooYoung.selector, uint256(vault.committedAt) + minAge
                )
            );
            _purchase(config, accounts.eve.addr);
            return;
        }

        if (offset >= maxAge) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IENSDiamonds.CommitmentExpired.selector, uint256(vault.committedAt) + maxAge
                )
            );
            _purchase(config, accounts.eve.addr);
            return;
        }

        _purchase(config, accounts.eve.addr);
        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Acquired));
    }
}
