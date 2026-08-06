// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {EnsRegistrationUtils} from "test/utils/EnsRegistrationUtils.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

contract PremiumNameIntegrationTest is EnsRegistrationUtils {
    function test_acquiresNameDuringPremiumPeriod() public {
        string memory label = "premium-diamond";
        uint256 oldExpiry = _registerDirect(
            label,
            accounts.eve.addr,
            controller.MIN_REGISTRATION_DURATION(),
            keccak256("old premium secret")
        );
        vm.warp(oldExpiry + baseRegistrar.GRACE_PERIOD() + 20 days);

        VaultConfig memory config = _buildVault(
            accounts.alice.addr,
            _owners(accounts.alice.addr, accounts.bob.addr),
            label,
            keccak256("PREMIUM_VAULT"),
            keccak256("PREMIUM_TARGET"),
            keccak256("PREMIUM_SECRET"),
            DEFAULT_MAX_SPEND,
            DEFAULT_REGISTRATION_DURATION
        );
        IPriceOracle.Price memory quote = controller.rentPrice(label, config.registrationDuration);
        uint256 price = quote.base + quote.premium;
        assertGt(quote.premium, 0);
        assertLt(price, config.maxSpend);

        uint256 controllerBalance = address(controller).balance;
        _createVault(config, price + 1 ether);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);
        _purchase(config, accounts.charlie.addr);
        uint256 purchasePrice = address(controller).balance - controllerBalance;

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Acquired));
        assertEq(baseRegistrar.ownerOf(uint256(keccak256(bytes(label)))), config.predictedSafe);
        assertEq(_readVault(config.vaultId).escrowed, price + 1 ether - purchasePrice);
        assertLt(purchasePrice, price);
    }

    function test_acquiresExpiredNameAfterPremiumPeriod() public {
        string memory label = "expired-diamond";
        uint256 oldExpiry = _registerDirect(
            label,
            accounts.eve.addr,
            controller.MIN_REGISTRATION_DURATION(),
            keccak256("old expired secret")
        );
        vm.warp(oldExpiry + baseRegistrar.GRACE_PERIOD() + 22 days);

        VaultConfig memory config = _buildVault(
            accounts.alice.addr,
            _owners(accounts.alice.addr, accounts.bob.addr),
            label,
            keccak256("EXPIRED_VAULT"),
            keccak256("EXPIRED_TARGET"),
            keccak256("EXPIRED_SECRET"),
            DEFAULT_MAX_SPEND,
            DEFAULT_REGISTRATION_DURATION
        );
        IPriceOracle.Price memory quote = controller.rentPrice(label, config.registrationDuration);
        assertEq(quote.premium, 0);

        _createVault(config, 1 ether);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);
        _purchase(config, accounts.charlie.addr);

        assertEq(baseRegistrar.ownerOf(uint256(keccak256(bytes(label)))), config.predictedSafe);
    }
}
