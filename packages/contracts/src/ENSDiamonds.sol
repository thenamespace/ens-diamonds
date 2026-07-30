// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "./interfaces/IENSDiamonds.sol";
import {IENSDiamondsBaseRegistrar} from "./interfaces/IENSDiamondsBaseRegistrar.sol";
import {IENSDiamondsRegistrarController} from "./interfaces/IENSDiamondsRegistrarController.sol";
import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {
    SafeProxyFactory
} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";
import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";
import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";
import {EfficientHashLib} from "solady/utils/EfficientHashLib.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {ReentrancyGuardTransient} from "solady/utils/ReentrancyGuardTransient.sol";
import {SafeCastLib} from "solady/utils/SafeCastLib.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

contract ENSDiamonds is IENSDiamonds, ReentrancyGuardTransient {
    using SafeCastLib for uint256;

    uint256 public constant MIN_MEMBERS = 2;
    uint256 public constant MAX_MEMBERS = 10;

    bytes32 public constant TARGET_INTENT_TYPEHASH = keccak256(
        "ENSDiamondsTargetIntentV1(uint256 chainId,address protocol,bytes32 vaultId,address creator,bytes32 labelhash,uint32 registrationDuration,bytes32 targetSalt)"
    );

    bytes32 internal constant VAULT_ID_DOMAIN = keccak256("ENS_DIAMONDS_VAULT_V1");
    bytes32 internal constant SAFE_SALT_DOMAIN = keccak256("ENS_DIAMONDS_SAFE_V1");
    address internal constant SAFE_SENTINEL = address(0x1);

    IENSDiamondsRegistrarController public immutable CONTROLLER;
    IENSDiamondsBaseRegistrar public immutable BASE_REGISTRAR;
    ISafe public immutable SAFE_SINGLETON;
    SafeProxyFactory public immutable SAFE_PROXY_FACTORY;
    address public immutable SAFE_FALLBACK_HANDLER;

    uint256 internal immutable MIN_COMMITMENT_AGE;
    uint256 internal immutable MAX_COMMITMENT_AGE;
    uint256 internal immutable MIN_REGISTRATION_DURATION;
    bytes32 public immutable SAFE_PROXY_INIT_CODE_HASH;

    mapping(bytes32 vaultId => Vault vault) public override vaults;
    mapping(bytes32 vaultId => address[] owners) internal ownersOf;
    mapping(bytes32 vaultId => mapping(address member => uint256 balance))
        public
        override balanceOf;

    uint256 public override totalLiabilities;

    constructor(
        IENSDiamondsRegistrarController controller_,
        IENSDiamondsBaseRegistrar baseRegistrar_,
        ISafe safeSingleton_,
        SafeProxyFactory safeProxyFactory_,
        address safeFallbackHandler_
    ) {
        _requireContract(address(controller_));
        _requireContract(address(baseRegistrar_));
        _requireContract(address(safeSingleton_));
        _requireContract(address(safeProxyFactory_));
        _requireContract(safeFallbackHandler_);

        CONTROLLER = controller_;
        BASE_REGISTRAR = baseRegistrar_;
        SAFE_SINGLETON = safeSingleton_;
        SAFE_PROXY_FACTORY = safeProxyFactory_;
        SAFE_FALLBACK_HANDLER = safeFallbackHandler_;

        uint256 minimumAge = controller_.minCommitmentAge();
        uint256 maximumAge = controller_.maxCommitmentAge();
        uint256 minimumDuration = controller_.MIN_REGISTRATION_DURATION();

        if (maximumAge <= minimumAge || minimumDuration > type(uint32).max) {
            revert InvalidConfiguration();
        }

        MIN_COMMITMENT_AGE = minimumAge;
        MAX_COMMITMENT_AGE = maximumAge;
        MIN_REGISTRATION_DURATION = minimumDuration;

        SAFE_PROXY_INIT_CODE_HASH = keccak256(
            abi.encodePacked(
                safeProxyFactory_.proxyCreationCode(), uint256(uint160(address(safeSingleton_)))
            )
        );
    }

    function createVault(
        bytes32 vaultSalt,
        uint96 maxSpend,
        uint32 registrationDuration,
        address[] calldata owners,
        bytes32 targetIntent,
        bytes32 ensCommitment
    ) external payable override returns (bytes32 vaultId) {
        if (
            vaultSalt == bytes32(0) || maxSpend == 0
                || registrationDuration < MIN_REGISTRATION_DURATION || targetIntent == bytes32(0)
                || ensCommitment == bytes32(0)
        ) revert InvalidConfiguration();
        if (msg.value > maxSpend) revert FundingLimitExceeded();

        _validateOwners(msg.sender, owners);
        vaultId = _deriveVaultId(msg.sender, vaultSalt);
        if (vaults[vaultId].creator != address(0)) revert VaultAlreadyExists();

        SafeConfig memory config = _safeConfig(vaultId, owners);
        if (_containsOwner(owners, config.predicted)) revert InvalidOwners();

        vaults[vaultId] = Vault({
            creator: msg.sender,
            escrowed: msg.value.toUint96(),
            maxSpend: maxSpend,
            committedAt: 0,
            registrationDuration: registrationDuration,
            state: State.Funding,
            targetIntent: targetIntent,
            ensCommitment: ensCommitment
        });
        ownersOf[vaultId] = owners;

        if (msg.value != 0) {
            balanceOf[vaultId][msg.sender] = msg.value;
            totalLiabilities += msg.value;
        }

        emit VaultCreated(
            vaultId,
            msg.sender,
            maxSpend,
            registrationDuration,
            owners,
            targetIntent,
            ensCommitment,
            msg.value
        );
    }

    function deposit(bytes32 vaultId) external payable override {
        Vault storage vault = _vault(vaultId);
        _requireState(vault, State.Funding);

        if (msg.value == 0) revert InvalidAmount();
        if (!_isMember(vaultId, msg.sender)) revert NotMember();

        uint256 updatedEscrow = uint256(vault.escrowed) + msg.value;
        if (updatedEscrow > vault.maxSpend) revert FundingLimitExceeded();

        balanceOf[vaultId][msg.sender] += msg.value;
        vault.escrowed = updatedEscrow.toUint96();
        totalLiabilities += msg.value;

        emit Deposited(vaultId, msg.sender, msg.value);
    }

    function withdraw(bytes32 vaultId, uint256 amount, address payable recipient)
        external
        override
        nonReentrant
    {
        Vault storage vault = _vault(vaultId);
        _requireState(vault, State.Funding);

        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidAddress();

        uint256 balance = balanceOf[vaultId][msg.sender];
        if (amount > balance) revert InsufficientBalance();

        balanceOf[vaultId][msg.sender] = balance - amount;
        vault.escrowed = (uint256(vault.escrowed) - amount).toUint96();
        totalLiabilities -= amount;

        emit Withdrawn(vaultId, msg.sender, recipient, amount);
        SafeTransferLib.safeTransferETH(recipient, amount);
    }

    function cancel(bytes32 vaultId) external override {
        Vault storage vault = _vault(vaultId);
        if (msg.sender != vault.creator) revert Unauthorized();
        _requireState(vault, State.Funding);

        vault.state = State.Cancelled;
        emit VaultCancelled(vaultId);
    }

    function beginAcquisition(bytes32 vaultId) external override nonReentrant {
        Vault storage vault = _vault(vaultId);
        if (msg.sender != vault.creator) revert Unauthorized();
        _requireState(vault, State.Funding);

        if (vault.escrowed == 0) revert InvalidAmount();

        // Lock funding before the external controller call.
        vault.state = State.Committed;

        bytes32 commitment = vault.ensCommitment;
        uint256 timestamp = CONTROLLER.commitments(commitment);

        if (timestamp == 0) {
            CONTROLLER.commit(commitment);
            timestamp = CONTROLLER.commitments(commitment);
        } else {
            uint256 expiresAt = timestamp + MAX_COMMITMENT_AGE;

            // forge-lint: disable-next-line(block-timestamp)
            if (block.timestamp == expiresAt) revert CommitmentAtBoundary();

            // forge-lint: disable-next-line(block-timestamp)
            if (block.timestamp > expiresAt) {
                CONTROLLER.commit(commitment);
                timestamp = CONTROLLER.commitments(commitment);
            }
        }

        if (timestamp == 0) revert CommitmentChanged();

        vault.committedAt = timestamp.toUint40();

        SafeConfig memory config = _safeConfig(vaultId, ownersOf[vaultId]);
        emit AcquisitionCommitted(
            vaultId, commitment, config.predicted, timestamp, config.threshold
        );
    }

    function purchase(
        bytes32 vaultId,
        string calldata normalizedLabel,
        bytes32 targetSalt,
        bytes32 ensSecret
    ) external override nonReentrant {
        Vault storage vault = _vault(vaultId);
        _requireState(vault, State.Committed);

        if (targetSalt == bytes32(0) || ensSecret == bytes32(0)) {
            revert InvalidConfiguration();
        }

        bytes32 labelhash = EfficientHashLib.hash(bytes(normalizedLabel));
        bytes32 expectedIntent = EfficientHashLib.hash(
            uint256(TARGET_INTENT_TYPEHASH),
            block.chainid,
            uint256(uint160(address(this))),
            uint256(vaultId),
            uint256(uint160(vault.creator)),
            uint256(labelhash),
            vault.registrationDuration,
            uint256(targetSalt)
        );
        if (expectedIntent != vault.targetIntent) revert TargetMismatch();

        SafeConfig memory config = _safeConfig(vaultId, ownersOf[vaultId]);
        IETHRegistrarController.Registration memory registration =
            IETHRegistrarController.Registration({
                label: normalizedLabel,
                owner: config.predicted,
                duration: vault.registrationDuration,
                secret: ensSecret,
                resolver: address(0),
                data: new bytes[](0),
                reverseRecord: 0,
                referrer: bytes32(0)
            });

        if (CONTROLLER.makeCommitment(registration) != vault.ensCommitment) {
            revert CommitmentMismatch();
        }

        uint256 controllerTimestamp = CONTROLLER.commitments(vault.ensCommitment);
        uint256 storedTimestamp = vault.committedAt;

        if (controllerTimestamp == storedTimestamp) {
            _purchaseCommitted(vaultId, vault, labelhash, registration, config);
            return;
        }

        if (controllerTimestamp == 0) {
            _recoverCopiedPurchase(vaultId, vault, labelhash, config);
            return;
        }

        revert CommitmentChanged();
    }

    function expireAcquisition(bytes32 vaultId) external override nonReentrant {
        Vault storage vault = _vault(vaultId);
        _requireState(vault, State.Committed);

        uint256 expiresAt = uint256(vault.committedAt) + MAX_COMMITMENT_AGE;
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < expiresAt) revert CommitmentNotExpired(expiresAt);

        vault.state = State.Failed;
        emit AcquisitionExpired(vaultId);
    }

    function claim(bytes32 vaultId, address payable recipient) external override nonReentrant {
        Vault storage vault = _vault(vaultId);
        if (recipient == address(0)) revert InvalidAddress();

        if (vault.state == State.Committed) {
            uint256 expiresAt = uint256(vault.committedAt) + MAX_COMMITMENT_AGE;
            // forge-lint: disable-next-line(block-timestamp)
            if (block.timestamp < expiresAt) revert InvalidState(State.Committed);

            vault.state = State.Failed;
            emit AcquisitionExpired(vaultId);
        }

        State state = vault.state;
        if (state != State.Acquired && state != State.Cancelled && state != State.Failed) {
            revert InvalidState(state);
        }

        uint256 amount = balanceOf[vaultId][msg.sender];
        if (amount == 0) revert NothingToClaim();

        balanceOf[vaultId][msg.sender] = 0;
        vault.escrowed = (uint256(vault.escrowed) - amount).toUint96();
        totalLiabilities -= amount;

        emit Claimed(vaultId, msg.sender, recipient, amount);
        SafeTransferLib.safeTransferETH(recipient, amount);
    }

    function predictSafe(address creator, bytes32 vaultSalt, address[] calldata owners)
        external
        view
        override
        returns (bytes32 vaultId, address safe, uint256 threshold)
    {
        if (creator == address(0)) revert InvalidAddress();
        if (vaultSalt == bytes32(0)) revert InvalidConfiguration();
        _validateOwners(creator, owners);

        vaultId = _deriveVaultId(creator, vaultSalt);
        SafeConfig memory config = _safeConfig(vaultId, owners);
        if (_containsOwner(owners, config.predicted)) revert InvalidOwners();

        return (vaultId, config.predicted, config.threshold);
    }

    function getOwners(bytes32 vaultId) external view override returns (address[] memory owners) {
        _vault(vaultId);
        return ownersOf[vaultId];
    }

    function _purchaseCommitted(
        bytes32 vaultId,
        Vault storage vault,
        bytes32 labelhash,
        IETHRegistrarController.Registration memory registration,
        SafeConfig memory config
    ) internal {
        uint256 committedAt = vault.committedAt;
        uint256 validAt = committedAt + MIN_COMMITMENT_AGE;
        uint256 expiresAt = committedAt + MAX_COMMITMENT_AGE;

        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < validAt) revert CommitmentTooYoung(validAt);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= expiresAt) revert CommitmentExpired(expiresAt);

        IPriceOracle.Price memory quote =
            CONTROLLER.rentPrice(registration.label, registration.duration);
        uint256 price = quote.base + quote.premium;
        uint256 funding = vault.escrowed;
        if (price > funding) revert InsufficientFunding(price, funding);

        _ensureSafe(config);
        CONTROLLER.register{value: price}(registration);

        if (_ownerOf(uint256(labelhash)) != config.predicted) {
            revert ENSVerificationFailed();
        }

        uint256 surplus = _settlePurchase(vaultId, vault, funding, price);
        emit NameAcquired(vaultId, labelhash, config.predicted, price, surplus, false);
    }

    function _recoverCopiedPurchase(
        bytes32 vaultId,
        Vault storage vault,
        bytes32 labelhash,
        SafeConfig memory config
    ) internal {
        uint256 committedAt = vault.committedAt;
        uint256 expiresAt = committedAt + MAX_COMMITMENT_AGE;
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= expiresAt) revert CommitmentExpired(expiresAt);

        uint256 tokenId = uint256(labelhash);
        if (_ownerOf(tokenId) != config.predicted) revert ENSVerificationFailed();

        uint256 nameExpiry = BASE_REGISTRAR.nameExpires(tokenId);
        uint256 minimumExpiry = committedAt + MIN_COMMITMENT_AGE + vault.registrationDuration;
        uint256 maximumExpiry = committedAt + MAX_COMMITMENT_AGE + vault.registrationDuration;

        if (
            // forge-lint: disable-next-line(block-timestamp)
            nameExpiry <= block.timestamp || nameExpiry < minimumExpiry
                || nameExpiry >= maximumExpiry
        ) {
            revert ENSVerificationFailed();
        }

        _ensureSafe(config);
        vault.state = State.Acquired;

        emit NameAcquired(vaultId, labelhash, config.predicted, 0, vault.escrowed, true);
    }

    function _settlePurchase(bytes32 vaultId, Vault storage vault, uint256 funding, uint256 price)
        internal
        returns (uint256 surplus)
    {
        surplus = funding - price;

        address[] storage owners = ownersOf[vaultId];
        uint256 ownerCount = owners.length;
        uint256 allocated;
        address lastContributor;

        for (uint256 i; i < ownerCount;) {
            address owner = owners[i];
            uint256 contribution = balanceOf[vaultId][owner];

            if (contribution != 0) {
                lastContributor = owner;
                uint256 refund = contribution * surplus / funding;
                balanceOf[vaultId][owner] = refund;
                allocated += refund;
            }

            unchecked {
                ++i;
            }
        }

        // funding is nonzero, so at least one positive contributor must exist.
        balanceOf[vaultId][lastContributor] += surplus - allocated;

        vault.escrowed = surplus.toUint96();
        vault.state = State.Acquired;
        totalLiabilities -= price;
    }

    function _safeConfig(bytes32 vaultId, address[] memory owners)
        internal
        view
        returns (SafeConfig memory config)
    {
        uint256 threshold = owners.length / 2 + 1;
        uint256 saltNonce = uint256(
            EfficientHashLib.hash(
                uint256(SAFE_SALT_DOMAIN),
                block.chainid,
                uint256(uint160(address(this))),
                uint256(vaultId)
            )
        );

        bytes memory initializer = abi.encodeCall(
            ISafe.setup,
            (
                owners,
                threshold,
                address(0),
                bytes(""),
                SAFE_FALLBACK_HANDLER,
                address(0),
                0,
                payable(address(0))
            )
        );

        bytes32 salt = EfficientHashLib.hash(uint256(EfficientHashLib.hash(initializer)), saltNonce);
        address predicted = LibClone.predictDeterministicAddress(
            SAFE_PROXY_INIT_CODE_HASH, salt, address(SAFE_PROXY_FACTORY)
        );

        config = SafeConfig({
            predicted: predicted,
            threshold: threshold,
            saltNonce: saltNonce,
            initializer: initializer
        });
    }

    function _ensureSafe(SafeConfig memory config) internal {
        if (config.predicted.code.length != 0) return;

        address deployed = address(
            SAFE_PROXY_FACTORY.createProxyWithNonce(
                address(SAFE_SINGLETON), config.initializer, config.saltNonce
            )
        );

        if (deployed != config.predicted) {
            revert SafeVerificationFailed();
        }
        if (deployed.code.length == 0) revert SafeVerificationFailed();
    }

    function _ownerOf(uint256 tokenId) internal view returns (address owner) {
        try BASE_REGISTRAR.ownerOf(tokenId) returns (address currentOwner) {
            return currentOwner;
        } catch {
            revert ENSVerificationFailed();
        }
    }

    function _deriveVaultId(address creator, bytes32 vaultSalt) internal view returns (bytes32) {
        return EfficientHashLib.hash(
            uint256(VAULT_ID_DOMAIN),
            block.chainid,
            uint256(uint160(address(this))),
            uint256(uint160(creator)),
            uint256(vaultSalt)
        );
    }

    function _validateOwners(address creator, address[] calldata owners) internal view {
        uint256 ownerCount = owners.length;
        if (ownerCount < MIN_MEMBERS || ownerCount > MAX_MEMBERS || owners[0] != creator) {
            revert InvalidOwners();
        }

        for (uint256 i; i < ownerCount;) {
            address owner = owners[i];
            if (owner == address(0) || owner == SAFE_SENTINEL || owner == address(this)) {
                revert InvalidOwners();
            }

            for (uint256 j; j < i;) {
                if (owners[j] == owner) revert InvalidOwners();
                unchecked {
                    ++j;
                }
            }

            unchecked {
                ++i;
            }
        }
    }

    function _containsOwner(address[] calldata owners, address account)
        internal
        pure
        returns (bool)
    {
        uint256 ownerCount = owners.length;
        for (uint256 i; i < ownerCount;) {
            if (owners[i] == account) return true;
            unchecked {
                ++i;
            }
        }
        return false;
    }

    function _isMember(bytes32 vaultId, address account) internal view returns (bool) {
        address[] storage owners = ownersOf[vaultId];
        uint256 ownerCount = owners.length;

        for (uint256 i; i < ownerCount;) {
            if (owners[i] == account) return true;
            unchecked {
                ++i;
            }
        }

        return false;
    }

    function _vault(bytes32 vaultId) internal view returns (Vault storage vault) {
        vault = vaults[vaultId];
        if (vault.creator == address(0)) revert VaultNotFound();
    }

    function _requireState(Vault storage vault, State expected) internal view {
        if (vault.state != expected) revert InvalidState(vault.state);
    }

    function _requireContract(address dependency) internal view {
        if (dependency == address(0) || dependency.code.length == 0) {
            revert InvalidContract(dependency);
        }
    }

    // All supported deployments use EIP-1153.
    function _useTransientReentrancyGuardOnlyOnMainnet() internal pure override returns (bool) {
        return false;
    }

    receive() external payable {
        revert DirectETHNotAccepted();
    }

    fallback() external payable {
        revert DirectETHNotAccepted();
    }
}
