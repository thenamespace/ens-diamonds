// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ETHRegistrarController} from "ens-contracts/ethregistrar/ETHRegistrarController.sol";
import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {MainnetForkTestBase} from "test/fork/MainnetForkTestBase.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

contract MainnetNameStatesForkTest is MainnetForkTestBase {
    string internal constant NEVER_REGISTERED_LABEL = "ens-diamonds-fork-25647730";
    string internal constant REGISTERED_LABEL = "vitalik";

    function test_acquiresNeverRegisteredAvailableNameWithoutPremium() public {
        VaultConfig memory config =
            _mainnetVault(NEVER_REGISTERED_LABEL, keccak256("AVAILABLE_SUCCESS"), uint96(1 ether));
        IPriceOracle.Price memory quote =
            controller.rentPrice(config.label, config.registrationDuration);

        assertTrue(controller.available(config.label));
        assertEq(baseRegistrar.nameExpires(uint256(keccak256(bytes(config.label)))), 0);
        assertEq(quote.premium, 0);
        assertLt(quote.base, config.maxSpend);

        _createVault(config, 1 ether);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);
        _purchase(config, accounts.charlie.addr);

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Acquired));
        assertEq(
            baseRegistrar.ownerOf(uint256(keccak256(bytes(config.label)))), config.predictedSafe
        );
        assertEq(_safeAt(config.predictedSafe).getOwners(), config.owners);
    }

    function test_registeredNameRevertsWithoutChangingProtocolState() public {
        VaultConfig memory config =
            _mainnetVault(REGISTERED_LABEL, keccak256("REGISTERED_FAILURE"), uint96(1 ether));

        assertFalse(controller.available(config.label));
        assertEq(
            baseRegistrar.ownerOf(uint256(keccak256(bytes(config.label)))),
            0x220866B1A2219f40e72f5c628B65D54268cA3A9D
        );

        _createVault(config, 1 ether);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ETHRegistrarController.NameNotAvailable.selector, REGISTERED_LABEL
            )
        );
        _purchase(config, accounts.charlie.addr);

        IENSDiamonds.Vault memory committed = _readVault(config.vaultId);
        assertEq(uint256(committed.state), uint256(IENSDiamonds.State.Committed));
        assertEq(committed.escrowed, 1 ether);
        assertEq(config.predictedSafe.code.length, 0);
        assertEq(controller.commitments(config.ensCommitment), committed.committedAt);
    }
}
