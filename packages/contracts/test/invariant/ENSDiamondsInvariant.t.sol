// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {IENSDiamondsRegistrarController} from "src/interfaces/IENSDiamondsRegistrarController.sol";
import {ENSDiamondsHandler} from "test/invariant/handlers/ENSDiamondsHandler.sol";
import {VaultActions} from "test/utils/VaultActions.sol";

contract ENSDiamondsInvariantTest is VaultActions {
    ENSDiamondsHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new ENSDiamondsHandler(
            IENSDiamonds(address(diamonds)),
            IENSDiamondsRegistrarController(address(controller)),
            accounts.alice.addr,
            accounts.bob.addr,
            accounts.charlie.addr,
            accounts.dave.addr
        );

        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = handler.createVault.selector;
        selectors[1] = handler.deposit.selector;
        selectors[2] = handler.withdraw.selector;
        selectors[3] = handler.cancel.selector;
        selectors[4] = handler.beginAcquisition.selector;
        selectors[5] = handler.purchase.selector;
        selectors[6] = handler.expireAcquisition.selector;
        selectors[7] = handler.claim.selector;
        selectors[8] = handler.warp.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function invariant_protocolIsSolvent() public view {
        assertLe(diamonds.totalLiabilities(), address(diamonds).balance);
    }

    function invariant_liabilitiesEqualTrackedEscrow() public view {
        uint256 escrowSum;
        uint256 count = handler.trackedVaultCount();

        for (uint256 i; i < count; ++i) {
            (bytes32 vaultId,,) = handler.trackedVault(i);
            escrowSum += _readVault(vaultId).escrowed;
        }

        assertEq(escrowSum, diamonds.totalLiabilities());
        assertEq(escrowSum, handler.expectedLiabilities());
    }

    function invariant_memberBalancesEqualVaultEscrow() public view {
        address[] memory owners = handler.owners();
        uint256 count = handler.trackedVaultCount();

        for (uint256 i; i < count; ++i) {
            (bytes32 vaultId,,) = handler.trackedVault(i);
            IENSDiamonds.Vault memory vault = _readVault(vaultId);

            assertEq(_sumBalances(vaultId, owners), vault.escrowed);
            assertLe(vault.escrowed, vault.maxSpend);
            assertEq(diamonds.balanceOf(vaultId, accounts.dave.addr), 0);
            assertEq(diamonds.balanceOf(vaultId, accounts.eve.addr), 0);
        }
    }

    function invariant_acquiredVaultsHaveConfiguredSafe() public view {
        address[] memory expectedOwners = handler.owners();
        uint256 count = handler.trackedVaultCount();

        for (uint256 i; i < count; ++i) {
            (bytes32 vaultId, address predictedSafe, uint256 threshold) = handler.trackedVault(i);
            if (_readVault(vaultId).state != IENSDiamonds.State.Acquired) continue;

            assertGt(predictedSafe.code.length, 0);
            assertEq(ISafe(payable(predictedSafe)).getOwners(), expectedOwners);
            assertEq(ISafe(payable(predictedSafe)).getThreshold(), threshold);
        }
    }

    function invariant_statesNeverRegress() public view {
        assertFalse(handler.stateRegressed());
        assertFalse(handler.terminalStateChanged());
    }
}
