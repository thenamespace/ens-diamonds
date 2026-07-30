// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {MainnetForkTestBase} from "test/fork/MainnetForkTestBase.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

contract MainnetWayPremiumForkTest is MainnetForkTestBase {
    function test_acquiresWayEthAndExecutesRealSafeTransaction() public {
        VaultConfig memory config = _wayVault(keccak256("WAY_SUCCESS"), WAY_MAX_SPEND);
        uint256 aliceDeposit = 10 ether;
        uint256 bobDeposit = 10 ether;
        uint256 funding = aliceDeposit + bobDeposit;
        IPriceOracle.Price memory initialQuote =
            controller.rentPrice(config.label, config.registrationDuration);

        _createVault(config, aliceDeposit);
        _deposit(config.vaultId, accounts.bob.addr, bobDeposit);
        _beginAcquisition(config.vaultId, config.creator);

        IENSDiamonds.Vault memory committed = _readVault(config.vaultId);
        assertEq(uint256(committed.state), uint256(IENSDiamonds.State.Committed));
        assertEq(controller.commitments(config.ensCommitment), committed.committedAt);
        assertEq(config.predictedSafe.code.length, 0);

        _matureCommitment(config.vaultId);
        IPriceOracle.Price memory purchaseQuote =
            controller.rentPrice(config.label, config.registrationDuration);
        uint256 price = purchaseQuote.base + purchaseQuote.premium;
        assertLt(purchaseQuote.premium, initialQuote.premium);
        assertLt(price, funding);

        vm.expectEmit(true, true, true, true, address(diamonds));
        emit IENSDiamonds.NameAcquired(
            config.vaultId,
            keccak256(bytes(config.label)),
            config.predictedSafe,
            price,
            funding - price
        );
        _purchase(config, accounts.charlie.addr);

        IENSDiamonds.Vault memory acquired = _readVault(config.vaultId);
        assertEq(uint256(acquired.state), uint256(IENSDiamonds.State.Acquired));
        assertEq(acquired.escrowed, funding - price);
        assertEq(diamonds.totalLiabilities(), funding - price);
        assertEq(controller.commitments(config.ensCommitment), 0);
        assertFalse(controller.available(config.label));
        assertEq(
            baseRegistrar.ownerOf(uint256(keccak256(bytes(config.label)))), config.predictedSafe
        );
        assertEq(
            baseRegistrar.nameExpires(uint256(keccak256(bytes(config.label)))),
            block.timestamp + config.registrationDuration
        );

        assertEq(_safeAt(config.predictedSafe).VERSION(), "1.5.0");
        assertEq(_safeAt(config.predictedSafe).getOwners(), config.owners);
        assertEq(_safeAt(config.predictedSafe).getThreshold(), config.threshold);
        assertEq(_fallbackHandlerAt(config.predictedSafe), MAINNET_SAFE_FALLBACK_HANDLER);

        uint256 transferAmount = 0.25 ether;
        vm.deal(config.predictedSafe, transferAmount);
        uint256 recipientBalance = accounts.eve.addr.balance;
        uint256[] memory privateKeys = new uint256[](2);
        privateKeys[0] = accounts.alice.privateKey;
        privateKeys[1] = accounts.bob.privateKey;

        assertTrue(
            _executeSafeTransaction(
                config.predictedSafe, privateKeys, accounts.eve.addr, transferAmount, bytes("")
            )
        );
        assertEq(accounts.eve.addr.balance, recipientBalance + transferAmount);
        assertEq(_safeAt(config.predictedSafe).nonce(), 1);

        _claim(config.vaultId, accounts.alice.addr, payable(accounts.alice.addr));
        _claim(config.vaultId, accounts.bob.addr, payable(accounts.bob.addr));
        assertEq(_readVault(config.vaultId).escrowed, 0);
        assertEq(diamonds.totalLiabilities(), 0);
        assertEq(address(diamonds).balance, 0);
    }

    function test_wayEthPremiumAboveFundingLeavesCommitmentRecoverable() public {
        uint96 maxSpend = 15 ether;
        VaultConfig memory config = _wayVault(keccak256("WAY_UNDERFUNDED"), maxSpend);

        _createVault(config, maxSpend);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);

        uint256 price = _quote(config);
        assertGt(price, maxSpend);
        vm.expectRevert(
            abi.encodeWithSelector(IENSDiamonds.InsufficientFunding.selector, price, maxSpend)
        );
        _purchase(config, accounts.eve.addr);

        IENSDiamonds.Vault memory committed = _readVault(config.vaultId);
        assertEq(uint256(committed.state), uint256(IENSDiamonds.State.Committed));
        assertEq(committed.escrowed, maxSpend);
        assertEq(config.predictedSafe.code.length, 0);
        assertEq(controller.commitments(config.ensCommitment), committed.committedAt);

        vm.warp(uint256(committed.committedAt) + controller.maxCommitmentAge());
        _claim(config.vaultId, accounts.alice.addr, payable(accounts.alice.addr));

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Failed));
        assertEq(_readVault(config.vaultId).escrowed, 0);
        assertEq(diamonds.totalLiabilities(), 0);
    }

    function test_adoptsExistingMainnetControllerCommitment() public {
        VaultConfig memory config = _wayVault(keccak256("WAY_ADOPT"), WAY_MAX_SPEND);
        _createVault(config, 1 ether);

        vm.prank(accounts.eve.addr);
        controller.commit(config.ensCommitment);
        uint256 committedAt = block.timestamp;
        vm.warp(block.timestamp + 30);

        _beginAcquisition(config.vaultId, config.creator);

        assertEq(_readVault(config.vaultId).committedAt, committedAt);
        assertEq(controller.commitments(config.ensCommitment), committedAt);
    }
}
