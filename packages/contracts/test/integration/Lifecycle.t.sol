// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {SafeTestUtils} from "test/utils/SafeTestUtils.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

contract LifecycleIntegrationTest is SafeTestUtils {
    function test_fullAvailableNameLifecycle() public {
        VaultConfig memory config = _defaultVault();
        uint256 aliceDeposit = 2 ether;
        uint256 bobDeposit = 1 ether;
        uint256 charlieDeposit = 0.5 ether;
        uint256 funding = aliceDeposit + bobDeposit + charlieDeposit;

        _createVault(config, aliceDeposit);
        _deposit(config.vaultId, accounts.bob.addr, bobDeposit);
        _deposit(config.vaultId, accounts.charlie.addr, charlieDeposit);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);
        uint256 price = _quote(config);
        _purchase(config, accounts.eve.addr);

        IENSDiamonds.Vault memory acquired = _readVault(config.vaultId);
        assertEq(uint256(acquired.state), uint256(IENSDiamonds.State.Acquired));
        assertEq(acquired.escrowed, funding - price);
        assertEq(_safeAt(config.predictedSafe).getOwners(), config.owners);
        assertEq(_safeAt(config.predictedSafe).getThreshold(), config.threshold);
        assertEq(
            baseRegistrar.ownerOf(uint256(keccak256(bytes(config.label)))), config.predictedSafe
        );

        _claim(config.vaultId, accounts.alice.addr, payable(accounts.alice.addr));
        _claim(config.vaultId, accounts.bob.addr, payable(accounts.bob.addr));
        _claim(config.vaultId, accounts.charlie.addr, payable(accounts.charlie.addr));

        assertEq(_readVault(config.vaultId).escrowed, 0);
        assertEq(diamonds.totalLiabilities(), 0);
        assertEq(address(diamonds).balance, 0);
    }

    function test_failedLifecycleReturnsEveryContribution() public {
        VaultConfig memory config = _defaultVault();
        _createVault(config, 1 ether);
        _deposit(config.vaultId, accounts.bob.addr, 2 ether);
        _beginAcquisition(config.vaultId, config.creator);
        vm.warp(block.timestamp + controller.maxCommitmentAge());

        diamonds.expireAcquisition(config.vaultId);
        _claim(config.vaultId, accounts.alice.addr, payable(accounts.alice.addr));
        _claim(config.vaultId, accounts.bob.addr, payable(accounts.bob.addr));

        assertEq(_readVault(config.vaultId).escrowed, 0);
        assertEq(diamonds.totalLiabilities(), 0);
    }
}
