// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {SafeCastLib} from "solady/utils/SafeCastLib.sol";
import {VaultActions} from "test/utils/VaultActions.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

contract AccountingFuzzTest is VaultActions {
    using SafeCastLib for uint256;

    function testFuzz_fundingAccounting(
        uint96 maxSpendSeed,
        uint96 aliceDepositSeed,
        uint96 bobDepositSeed,
        uint96 withdrawalSeed
    ) public {
        uint96 maxSpend = bound(uint256(maxSpendSeed), 1 ether, 1_000 ether).toUint96();
        uint256 aliceDeposit = bound(aliceDepositSeed, 0, maxSpend);
        uint256 bobDeposit = bound(bobDepositSeed, 0, maxSpend - aliceDeposit);
        uint256 withdrawal = bound(withdrawalSeed, 0, aliceDeposit);
        vm.deal(accounts.alice.addr, uint256(maxSpend) + 1 ether);
        vm.deal(accounts.bob.addr, uint256(maxSpend) + 1 ether);

        VaultConfig memory config = _buildVault(
            accounts.alice.addr,
            _owners(accounts.alice.addr, accounts.bob.addr),
            DEFAULT_LABEL,
            DEFAULT_VAULT_SALT,
            DEFAULT_TARGET_SALT,
            DEFAULT_ENS_SECRET,
            maxSpend,
            DEFAULT_REGISTRATION_DURATION
        );
        _createVault(config, aliceDeposit);
        if (bobDeposit != 0) {
            _deposit(config.vaultId, accounts.bob.addr, bobDeposit);
        }
        if (withdrawal != 0) {
            _withdraw(
                config.vaultId, accounts.alice.addr, withdrawal, payable(accounts.charlie.addr)
            );
        }

        uint256 expectedEscrow = aliceDeposit + bobDeposit - withdrawal;
        assertEq(diamonds.balanceOf(config.vaultId, accounts.alice.addr), aliceDeposit - withdrawal);
        assertEq(diamonds.balanceOf(config.vaultId, accounts.bob.addr), bobDeposit);
        assertEq(_readVault(config.vaultId).escrowed, expectedEscrow);
        assertEq(diamonds.totalLiabilities(), expectedEscrow);
        assertEq(address(diamonds).balance, expectedEscrow);
        _assertVaultAccounting(config.vaultId, config.owners);
    }

    function testFuzz_purchaseSettlementPreservesEveryWei(
        uint96 aliceSeed,
        uint96 bobSeed,
        uint96 charlieSeed
    ) public {
        uint256 aliceDeposit = bound(aliceSeed, 0.1 ether, 3 ether);
        uint256 bobDeposit = bound(bobSeed, 0.1 ether, 3 ether);
        uint256 charlieDeposit = bound(charlieSeed, 0.1 ether, 3 ether);
        uint256 funding = aliceDeposit + bobDeposit + charlieDeposit;
        VaultConfig memory config = _defaultVault();

        _createVault(config, aliceDeposit);
        _deposit(config.vaultId, accounts.bob.addr, bobDeposit);
        _deposit(config.vaultId, accounts.charlie.addr, charlieDeposit);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);

        uint256 price = _quote(config);
        _purchase(config, accounts.eve.addr);
        uint256 surplus = funding - price;
        uint256 expectedAlice = aliceDeposit * surplus / funding;
        uint256 expectedBob = bobDeposit * surplus / funding;
        uint256 expectedCharlie = surplus - expectedAlice - expectedBob;

        assertEq(diamonds.balanceOf(config.vaultId, accounts.alice.addr), expectedAlice);
        assertEq(diamonds.balanceOf(config.vaultId, accounts.bob.addr), expectedBob);
        assertEq(diamonds.balanceOf(config.vaultId, accounts.charlie.addr), expectedCharlie);
        assertEq(_sumBalances(config.vaultId, config.owners), surplus);
        assertEq(_readVault(config.vaultId).escrowed, surplus);
        assertEq(diamonds.totalLiabilities(), surplus);
        _assertVaultAccounting(config.vaultId, config.owners);
    }
}
