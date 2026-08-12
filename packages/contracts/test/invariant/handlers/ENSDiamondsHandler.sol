// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {IENSDiamondsRegistrarController} from "src/interfaces/IENSDiamondsRegistrarController.sol";
import {ENSDiamondsHandlerBase} from "test/invariant/handlers/ENSDiamondsHandlerBase.sol";

contract ENSDiamondsHandler is ENSDiamondsHandlerBase {
    constructor(
        IENSDiamonds diamonds_,
        IENSDiamondsRegistrarController controller_,
        address alice_,
        address bob_,
        address charlie_,
        address executor_
    ) ENSDiamondsHandlerBase(diamonds_, controller_, alice_, bob_, charlie_, executor_) {}

    function createVault(uint96 depositSeed) external {
        uint256 index = trackedVaults.length;
        if (index == MAX_TRACKED_VAULTS) return;

        uint256 initialDeposit = bound(depositSeed, 0.01 ether, 1 ether);
        VaultCreation memory creation = _vaultCreation(index);

        vm.deal(ALICE, ALICE.balance + initialDeposit);
        vm.prank(ALICE);
        DIAMONDS.createVault{value: initialDeposit}(
            creation.vaultSalt,
            MAX_SPEND,
            REGISTRATION_DURATION,
            creation.owners,
            creation.targetIntent,
            creation.ensCommitment,
            "https://ens.diamonds/vault-uri/invariant"
        );

        trackedVaults.push(creation.tracked);
        previousStates.push(IENSDiamonds.State.Funding);
        expectedLiabilities += initialDeposit;
    }

    function deposit(uint256 vaultSeed, uint8 memberSeed, uint96 amountSeed) external {
        if (trackedVaults.length == 0) return;
        uint256 index = vaultSeed % trackedVaults.length;
        TrackedVault storage tracked = trackedVaults[index];
        IENSDiamonds.Vault memory vault = _readVault(tracked.vaultId);
        if (vault.state != IENSDiamonds.State.Funding || vault.escrowed == vault.maxSpend) {
            return;
        }

        address member = _owner(memberSeed);
        uint256 amount = bound(amountSeed, 1, uint256(vault.maxSpend) - vault.escrowed);
        vm.deal(member, member.balance + amount);
        vm.prank(member);
        DIAMONDS.deposit{value: amount}(tracked.vaultId);

        expectedLiabilities += amount;
        _updateState(index);
    }

    function withdraw(uint256 vaultSeed, uint8 memberSeed, uint96 amountSeed) external {
        if (trackedVaults.length == 0) return;
        uint256 index = vaultSeed % trackedVaults.length;
        TrackedVault storage tracked = trackedVaults[index];
        if (_readVault(tracked.vaultId).state != IENSDiamonds.State.Funding) return;

        address member = _owner(memberSeed);
        uint256 balance = DIAMONDS.balanceOf(tracked.vaultId, member);
        if (balance == 0) return;

        uint256 amount = bound(amountSeed, 1, balance);
        vm.prank(member);
        DIAMONDS.withdraw(tracked.vaultId, amount, payable(member));

        expectedLiabilities -= amount;
        _updateState(index);
    }

    function cancel(uint256 vaultSeed) external {
        if (trackedVaults.length == 0) return;
        uint256 index = vaultSeed % trackedVaults.length;
        TrackedVault storage tracked = trackedVaults[index];
        if (_readVault(tracked.vaultId).state != IENSDiamonds.State.Funding) return;

        vm.prank(ALICE);
        DIAMONDS.cancel(tracked.vaultId);
        _updateState(index);
    }

    function beginAcquisition(uint256 vaultSeed) external {
        if (trackedVaults.length == 0) return;
        uint256 index = vaultSeed % trackedVaults.length;
        TrackedVault storage tracked = trackedVaults[index];
        IENSDiamonds.Vault memory vault = _readVault(tracked.vaultId);
        if (vault.state != IENSDiamonds.State.Funding || vault.escrowed == 0) return;

        vm.prank(ALICE);
        DIAMONDS.beginAcquisition(tracked.vaultId);
        _updateState(index);
    }

    function purchase(uint256 vaultSeed) external {
        if (trackedVaults.length == 0) return;
        uint256 index = vaultSeed % trackedVaults.length;
        TrackedVault storage tracked = trackedVaults[index];
        IENSDiamonds.Vault memory vault = _readVault(tracked.vaultId);
        if (vault.state != IENSDiamonds.State.Committed) return;

        uint256 validAt = uint256(vault.committedAt) + CONTROLLER.minCommitmentAge();
        uint256 expiresAt = uint256(vault.committedAt) + CONTROLLER.maxCommitmentAge();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < validAt || block.timestamp >= expiresAt) return;

        IPriceOracle.Price memory quote =
            CONTROLLER.rentPrice(tracked.label, vault.registrationDuration);
        uint256 price = quote.base + quote.premium;
        if (price > vault.escrowed) return;

        vm.prank(EXECUTOR);
        DIAMONDS.purchase(tracked.vaultId, tracked.label, tracked.targetSalt, tracked.ensSecret);

        expectedLiabilities -= price;
        _updateState(index);
    }

    function expireAcquisition(uint256 vaultSeed) external {
        if (trackedVaults.length == 0) return;
        uint256 index = vaultSeed % trackedVaults.length;
        TrackedVault storage tracked = trackedVaults[index];
        IENSDiamonds.Vault memory vault = _readVault(tracked.vaultId);
        if (vault.state != IENSDiamonds.State.Committed) return;
        uint256 expiresAt = uint256(vault.committedAt) + CONTROLLER.maxCommitmentAge();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < expiresAt) {
            return;
        }

        vm.prank(EXECUTOR);
        DIAMONDS.expireAcquisition(tracked.vaultId);
        _updateState(index);
    }

    function claim(uint256 vaultSeed, uint8 memberSeed) external {
        if (trackedVaults.length == 0) return;
        uint256 index = vaultSeed % trackedVaults.length;
        TrackedVault storage tracked = trackedVaults[index];
        IENSDiamonds.Vault memory vault = _readVault(tracked.vaultId);
        if (vault.state == IENSDiamonds.State.Funding) return;
        uint256 expiresAt = uint256(vault.committedAt) + CONTROLLER.maxCommitmentAge();
        // forge-lint: disable-next-line(block-timestamp)
        bool commitmentExpired = block.timestamp >= expiresAt;
        if (vault.state == IENSDiamonds.State.Committed && !commitmentExpired) return;

        address member = _owner(memberSeed);
        uint256 amount = DIAMONDS.balanceOf(tracked.vaultId, member);
        if (amount == 0) return;

        vm.prank(member);
        DIAMONDS.claim(tracked.vaultId, payable(member));

        expectedLiabilities -= amount;
        _updateState(index);
    }

    function warp(uint256 secondsSeed) external {
        vm.warp(block.timestamp + bound(secondsSeed, 1, 2 days));
    }
}
