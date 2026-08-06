// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ETHRegistrarController} from "ens-contracts/ethregistrar/ETHRegistrarController.sol";
import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";
import {SafeCastLib} from "solady/utils/SafeCastLib.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {ForkTestBase} from "test/fork/ForkTestBase.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

abstract contract ENSDiamondsForkTest is ForkTestBase {
    using SafeCastLib for uint256;

    function test_snapshotMatchesConfiguration() public view {
        assertEq(block.chainid, forkConfig.chain.chainId);
        assertEq(block.number, forkConfig.chain.blockNumber);
        assertEq(block.timestamp, forkConfig.chain.blockTimestamp);

        assertGt(forkConfig.contracts.ensRegistry.code.length, 0);
        assertGt(forkConfig.contracts.baseRegistrar.code.length, 0);
        assertGt(forkConfig.contracts.controller.code.length, 0);
        assertGt(forkConfig.contracts.nameWrapper.code.length, 0);
        assertGt(forkConfig.contracts.safeSingleton.code.length, 0);
        assertGt(forkConfig.contracts.safeProxyFactory.code.length, 0);
        assertGt(forkConfig.contracts.safeFallbackHandler.code.length, 0);

        assertTrue(baseRegistrar.controllers(forkConfig.contracts.controller));
        assertEq(controller.minCommitmentAge(), forkConfig.expectations.minCommitmentAge);
        assertEq(controller.maxCommitmentAge(), forkConfig.expectations.maxCommitmentAge);
        assertEq(
            controller.MIN_REGISTRATION_DURATION(), forkConfig.expectations.minRegistrationDuration
        );

        assertEq(safeSingleton.VERSION(), forkConfig.expectations.safeVersion);
        assertEq(
            forkConfig.contracts.safeSingleton.codehash,
            forkConfig.expectations.safeSingletonCodeHash
        );
        assertEq(
            forkConfig.contracts.safeProxyFactory.codehash,
            forkConfig.expectations.safeProxyFactoryCodeHash
        );
        assertEq(
            forkConfig.contracts.safeFallbackHandler.codehash,
            forkConfig.expectations.safeFallbackHandlerCodeHash
        );

        assertEq(address(diamonds.CONTROLLER()), forkConfig.contracts.controller);
        assertEq(address(diamonds.BASE_REGISTRAR()), forkConfig.contracts.baseRegistrar);
        assertEq(address(diamonds.SAFE_SINGLETON()), forkConfig.contracts.safeSingleton);
        assertEq(address(diamonds.SAFE_PROXY_FACTORY()), forkConfig.contracts.safeProxyFactory);
        assertEq(diamonds.SAFE_FALLBACK_HANDLER(), forkConfig.contracts.safeFallbackHandler);
        assertEq(
            diamonds.SAFE_PROXY_INIT_CODE_HASH(),
            keccak256(
                abi.encodePacked(
                    safeProxyFactory.proxyCreationCode(),
                    uint256(uint160(forkConfig.contracts.safeSingleton))
                )
            )
        );
    }

    function test_neverRegisteredFixtureMatchesSnapshot() public {
        string memory label = forkConfig.labels.neverRegistered;
        _skipUnlessConfigured(label, "neverRegistered");

        uint256 tokenId = _tokenId(label);
        IPriceOracle.Price memory quote = controller.rentPrice(label, DEFAULT_REGISTRATION_DURATION);

        assertEq(baseRegistrar.nameExpires(tokenId), 0);
        assertTrue(baseRegistrar.available(tokenId));
        assertTrue(controller.available(label));
        assertEq(quote.premium, 0);
    }

    function test_premiumFixtureMatchesSnapshot() public {
        string memory label = forkConfig.labels.premium;
        _skipUnlessConfigured(label, "premium");

        uint256 tokenId = _tokenId(label);
        uint256 expiry = baseRegistrar.nameExpires(tokenId);
        IPriceOracle.Price memory quote = controller.rentPrice(label, DEFAULT_REGISTRATION_DURATION);

        assertGt(expiry, 0);
        assertGt(block.timestamp, expiry + baseRegistrar.GRACE_PERIOD());
        assertTrue(baseRegistrar.available(tokenId));
        assertTrue(controller.available(label));
        assertGt(quote.premium, 0);
    }

    function test_postPremiumFixtureMatchesSnapshot() public {
        string memory label = forkConfig.labels.postPremium;
        _skipUnlessConfigured(label, "postPremium");

        uint256 tokenId = _tokenId(label);
        uint256 expiry = baseRegistrar.nameExpires(tokenId);
        IPriceOracle.Price memory quote = controller.rentPrice(label, DEFAULT_REGISTRATION_DURATION);

        assertGt(expiry, 0);
        assertGt(block.timestamp, expiry + baseRegistrar.GRACE_PERIOD());
        assertTrue(baseRegistrar.available(tokenId));
        assertTrue(controller.available(label));
        assertEq(quote.premium, 0);
    }

    function test_gracePeriodFixtureMatchesSnapshot() public {
        string memory label = forkConfig.labels.gracePeriod;
        _skipUnlessConfigured(label, "gracePeriod");

        uint256 tokenId = _tokenId(label);
        uint256 expiry = baseRegistrar.nameExpires(tokenId);

        assertGt(expiry, 0);
        assertGt(block.timestamp, expiry);
        assertLe(block.timestamp, expiry + baseRegistrar.GRACE_PERIOD());
        assertFalse(baseRegistrar.available(tokenId));
        assertFalse(controller.available(label));
    }

    function test_registeredFixtureMatchesSnapshot() public {
        string memory label = forkConfig.labels.registered;
        _skipUnlessConfigured(label, "registered");

        uint256 tokenId = _tokenId(label);

        assertGt(baseRegistrar.nameExpires(tokenId), block.timestamp);
        assertFalse(baseRegistrar.available(tokenId));
        assertFalse(controller.available(label));
        assertNotEq(baseRegistrar.ownerOf(tokenId), address(0));
        assertNotEq(baseRegistrar.ownerOf(tokenId), forkConfig.contracts.nameWrapper);
    }

    function test_wrappedFixtureMatchesSnapshot() public {
        string memory label = forkConfig.labels.wrapped;
        _skipUnlessConfigured(label, "wrapped");

        uint256 tokenId = _tokenId(label);

        assertGt(baseRegistrar.nameExpires(tokenId), block.timestamp);
        assertFalse(baseRegistrar.available(tokenId));
        assertFalse(controller.available(label));
        assertEq(baseRegistrar.ownerOf(tokenId), forkConfig.contracts.nameWrapper);
    }

    function test_acquiresNeverRegisteredName() public {
        string memory label = forkConfig.labels.neverRegistered;
        _skipUnlessConfigured(label, "neverRegistered");

        uint96 maxSpend = _quotedMaxSpend(label, 1 ether);
        VaultConfig memory config =
            _forkVault(label, keccak256("NEVER_REGISTERED_ACQUISITION"), maxSpend);

        vm.deal(config.creator, maxSpend);
        _createVault(config, maxSpend);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);
        _purchase(config, accounts.charlie.addr);

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Acquired));
        assertEq(baseRegistrar.ownerOf(_tokenId(label)), config.predictedSafe);
        assertEq(_safeAt(config.predictedSafe).getOwners(), config.owners);
    }

    function test_acquiresPremiumNameAndExecutesSafeTransaction() public {
        string memory label = forkConfig.labels.premium;
        _skipUnlessConfigured(label, "premium");

        uint96 maxSpend = _quotedMaxSpend(label, 1 ether);
        VaultConfig memory config = _forkVault(label, keccak256("PREMIUM_ACQUISITION"), maxSpend);
        uint256 aliceDeposit = maxSpend / 2;
        uint256 bobDeposit = maxSpend - aliceDeposit;

        vm.deal(accounts.alice.addr, aliceDeposit);
        vm.deal(accounts.bob.addr, bobDeposit);
        _createVault(config, aliceDeposit);
        _deposit(config.vaultId, accounts.bob.addr, bobDeposit);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);

        uint256 price = _quote(config);
        vm.expectEmit(true, true, true, true, address(diamonds));
        emit IENSDiamonds.NameAcquired(
            config.vaultId,
            keccak256(bytes(config.label)),
            config.predictedSafe,
            price,
            maxSpend - price
        );
        _purchase(config, accounts.charlie.addr);

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Acquired));
        assertEq(baseRegistrar.ownerOf(_tokenId(label)), config.predictedSafe);
        assertEq(_safeAt(config.predictedSafe).VERSION(), forkConfig.expectations.safeVersion);
        assertEq(_safeAt(config.predictedSafe).getOwners(), config.owners);
        assertEq(_safeAt(config.predictedSafe).getThreshold(), config.threshold);
        assertEq(_fallbackHandlerAt(config.predictedSafe), forkConfig.contracts.safeFallbackHandler);

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

        _claim(config.vaultId, accounts.alice.addr, payable(accounts.alice.addr));
        _claim(config.vaultId, accounts.bob.addr, payable(accounts.bob.addr));
        assertEq(_readVault(config.vaultId).escrowed, 0);
        assertEq(diamonds.totalLiabilities(), 0);
    }

    function test_registeredNameRevertsWithoutChangingState() public {
        string memory label = forkConfig.labels.registered;
        _skipUnlessConfigured(label, "registered");

        VaultConfig memory config =
            _forkVault(label, keccak256("REGISTERED_REJECTION"), uint96(1 ether));

        _createVault(config, 1 ether);
        _beginAcquisition(config.vaultId, config.creator);
        _matureCommitment(config.vaultId);

        vm.expectRevert(
            abi.encodeWithSelector(ETHRegistrarController.NameNotAvailable.selector, label)
        );
        _purchase(config, accounts.charlie.addr);

        IENSDiamonds.Vault memory committed = _readVault(config.vaultId);
        assertEq(uint256(committed.state), uint256(IENSDiamonds.State.Committed));
        assertEq(committed.escrowed, 1 ether);
        assertEq(config.predictedSafe.code.length, 0);
        assertEq(controller.commitments(config.ensCommitment), committed.committedAt);
    }

    function test_premiumAboveFundingLeavesCommitmentRecoverable() public {
        string memory label = forkConfig.labels.premium;
        _skipUnlessConfigured(label, "premium");

        uint256 initialPrice = _rentPrice(label);
        assertLe(initialPrice, type(uint96).max);
        uint96 maxSpend = (initialPrice / 2).toUint96();
        assertGt(maxSpend, 0);

        VaultConfig memory config = _forkVault(label, keccak256("PREMIUM_UNDERFUNDED"), maxSpend);
        vm.deal(config.creator, maxSpend);
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
        vm.warp(uint256(committed.committedAt) + forkConfig.expectations.maxCommitmentAge);
        _claim(config.vaultId, config.creator, payable(config.creator));

        assertEq(uint256(_readVault(config.vaultId).state), uint256(IENSDiamonds.State.Failed));
        assertEq(diamonds.totalLiabilities(), 0);
    }

    function test_adoptsExistingControllerCommitment() public {
        string memory label = forkConfig.labels.premium;
        _skipUnlessConfigured(label, "premium");

        VaultConfig memory config =
            _forkVault(label, keccak256("EXISTING_COMMITMENT"), uint96(1 ether));
        _createVault(config, 1 ether);

        vm.prank(accounts.eve.addr);
        controller.commit(config.ensCommitment);
        uint256 committedAt = block.timestamp;
        vm.warp(block.timestamp + 30);

        _beginAcquisition(config.vaultId, config.creator);

        assertEq(_readVault(config.vaultId).committedAt, committedAt);
        assertEq(controller.commitments(config.ensCommitment), committedAt);
    }

    function _tokenId(string memory label) internal pure returns (uint256) {
        return uint256(keccak256(bytes(label)));
    }

    function _rentPrice(string memory label) internal view returns (uint256) {
        IPriceOracle.Price memory quote = controller.rentPrice(label, DEFAULT_REGISTRATION_DURATION);
        return quote.base + quote.premium;
    }

    function _quotedMaxSpend(string memory label, uint256 buffer) internal view returns (uint96) {
        uint256 maxSpend = _rentPrice(label) + buffer;
        assertLe(maxSpend, type(uint96).max);
        return maxSpend.toUint96();
    }
}

contract MainnetForkTest is ENSDiamondsForkTest {
    function configPath() internal pure override returns (string memory) {
        return "test/fork/config/mainnet-25647730.json";
    }
}

contract SepoliaForkTest is ENSDiamondsForkTest {
    function configPath() internal pure override returns (string memory) {
        return "test/fork/config/sepolia-10900000.json";
    }
}
