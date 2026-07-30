// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Safe} from "@safe-global/safe-smart-account/contracts/Safe.sol";
import {
    CompatibilityFallbackHandler
} from "@safe-global/safe-smart-account/contracts/handler/CompatibilityFallbackHandler.sol";
import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {Enum} from "@safe-global/safe-smart-account/contracts/libraries/Enum.sol";
import {
    SafeProxyFactory
} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";
import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";
import {Test} from "forge-std/Test.sol";
import {ENSDiamonds} from "src/ENSDiamonds.sol";
import {IBaseRegistrar} from "src/interfaces/IBaseRegistrar.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {IENSDiamondsRegistrarController} from "src/interfaces/IENSDiamondsRegistrarController.sol";
import {MockBaseRegistrar} from "test/mocks/MockBaseRegistrar.sol";
import {MockRegistrarController} from "test/mocks/MockRegistrarController.sol";

abstract contract ENSDiamondsTestBase is Test {
    struct VaultFixture {
        address creator;
        bytes32 vaultSalt;
        uint96 maxSpend;
        uint32 registrationDuration;
        address[] owners;
        string label;
        bytes32 labelhash;
        bytes32 targetSalt;
        bytes32 ensSecret;
        bytes32 vaultId;
        address predictedSafe;
        uint256 threshold;
        bytes32 targetIntent;
        bytes32 ensCommitment;
    }

    uint256 internal constant CREATOR_PK = 0xA11CE;
    uint256 internal constant MEMBER_PK = 0xB0B;
    uint256 internal constant THIRD_MEMBER_PK = 0xCA11;

    uint256 internal constant INITIAL_TIMESTAMP = 1_800_000_000;
    uint256 internal constant MIN_COMMITMENT_AGE = 60;
    uint256 internal constant MAX_COMMITMENT_AGE = 1 days;
    uint256 internal constant MIN_REGISTRATION_DURATION = 28 days;
    uint256 internal constant BASE_PRICE = 1 ether;
    uint256 internal constant PREMIUM_PRICE = 0.25 ether;

    uint96 internal constant DEFAULT_MAX_SPEND = 10 ether;
    uint32 internal constant DEFAULT_REGISTRATION_DURATION = 365 days;
    bytes32 internal constant DEFAULT_VAULT_SALT = keccak256("DEFAULT_VAULT_SALT");
    bytes32 internal constant DEFAULT_TARGET_SALT = keccak256("DEFAULT_TARGET_SALT");
    bytes32 internal constant DEFAULT_ENS_SECRET = keccak256("DEFAULT_ENS_SECRET");
    bytes32 internal constant TARGET_INTENT_TYPEHASH = keccak256(
        "ENSDiamondsTargetIntentV1(uint256 chainId,address protocol,bytes32 vaultId,address creator,bytes32 labelhash,uint32 registrationDuration,bytes32 targetSalt)"
    );
    bytes32 internal constant FALLBACK_HANDLER_STORAGE_SLOT =
        0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;
    string internal constant DEFAULT_LABEL = "ens-diamonds-fixture";

    address internal creator;
    address internal member;
    address internal thirdMember;
    address internal executor;

    MockBaseRegistrar internal baseRegistrar;
    MockRegistrarController internal controller;
    Safe internal safeSingleton;
    SafeProxyFactory internal safeProxyFactory;
    CompatibilityFallbackHandler internal safeFallbackHandler;
    ENSDiamonds internal diamonds;

    function setUp() public virtual {
        vm.warp(INITIAL_TIMESTAMP);

        creator = vm.addr(CREATOR_PK);
        member = vm.addr(MEMBER_PK);
        thirdMember = vm.addr(THIRD_MEMBER_PK);
        executor = makeAddr("executor");

        vm.label(creator, "Creator");
        vm.label(member, "Member");
        vm.label(thirdMember, "Third Member");
        vm.label(executor, "Executor");

        vm.deal(creator, 100 ether);
        vm.deal(member, 100 ether);
        vm.deal(thirdMember, 100 ether);
        vm.deal(executor, 100 ether);

        baseRegistrar = new MockBaseRegistrar();
        controller = new MockRegistrarController(
            baseRegistrar,
            MIN_COMMITMENT_AGE,
            MAX_COMMITMENT_AGE,
            MIN_REGISTRATION_DURATION,
            BASE_PRICE,
            PREMIUM_PRICE
        );

        safeSingleton = new Safe();
        safeProxyFactory = new SafeProxyFactory();
        safeFallbackHandler = new CompatibilityFallbackHandler();

        diamonds = _deployDiamonds(controller);

        vm.label(address(baseRegistrar), "Mock Base Registrar");
        vm.label(address(controller), "Mock ENS Controller");
        vm.label(address(safeSingleton), "Safe Singleton v1.5.0");
        vm.label(address(safeProxyFactory), "Safe Proxy Factory");
        vm.label(address(safeFallbackHandler), "Safe Fallback Handler");
        vm.label(address(diamonds), "ENS Diamonds");
    }

    function _deployDiamonds(MockRegistrarController controller_)
        internal
        returns (ENSDiamonds deployment)
    {
        deployment = new ENSDiamonds(
            IENSDiamondsRegistrarController(address(controller_)),
            IBaseRegistrar(address(baseRegistrar)),
            ISafe(payable(address(safeSingleton))),
            safeProxyFactory,
            address(safeFallbackHandler)
        );
    }

    function _defaultOwners() internal view returns (address[] memory owners) {
        owners = new address[](2);
        owners[0] = creator;
        owners[1] = member;
    }

    function _defaultOwnerPrivateKeys() internal pure returns (uint256[] memory privateKeys) {
        privateKeys = new uint256[](2);
        privateKeys[0] = CREATOR_PK;
        privateKeys[1] = MEMBER_PK;
    }

    function _defaultVaultFixture() internal view returns (VaultFixture memory fixture) {
        fixture = _buildVaultFixture(
            creator,
            DEFAULT_VAULT_SALT,
            DEFAULT_MAX_SPEND,
            DEFAULT_REGISTRATION_DURATION,
            _defaultOwners(),
            DEFAULT_LABEL,
            DEFAULT_TARGET_SALT,
            DEFAULT_ENS_SECRET
        );
    }

    function _buildVaultFixture(
        address creator_,
        bytes32 vaultSalt_,
        uint96 maxSpend_,
        uint32 registrationDuration_,
        address[] memory owners_,
        string memory label_,
        bytes32 targetSalt_,
        bytes32 ensSecret_
    ) internal view returns (VaultFixture memory fixture) {
        fixture.creator = creator_;
        fixture.vaultSalt = vaultSalt_;
        fixture.maxSpend = maxSpend_;
        fixture.registrationDuration = registrationDuration_;
        fixture.owners = owners_;
        fixture.label = label_;
        fixture.labelhash = keccak256(bytes(label_));
        fixture.targetSalt = targetSalt_;
        fixture.ensSecret = ensSecret_;
        (fixture.vaultId, fixture.predictedSafe, fixture.threshold) =
            diamonds.predictSafe(creator_, vaultSalt_, owners_);
        fixture.targetIntent = _targetIntent(fixture);
        fixture.ensCommitment = controller.makeCommitment(_registration(fixture));
    }

    function _targetIntent(VaultFixture memory fixture) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                uint256(TARGET_INTENT_TYPEHASH),
                block.chainid,
                uint256(uint160(address(diamonds))),
                uint256(fixture.vaultId),
                uint256(uint160(fixture.creator)),
                uint256(fixture.labelhash),
                fixture.registrationDuration,
                uint256(fixture.targetSalt)
            )
        );
    }

    function _registration(VaultFixture memory fixture)
        internal
        pure
        returns (IETHRegistrarController.Registration memory registration)
    {
        registration = IETHRegistrarController.Registration({
            label: fixture.label,
            owner: fixture.predictedSafe,
            duration: fixture.registrationDuration,
            secret: fixture.ensSecret,
            resolver: address(0),
            data: new bytes[](0),
            reverseRecord: 0,
            referrer: bytes32(0)
        });
    }

    function _createVault(VaultFixture memory fixture, uint256 creatorDeposit)
        internal
        returns (bytes32 vaultId)
    {
        vm.prank(fixture.creator);
        vaultId = diamonds.createVault{value: creatorDeposit}(
            fixture.vaultSalt,
            fixture.maxSpend,
            fixture.registrationDuration,
            fixture.owners,
            fixture.targetIntent,
            fixture.ensCommitment
        );
        assertEq(vaultId, fixture.vaultId);
    }

    function _deposit(bytes32 vaultId, address depositor, uint256 amount) internal {
        vm.prank(depositor);
        diamonds.deposit{value: amount}(vaultId);
    }

    function _beginAcquisition(VaultFixture memory fixture) internal returns (uint256 committedAt) {
        vm.prank(fixture.creator);
        diamonds.beginAcquisition(fixture.vaultId);
        committedAt = _readVault(fixture.vaultId).committedAt;
    }

    function _matureCommitment(VaultFixture memory fixture) internal returns (uint256 committedAt) {
        committedAt = _readVault(fixture.vaultId).committedAt;
        vm.warp(committedAt + controller.minCommitmentAge());
    }

    function _purchase(VaultFixture memory fixture, address caller) internal {
        vm.prank(caller);
        diamonds.purchase(fixture.vaultId, fixture.label, fixture.targetSalt, fixture.ensSecret);
    }

    function _readVault(bytes32 vaultId) internal view returns (IENSDiamonds.Vault memory vault) {
        (
            vault.creator,
            vault.escrowed,
            vault.maxSpend,
            vault.committedAt,
            vault.registrationDuration,
            vault.state,
            vault.targetIntent,
            vault.ensCommitment
        ) = diamonds.vaults(vaultId);
    }

    function _safeAt(address safe) internal pure returns (ISafe) {
        return ISafe(payable(safe));
    }

    function _fallbackHandlerAt(address safe) internal view returns (address) {
        return address(uint160(uint256(vm.load(safe, FALLBACK_HANDLER_STORAGE_SLOT))));
    }

    function _execSafeTransaction(
        address safe,
        uint256[] memory ownerPrivateKeys,
        address to,
        uint256 value,
        bytes memory data
    ) internal returns (bool success) {
        ISafe account = _safeAt(safe);
        uint256 threshold = account.getThreshold();
        assertGe(ownerPrivateKeys.length, threshold);
        _sortPrivateKeysByOwner(ownerPrivateKeys);

        bytes32 transactionHash = account.getTransactionHash(
            to,
            value,
            data,
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            account.nonce()
        );
        bytes memory signatures;

        for (uint256 i; i < threshold; ++i) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKeys[i], transactionHash);
            signatures = bytes.concat(signatures, abi.encodePacked(r, s, v));
        }

        success = account.execTransaction(
            to,
            value,
            data,
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            signatures
        );
    }

    function _sortPrivateKeysByOwner(uint256[] memory privateKeys) internal pure {
        uint256 length = privateKeys.length;

        for (uint256 i = 1; i < length; ++i) {
            uint256 key = privateKeys[i];
            address owner = vm.addr(key);
            uint256 j = i;

            while (j != 0 && vm.addr(privateKeys[j - 1]) > owner) {
                privateKeys[j] = privateKeys[j - 1];
                unchecked {
                    --j;
                }
            }
            privateKeys[j] = key;
        }
    }
}
